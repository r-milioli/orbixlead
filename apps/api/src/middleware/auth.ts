import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeUser } from "../lib/serialize";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export type AuthedRequest = Request & {
  user?: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string | null;
    emailNotifyInvite: boolean;
    emailNotifyCapture: boolean;
    emailNotifyCredits: boolean;
    canCapture: boolean;
    createdAt: Date;
  };
};

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ error: "Não autenticado" });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    return next();
  };
}

export function requireTenant(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (req.user.role === Role.SUPER_ADMIN) {
    return res.status(403).json({ error: "Super admin não possui tenant" });
  }
  if (!req.user.tenantId) {
    return res.status(403).json({ error: "Usuário sem tenant" });
  }
  return next();
}

export async function mePayload(req: AuthedRequest) {
  const user = serializeUser(req.user!);
  if (!req.user!.tenantId) {
    return { user, tenant: null };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
  });

  return {
    user,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          unlimited: tenant.unlimited,
          creditCap: tenant.creditCap,
          creditRemaining: tenant.creditRemaining,
          cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
          avgLeadCost: tenant.avgLeadCost ? Number(tenant.avgLeadCost) : null,
        }
      : null,
  };
}
