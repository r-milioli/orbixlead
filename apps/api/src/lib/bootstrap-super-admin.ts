import bcrypt from "bcrypt";
import { Role, type User } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

const SETUP_LOCK_KEY = 87236401;

export async function hasSuperAdmin(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
  return count > 0;
}

export class SuperAdminSetupError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SuperAdminSetupError";
    this.status = status;
  }
}

export async function createFirstSuperAdmin(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const name = (input.name?.trim() || "Super Admin").slice(0, 80);
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;

    const existingAdmin = await tx.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new SuperAdminSetupError("O super admin já foi criado", 409);
    }

    const emailTaken = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailTaken) {
      throw new SuperAdminSetupError("Este e-mail já está em uso", 409);
    }

    return tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: Role.SUPER_ADMIN,
      },
    });
  });
}

export async function bootstrapSuperAdminFromEnv(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const email = process.env.SUPER_ADMIN_EMAIL || (isProd ? "" : process.env.SEED_SUPER_ADMIN_EMAIL);
  const password =
    process.env.SUPER_ADMIN_PASSWORD || (isProd ? "" : process.env.SEED_SUPER_ADMIN_PASSWORD);
  const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

  if (!email?.trim() || !password) {
    logger.info("super_admin_bootstrap_skipped", { reason: "env_not_set" });
    return;
  }

  if (password.length < 10) {
    logger.warn("super_admin_bootstrap_skipped", { reason: "password_too_short" });
    return;
  }

  if (await hasSuperAdmin()) {
    logger.info("super_admin_bootstrap_skipped", { reason: "already_exists" });
    return;
  }

  try {
    const user = await createFirstSuperAdmin({ email, password, name });
    logger.info("super_admin_bootstrapped", { email: user.email });
  } catch (err) {
    if (err instanceof SuperAdminSetupError && err.status === 409) {
      logger.info("super_admin_bootstrap_skipped", { reason: err.message });
      return;
    }
    logger.error("super_admin_bootstrap_failed", { err });
  }
}
