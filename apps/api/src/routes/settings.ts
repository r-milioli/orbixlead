import { Router } from "express";
import { z } from "zod";
import { creditUiState } from "@orbixlead/shared";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, serializeUser } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: req.user!.tenantId! },
    });

    return res.json({
      settings: {
        avgLeadCost: tenant.avgLeadCost ? Number(tenant.avgLeadCost) : null,
        unlimited: tenant.unlimited,
        creditCap: tenant.creditCap,
        creditRemaining: tenant.creditRemaining,
        cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
        creditState: tenant.unlimited
          ? "normal"
          : creditUiState(tenant.creditRemaining, tenant.creditCap),
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
        avgLeadCost: tenant.avgLeadCost ? Number(tenant.avgLeadCost) : null,
        unlimited: tenant.unlimited,
        creditCap: tenant.creditCap,
        creditRemaining: tenant.creditRemaining,
        cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
        creditState: tenant.unlimited
          ? "normal"
          : creditUiState(tenant.creditRemaining, tenant.creditCap),
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

export default router;
