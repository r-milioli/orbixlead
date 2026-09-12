import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import { ZodError } from "zod";
import { logger } from "./lib/logger";
import { loadSecretsFromFiles } from "./lib/secrets-file";
import { assertProductionSecrets } from "./lib/env";
import { bootstrapSuperAdminFromEnv } from "./lib/bootstrap-super-admin";
import { redis, assertRedis, redisTarget } from "./lib/redis";
import { prisma } from "./lib/prisma";
import { PrismaSessionStore } from "./lib/session-store";
import apiRoutes from "./routes";
import internalRoutes from "./routes/internal";
import { globalLimiter } from "./middleware/rate-limit";

// CONF-01: carrega segredos de arquivos (Docker Secrets, padrão *_FILE).
loadSecretsFromFiles();
// SEC-02 / CONF-01: valida segredos antes de qualquer coisa (falha o boot em produção).
assertProductionSecrets();

const app = express();
const port = Number(process.env.API_PORT || 4000);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// SEC-04: cabeçalhos de segurança. A API é JSON-only; desabilitamos a CSP do Helmet
// (a CSP é responsabilidade da Web/Next.js) e mantemos os demais headers de hardening.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);

app.use(
  cors({
    origin: webOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// Rotas do scraper: sem cookie/sessão e fora de /api (Traefik do front usa PathPrefix `/api`).
app.use("/internal", internalRoutes);
app.use("/api/v1/internal", internalRoutes);

app.use(cookieParser());
app.use(
  session({
    name: "orbixlead.sid",
    secret: process.env.SESSION_SECRET || "dev-orbixlead-session-secret-change-me-min-32-chars",
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(),
    cookie: {
      httpOnly: true,
      // SEC-10: app é single-origin atrás do Traefik → `strict` em produção mitiga CSRF.
      // Em dev mantemos `lax` para não atrapalhar navegação entre ferramentas locais.
      sameSite: isProd ? "strict" : "lax",
      secure: process.env.COOKIE_SECURE === "true" || isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// OBS-02: readiness — verifica dependências (DB e Redis) antes de receber tráfego.
app.get("/ready", async (_req, res) => {
  const checks: { db: boolean; redis: boolean } = { db: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    /* db indisponível */
  }
  try {
    const pong = await redis.ping();
    checks.redis = pong === "PONG";
  } catch {
    /* redis indisponível */
  }
  const ready = checks.db && checks.redis;
  return res.status(ready ? 200 : 503).json({ ready, checks });
});

// SEC-01: rate limit global nas rotas de aplicação (as rotas internas do scraper
// já são protegidas por chave e ficam fora deste limite para não travar cargas altas).
app.use("/api/v1", globalLimiter, apiRoutes);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validação falhou",
        details: err.flatten(),
      });
    }

    const status =
      typeof err === "object" && err && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Erro interno";
    const finalStatus = status || 500;

    // SEC-03: erros 5xx podem conter detalhes internos (Prisma, SQL, caminhos).
    // Logamos o detalhe internamente com um requestId e devolvemos mensagem genérica.
    if (finalStatus >= 500) {
      const requestId = crypto.randomUUID();
      logger.error("unhandled_error", { requestId, message, err });
      return res.status(finalStatus).json({
        error: "Erro interno. Tente novamente mais tarde.",
        requestId,
      });
    }

    // Erros 4xx (regras de negócio) mantêm a mensagem para o cliente.
    return res.status(finalStatus).json({ error: message });
  }
);

async function start() {
  logger.info("redis_config", redisTarget());
  try {
    await assertRedis();
  } catch (err) {
    logger.error("redis_unavailable", {
      message: err instanceof Error ? err.message : String(err),
      ...redisTarget(),
    });
  }
  await bootstrapSuperAdminFromEnv();
  app.listen(port, () => {
    logger.info("api_listening", { port, webOrigin });
  });
}

start().catch((err) => {
  logger.error("api_start_failed", { err });
  process.exit(1);
});
