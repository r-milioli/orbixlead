import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { loadSecretsFromFiles } from "./secrets-file";
import { logger } from "./logger";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

// CONF-01: garante que DATABASE_URL via *_FILE (Docker Secrets) seja carregado
// antes de o PrismaClient ser instanciado.
loadSecretsFromFiles();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaKeepalive?: ReturnType<typeof setInterval>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Postgres/firewall costumam derrubar conexões ociosas (Connection reset by peer).
 * Ping periódico mantém o pool aquecido e força o Prisma a descartar sockets mortos.
 */
const KEEPALIVE_MS = Number(process.env.PRISMA_KEEPALIVE_MS ?? 60_000);
if (!globalForPrisma.prismaKeepalive) {
  globalForPrisma.prismaKeepalive = setInterval(() => {
    void prisma.$queryRaw`SELECT 1`.catch((err: unknown) => {
      logger.warn("prisma_keepalive_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, KEEPALIVE_MS);
  globalForPrisma.prismaKeepalive.unref?.();
}
