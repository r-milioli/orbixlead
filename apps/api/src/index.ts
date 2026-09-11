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
import { PrismaSessionStore } from "./lib/session-store";
import apiRoutes from "./routes";

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

app.listen(port, () => {
  logger.info("api_listening", { port, webOrigin });
});
