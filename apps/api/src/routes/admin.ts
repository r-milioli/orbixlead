import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { CREDIT_PACKAGES } from "@orbixlead/shared";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, serializeUser } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";
import { grantPackage } from "../services/credits";
import { createTenantWithDefaults } from "../services/tenants";

const router = Router();

router.use(requireAuth, requireRole(Role.SUPER_ADMIN));

router.get(
  "/tenants",
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, leads: true } } },
    });
    return res.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        unlimited: t.unlimited,
        creditCap: t.creditCap,
        creditRemaining: t.creditRemaining,
        cycleEndsAt: t.cycleEndsAt?.toISOString() ?? null,
        avgLeadCost: t.avgLeadCost ? Number(t.avgLeadCost) : null,
        usersCount: t._count.users,
        leadsCount: t._count.leads,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  })
);

router.post(
  "/tenants",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(2),
        adminEmail: z.string().email(),
        adminName: z.string().min(2),
        adminPassword: z.string().min(8),
        packageAmount: z.number().int().optional(),
        unlimited: z.boolean().optional(),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.adminEmail.toLowerCase() },
    });
    if (existing) {
      return res.status(400).json({ error: "E-mail já cadastrado" });
    }

    const packageAmount = body.packageAmount ?? 0;
    const cycleEndsAt = packageAmount > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

    const tenant = await createTenantWithDefaults({
      name: body.name,
      unlimited: body.unlimited ?? false,
      creditCap: packageAmount,
      creditRemaining: packageAmount,
      cycleEndsAt,
    });

    if (packageAmount > 0) {
      await prisma.creditLedger.create({
        data: {
          tenantId: tenant.id,
          type: "GRANT",
          amount: packageAmount,
          balanceAfter: packageAmount,
          createdById: req.user!.id,
          note: `Pacote inicial ${packageAmount}`,
        },
      });
    }

    const passwordHash = await bcrypt.hash(body.adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        email: body.adminEmail.toLowerCase(),
        name: body.adminName,
        passwordHash,
        role: Role.ADMIN,
        tenantId: tenant.id,
      },
    });

    return res.status(201).json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        unlimited: tenant.unlimited,
        creditCap: tenant.creditCap,
        creditRemaining: tenant.creditRemaining,
        cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
      },
      admin: serializeUser(admin),
    });
  })
);

router.post(
  "/tenants/:id/credits",
  asyncHandler(async (req: AuthedRequest, res) => {
    const amount = z
      .object({
        amount: z.number().int().positive(),
        note: z.string().optional(),
      })
      .parse(req.body);

    if (!(CREDIT_PACKAGES as readonly number[]).includes(amount.amount)) {
      return res.status(400).json({
        error: `Pacote inválido. Use: ${CREDIT_PACKAGES.join(", ")}`,
      });
    }

    const tenant = await grantPackage({
      tenantId: req.params.id,
      amount: amount.amount,
      createdById: req.user!.id,
      note: amount.note,
    });

    return res.json({
      tenant: {
        id: tenant.id,
        creditCap: tenant.creditCap,
        creditRemaining: tenant.creditRemaining,
        cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
      },
    });
  })
);

router.patch(
  "/tenants/:id/unlimited",
  asyncHandler(async (req, res) => {
    const body = z.object({ unlimited: z.boolean() }).parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { unlimited: body.unlimited },
    });
    return res.json({
      tenant: {
        id: tenant.id,
        unlimited: tenant.unlimited,
      },
    });
  })
);

router.get(
  "/tenants/:id/users",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ users: users.map(serializeUser) });
  })
);

export default router;
