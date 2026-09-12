import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { loadSecretsFromFiles } from "./secrets-file";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

// CONF-01: garante que DATABASE_URL via *_FILE (Docker Secrets) seja carregado
// antes de o PrismaClient ser instanciado.
loadSecretsFromFiles();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
