import rateLimit, { type Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

/**
 * Rate limiting (SEC-01).
 *
 * Usa o Redis já existente como store distribuído (funciona com múltiplas réplicas).
 * Se o Redis estiver indisponível, o express-rate-limit cai no store em memória
 * (fail-open por réplica) — aceitável, pois o objetivo é conter abuso, não DoS total.
 */

function makeStore(prefix: string) {
  return new RedisStore({
    // O ioredis expõe `call(command, ...args)`; adaptamos a assinatura do rate-limit-redis.
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as Promise<never>,
    prefix: `rl:${prefix}:`,
  });
}

function baseOptions(prefix: string, overrides: Partial<Options>): Partial<Options> {
  return {
    store: makeStore(prefix),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Chaveia por IP (a app está atrás do Traefik com trust proxy = 1).
    handler: (req, res, _next, options) => {
      logger.warn("rate_limit_exceeded", { prefix, path: req.originalUrl, ip: req.ip });
      res.status(options.statusCode).json({
        error: "Muitas tentativas. Tente novamente mais tarde.",
      });
    },
    ...overrides,
  };
}

/** Limite global de segurança para toda a API. */
export const globalLimiter = rateLimit(
  baseOptions("global", {
    windowMs: 60 * 1000,
    limit: 300, // 300 req/min por IP
  })
);

/** Login: protege contra brute force / credential stuffing. */
export const loginLimiter = rateLimit(
  baseOptions("login", {
    windowMs: 15 * 60 * 1000,
    limit: 10, // 10 tentativas / 15 min por IP
    skipSuccessfulRequests: true, // só conta falhas de login
  })
);

/** Endpoints que disparam e-mail (evita e-mail bombing) e força bruta de token. */
export const sensitiveAuthLimiter = rateLimit(
  baseOptions("sensitive", {
    windowMs: 60 * 60 * 1000,
    limit: 20, // 20 req / hora por IP
  })
);
