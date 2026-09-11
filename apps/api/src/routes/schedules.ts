import { Router } from "express";
import { z } from "zod";
import { Role, ScheduleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

function serializeSchedule(s: {
  id: string;
  leadId: string;
  scheduledAt: Date;
  reason: string;
  notes: string | null;
  status: ScheduleStatus;
  cancelledAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lead?: { id: string; companyName: string; phoneE164: string } | null;
}) {
  return {
    id: s.id,
    leadId: s.leadId,
    lead: s.lead ?? undefined,
    scheduledAt: s.scheduledAt.toISOString(),
    reason: s.reason,
    notes: s.notes,
    status: s.status.toLowerCase(),
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    createdById: s.createdById,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    const statusRaw = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "all";
    const statusFilter =
      statusRaw === "scheduled"
        ? ScheduleStatus.SCHEDULED
        : statusRaw === "cancelled"
          ? ScheduleStatus.CANCELLED
          : undefined;

    const schedules = await prisma.schedule.findMany({
      where: {
        tenantId: req.user!.tenantId!,
        ...(statusFilter ? { status: statusFilter } : {}),
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
      schedules: schedules.map(serializeSchedule),
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
        status: ScheduleStatus.SCHEDULED,
      },
      include: { lead: { select: { id: true, companyName: true, phoneE164: true } } },
    });

    return res.status(201).json({ schedule: serializeSchedule(schedule) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        scheduledAt: z.string().datetime().optional(),
        reason: z.string().min(1).optional(),
        notes: z.string().nullable().optional(),
        /** Reagendar também reativa se estava cancelado. */
        reactivate: z.boolean().optional(),
      })
      .parse(req.body);

    if (
      body.scheduledAt === undefined &&
      body.reason === undefined &&
      body.notes === undefined &&
      body.reactivate === undefined
    ) {
      return res.status(400).json({ error: "Nada para atualizar" });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!schedule) return res.status(404).json({ error: "Agendamento não encontrado" });

    const shouldReactivate =
      body.reactivate === true ||
      (schedule.status === ScheduleStatus.CANCELLED && body.scheduledAt !== undefined);

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        ...(body.scheduledAt !== undefined ? { scheduledAt: new Date(body.scheduledAt) } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(shouldReactivate
          ? { status: ScheduleStatus.SCHEDULED, cancelledAt: null }
          : {}),
      },
      include: { lead: { select: { id: true, companyName: true, phoneE164: true } } },
    });

    return res.json({ schedule: serializeSchedule(updated) });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req: AuthedRequest, res) => {
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!schedule) return res.status(404).json({ error: "Agendamento não encontrado" });
    if (schedule.status === ScheduleStatus.CANCELLED) {
      return res.status(400).json({ error: "Agendamento já está cancelado" });
    }

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: ScheduleStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: { lead: { select: { id: true, companyName: true, phoneE164: true } } },
    });

    return res.json({ schedule: serializeSchedule(updated) });
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
