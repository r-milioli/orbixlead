import { Role } from "@prisma/client";

export const roleToApi: Record<Role, string> = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  OPERADOR: "operador",
};

export const roleFromApi: Record<string, Role> = {
  super_admin: Role.SUPER_ADMIN,
  admin: Role.ADMIN,
  operador: Role.OPERADOR,
};

export function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  emailNotifyInvite: boolean;
  emailNotifyCapture: boolean;
  emailNotifyCredits: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roleToApi[user.role],
    tenantId: user.tenantId,
    emailNotifyInvite: user.emailNotifyInvite,
    emailNotifyCapture: user.emailNotifyCapture,
    emailNotifyCredits: user.emailNotifyCredits,
    createdAt: user.createdAt.toISOString(),
  };
}

export function asyncHandler(
  fn: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<unknown>
) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
