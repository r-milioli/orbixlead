import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { creditUiState } from "@orbixlead/shared";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, serializeUser } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: req.user!.tenantId! },
    });

    const isAdmin = req.user!.role === Role.ADMIN;

    return res.json({
      settings: {
        avgLeadCost: isAdmin && tenant.avgLeadCost ? Number(tenant.avgLeadCost) : null,
        unlimited: isAdmin ? tenant.unlimited : undefined,
        creditCap: isAdmin ? tenant.creditCap : undefined,
        creditRemaining: isAdmin ? tenant.creditRemaining : undefined,
        cycleEndsAt: isAdmin ? (tenant.cycleEndsAt?.toISOString() ?? null) : undefined,
        creditState: isAdmin
          ? tenant.unlimited
            ? "normal"
            : creditUiState(tenant.creditRemaining, tenant.creditCap)
          : undefined,
        emailPrefs: {
          emailNotifyInvite: req.user!.emailNotifyInvite,
          emailNotifyCapture: req.user!.emailNotifyCapture,
          emailNotifyCredits: req.user!.emailNotifyCredits,
        },
      },
    });
  })
);

router.patch(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const isAdmin = req.user!.role === Role.ADMIN;
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        avgLeadCost: z.number().nonnegative().nullable().optional(),
        emailNotifyInvite: z.boolean().optional(),
        emailNotifyCapture: z.boolean().optional(),
        emailNotifyCredits: z.boolean().optional(),
      })
      .parse(req.body);

    if (body.avgLeadCost !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: "Sem permissão para alterar custo médio do lead" });
      }
      await prisma.tenant.update({
        where: { id: req.user!.tenantId! },
        data: { avgLeadCost: body.avgLeadCost },
      });
    }

    const userData: {
      name?: string;
      emailNotifyInvite?: boolean;
      emailNotifyCapture?: boolean;
      emailNotifyCredits?: boolean;
    } = {};
    if (body.name !== undefined) userData.name = body.name.trim();
    if (body.emailNotifyInvite !== undefined) userData.emailNotifyInvite = body.emailNotifyInvite;
    if (body.emailNotifyCapture !== undefined) userData.emailNotifyCapture = body.emailNotifyCapture;
    if (body.emailNotifyCredits !== undefined) userData.emailNotifyCredits = body.emailNotifyCredits;

    let user = req.user!;
    if (Object.keys(userData).length) {
      user = await prisma.user.update({
        where: { id: req.user!.id },
        data: userData,
      });
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: req.user!.tenantId! },
    });

    return res.json({
      settings: {
        avgLeadCost: isAdmin && tenant.avgLeadCost ? Number(tenant.avgLeadCost) : null,
        unlimited: isAdmin ? tenant.unlimited : undefined,
        creditCap: isAdmin ? tenant.creditCap : undefined,
        creditRemaining: isAdmin ? tenant.creditRemaining : undefined,
        cycleEndsAt: isAdmin ? (tenant.cycleEndsAt?.toISOString() ?? null) : undefined,
        creditState: isAdmin
          ? tenant.unlimited
            ? "normal"
            : creditUiState(tenant.creditRemaining, tenant.creditCap)
          : undefined,
        emailPrefs: {
          emailNotifyInvite: user.emailNotifyInvite,
          emailNotifyCapture: user.emailNotifyCapture,
          emailNotifyCredits: user.emailNotifyCredits,
        },
      },
      user: serializeUser(user),
    });
  })
);

router.post(
  "/password",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      })
      .parse(req.body);

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
    });

    if (!dbUser.passwordHash) {
      return res.status(400).json({ error: "Conta sem senha definida" });
    }

    const ok = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: "Senha atual incorreta" });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { passwordHash },
    });

    return res.json({ ok: true });
  })
);

export default router;
