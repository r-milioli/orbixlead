import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { ZodError } from "zod";
import { logger } from "./lib/logger";
import { bootstrapSuperAdminFromEnv } from "./lib/bootstrap-super-admin";
import { assertRedis, redisTarget } from "./lib/redis";
import { PrismaSessionStore } from "./lib/session-store";
import apiRoutes from "./routes";
import internalRoutes from "./routes/internal";

const app = express();
const port = Number(process.env.API_PORT || 4000);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

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
    secret: process.env.SESSION_SECRET || "dev-orbixlead-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true" || isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1", apiRoutes);

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
    if (status >= 500) {
      logger.error("unhandled_error", { message, err });
    }
    return res.status(status || 500).json({ error: message });
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
