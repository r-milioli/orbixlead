import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const schedules = await prisma.schedule.findMany({
      where: {
        tenantId: req.user!.tenantId!,
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        lead: { select: { id: true, companyName: true, phoneE164: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return res.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        leadId: s.leadId,
        lead: s.lead,
        scheduledAt: s.scheduledAt.toISOString(),
        reason: s.reason,
        notes: s.notes,
        createdById: s.createdById,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        leadId: z.string(),
        scheduledAt: z.string().datetime(),
        reason: z.string().min(1),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: req.user!.tenantId!,
        leadId: lead.id,
        scheduledAt: new Date(body.scheduledAt),
        reason: body.reason,
        notes: body.notes,
        createdById: req.user!.id,
      },
      include: { lead: { select: { id: true, companyName: true, phoneE164: true } } },
    });

    return res.status(201).json({
      schedule: {
        id: schedule.id,
        leadId: schedule.leadId,
        lead: schedule.lead,
        scheduledAt: schedule.scheduledAt.toISOString(),
        reason: schedule.reason,
        notes: schedule.notes,
        createdById: schedule.createdById,
        createdAt: schedule.createdAt.toISOString(),
      },
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!schedule) return res.status(404).json({ error: "Agendamento não encontrado" });
    await prisma.schedule.delete({ where: { id: schedule.id } });
    return res.json({ ok: true });
  })
);

export default router;
