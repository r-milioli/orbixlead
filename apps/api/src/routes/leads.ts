import { Router } from "express";
import { z } from "zod";
import {
  normalizeCompanyName,
  normalizePhoneE164,
  scoreTemperature,
} from "@orbixlead/shared";
import { LeadClosedReason, Role, Temperature } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

const tempToApi: Record<Temperature, string> = {
  FRIO: "frio",
  MORNO: "morno",
  QUENTE: "quente",
};

const tempFromScore: Record<string, Temperature> = {
  frio: Temperature.FRIO,
  morno: Temperature.MORNO,
  quente: Temperature.QUENTE,
};

const closedReasonToApi: Record<LeadClosedReason, string> = {
  CONVERTED: "converted",
  LOST: "lost",
};

function serializeLead(lead: {
  id: string;
  tenantId: string;
  stageId: string;
  companyName: string;
  phoneE164: string;
  temperature: Temperature;
  rating: number | null;
  reviewCount: number | null;
  city: string;
  state: string | null;
  country: string;
  address: string | null;
  website: string | null;
  mapsUrl: string | null;
  socialUrls: unknown;
  hasWebsite: boolean;
  segment: string | null;
  notes: string | null;
  closedAt: Date | null;
  closedReason: LeadClosedReason | null;
  assigneeId?: string | null;
  softDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stage?: { id: string; slug: string; label: string };
  assignee?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: lead.id,
    tenantId: lead.tenantId,
    stageId: lead.stageId,
    stage: lead.stage
      ? { id: lead.stage.id, slug: lead.stage.slug, label: lead.stage.label }
      : undefined,
    companyName: lead.companyName,
    phoneE164: lead.phoneE164,
    temperature: tempToApi[lead.temperature],
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    address: lead.address,
    website: lead.website,
    mapsUrl: lead.mapsUrl,
    socialUrls: lead.socialUrls,
    hasWebsite: lead.hasWebsite,
    segment: lead.segment,
    notes: lead.notes,
    closedAt: lead.closedAt?.toISOString() ?? null,
    closedReason: lead.closedReason ? closedReasonToApi[lead.closedReason] : null,
    assigneeId: lead.assigneeId ?? null,
    assignee: lead.assignee
      ? { id: lead.assignee.id, name: lead.assignee.name, email: lead.assignee.email }
      : null,
    softDeletedAt: lead.softDeletedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

const leadInclude = {
  stage: true,
  assignee: { select: { id: true, name: true, email: true } },
} as const;

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/export",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const leads = await prisma.lead.findMany({
      where: { tenantId: req.user!.tenantId!, softDeletedAt: null },
      include: leadInclude,
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "id",
      "companyName",
      "phoneE164",
      "temperature",
      "stage",
      "city",
      "state",
      "website",
      "mapsUrl",
      "segment",
      "closedAt",
      "closedReason",
      "createdAt",
    ];
    const rows = leads.map((l) =>
      [
        l.id,
        csvEscape(l.companyName),
        l.phoneE164,
        tempToApi[l.temperature],
        l.stage.slug,
        csvEscape(l.city),
        csvEscape(l.state ?? ""),
        csvEscape(l.website ?? ""),
        csvEscape(l.mapsUrl ?? ""),
        csvEscape(l.segment ?? ""),
        l.closedAt?.toISOString() ?? "",
        l.closedReason ? closedReasonToApi[l.closedReason] : "",
        l.createdAt.toISOString(),
      ].join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
    return res.send(csv);
  })
);

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const stageId = typeof req.query.stageId === "string" ? req.query.stageId : undefined;
    const statusRaw = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "open";
    const status = statusRaw === "closed" || statusRaw === "all" || statusRaw === "open" ? statusRaw : "open";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const segment = typeof req.query.segment === "string" ? req.query.segment.trim() : "";

    const leads = await prisma.lead.findMany({
      where: {
        tenantId: req.user!.tenantId!,
        softDeletedAt: null,
        ...(stageId ? { stageId } : {}),
        ...(status === "open" ? { closedAt: null } : {}),
        ...(status === "closed" ? { closedAt: { not: null } } : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(segment ? { segment: { contains: segment, mode: "insensitive" } } : {}),
        ...(q
          ? {
              OR: [
                { companyName: { contains: q, mode: "insensitive" } },
                { phoneE164: { contains: q } },
                { city: { contains: q, mode: "insensitive" } },
                { segment: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: leadInclude,
      orderBy: status === "closed" ? { closedAt: "desc" } : { updatedAt: "desc" },
      take: 500,
    });
    return res.json({ leads: leads.map(serializeLead) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
      include: { ...leadInclude, schedules: { orderBy: { scheduledAt: "asc" } } },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    return res.json({
      lead: {
        ...serializeLead(lead),
        schedules: lead.schedules.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt.toISOString(),
          reason: s.reason,
          notes: s.notes,
          status: s.status.toLowerCase(),
          cancelledAt: s.cancelledAt?.toISOString() ?? null,
        })),
      },
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        companyName: z.string().min(1),
        phone: z.string().min(8),
        city: z.string().min(1),
        state: z.string().optional(),
        website: z.string().url().optional().or(z.literal("")),
        mapsUrl: z.string().url().optional().or(z.literal("")),
        segment: z.string().optional(),
        notes: z.string().optional(),
        stageId: z.string().optional(),
        rating: z.number().min(0).max(5).optional(),
        reviewCount: z.number().int().min(0).optional(),
        socialUrls: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const phoneE164 = normalizePhoneE164(body.phone);
    if (!phoneE164) {
      return res.status(400).json({ error: "Telefone inválido" });
    }

    const companyNameNormalized = normalizeCompanyName(body.companyName);
    const hasWebsite = Boolean(body.website);
    const socialCount = body.socialUrls?.length ?? 0;
    const temperature = tempFromScore[
      scoreTemperature({
        rating: body.rating,
        reviewCount: body.reviewCount,
        hasWebsite,
        socialCount,
      })
    ];

    let stageId = body.stageId;
    if (!stageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { tenantId: req.user!.tenantId!, slug: "new" },
      });
      if (!stage) return res.status(500).json({ error: "Estágio 'new' não encontrado" });
      stageId = stage.id;
    } else {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: stageId, tenantId: req.user!.tenantId! },
      });
      if (!stage) return res.status(400).json({ error: "Estágio inválido" });
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          tenantId: req.user!.tenantId!,
          stageId,
          companyName: body.companyName,
          companyNameNormalized,
          phoneE164,
          temperature,
          rating: body.rating,
          reviewCount: body.reviewCount,
          city: body.city,
          state: body.state,
          website: body.website || null,
          mapsUrl: body.mapsUrl || null,
          socialUrls: body.socialUrls ?? [],
          hasWebsite,
          segment: body.segment,
          notes: body.notes,
        },
        include: leadInclude,
      });
      return res.status(201).json({ lead: serializeLead(lead) });
    } catch (err: unknown) {
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
        return res.status(409).json({ error: "Lead duplicado (telefone + empresa)" });
      }
      throw err;
    }
  })
);

router.post(
  "/:id/close",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        reason: z.enum(["converted", "lost"]),
      })
      .parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    if (lead.closedAt) {
      return res.status(400).json({ error: "Lead já está encerrado" });
    }

    const targetSlug = body.reason === "converted" ? "converted" : "lost";
    const stage = await prisma.pipelineStage.findFirst({
      where: { tenantId: req.user!.tenantId!, slug: targetSlug },
    });
    if (!stage) {
      return res.status(500).json({ error: `Estágio '${targetSlug}' não encontrado` });
    }

    const closedReason =
      body.reason === "converted" ? LeadClosedReason.CONVERTED : LeadClosedReason.LOST;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stageId: stage.id,
          closedAt: new Date(),
          closedReason,
        },
        include: leadInclude,
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.user!.tenantId!,
          userId: req.user!.id,
          action: "lead_close",
          entity: "Lead",
          entityId: lead.id,
          meta: {
            reason: body.reason,
            companyName: lead.companyName,
            assigneeId: lead.assigneeId,
          },
        },
      });
      return next;
    });

    return res.json({ lead: serializeLead(updated) });
  })
);

router.patch(
  "/:id/assignee",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        assigneeId: z.string().nullable(),
      })
      .parse(req.body);

    const tenantId = req.user!.tenantId!;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    if (lead.closedAt) {
      return res.status(400).json({
        error: "Lead encerrado — reabra antes de alterar o acompanhamento",
      });
    }

    const isAdmin = req.user!.role === Role.ADMIN;
    const currentAssigneeId = lead.assigneeId;

    if (body.assigneeId === null) {
      if (!currentAssigneeId) {
        const current = await prisma.lead.findFirstOrThrow({
          where: { id: lead.id },
          include: leadInclude,
        });
        return res.json({ lead: serializeLead(current) });
      }
      if (!isAdmin && currentAssigneeId !== req.user!.id) {
        return res.status(403).json({
          error: "Somente o operador responsável ou um admin pode liberar o acompanhamento",
        });
      }

      const updated = await prisma.lead.update({
        where: { id: lead.id },
        data: { assigneeId: null },
        include: leadInclude,
      });
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user!.id,
          action: "lead_assignee_release",
          entity: "Lead",
          entityId: lead.id,
          meta: { previousAssigneeId: currentAssigneeId },
        },
      });
      return res.json({ lead: serializeLead(updated) });
    }

    const target = await prisma.user.findFirst({
      where: { id: body.assigneeId, tenantId, role: Role.OPERADOR },
    });
    if (!target) {
      return res.status(400).json({ error: "Operador inválido" });
    }

    if (currentAssigneeId && currentAssigneeId !== body.assigneeId && !isAdmin) {
      return res.status(403).json({
        error: "Este lead já está sendo acompanhado por outro operador",
      });
    }

    if (!currentAssigneeId && !isAdmin && body.assigneeId !== req.user!.id) {
      return res.status(403).json({
        error: "Você só pode assumir o acompanhamento para si",
      });
    }

    if (currentAssigneeId === body.assigneeId) {
      const current = await prisma.lead.findFirstOrThrow({
        where: { id: lead.id },
        include: leadInclude,
      });
      return res.json({ lead: serializeLead(current) });
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { assigneeId: target.id },
      include: leadInclude,
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: req.user!.id,
        action: currentAssigneeId ? "lead_assignee_change" : "lead_assignee_claim",
        entity: "Lead",
        entityId: lead.id,
        meta: {
          previousAssigneeId: currentAssigneeId,
          assigneeId: target.id,
        },
      },
    });
    return res.json({ lead: serializeLead(updated) });
  })
);

router.post(
  "/:id/reopen",
  asyncHandler(async (req: AuthedRequest, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    if (!lead.closedAt) {
      return res.status(400).json({ error: "Lead não está encerrado" });
    }

    const followUp = await prisma.pipelineStage.findFirst({
      where: { tenantId: req.user!.tenantId!, slug: "follow_up" },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.lead.update({
        where: { id: lead.id },
        data: {
          closedAt: null,
          closedReason: null,
          ...(followUp ? { stageId: followUp.id } : {}),
        },
        include: leadInclude,
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.user!.tenantId!,
          userId: req.user!.id,
          action: "lead_reopen",
          entity: "Lead",
          entityId: lead.id,
          meta: { companyName: lead.companyName },
        },
      });
      return next;
    });

    return res.json({ lead: serializeLead(updated) });
  })
);

router.patch(
  "/:id/move",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ stageId: z.string() }).parse(req.body);
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    if (lead.closedAt) {
      return res.status(400).json({ error: "Lead encerrado — reabra antes de mover no pipeline" });
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: body.stageId, tenantId: req.user!.tenantId! },
    });
    if (!stage) return res.status(400).json({ error: "Estágio inválido" });

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { stageId: stage.id },
      include: leadInclude,
    });
    return res.json({ lead: serializeLead(updated) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        notes: z.string().optional(),
        stageId: z.string().optional(),
      })
      .parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    if (body.stageId) {
      if (lead.closedAt) {
        return res.status(400).json({ error: "Lead encerrado — reabra antes de mudar o estágio" });
      }
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, tenantId: req.user!.tenantId! },
      });
      if (!stage) return res.status(400).json({ error: "Estágio inválido" });
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.stageId ? { stageId: body.stageId } : {}),
      },
      include: leadInclude,
    });
    return res.json({ lead: serializeLead(updated) });
  })
);

router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { softDeletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: req.user!.tenantId!,
          userId: req.user!.id,
          action: "soft_delete",
          entity: "Lead",
          entityId: lead.id,
          meta: { companyName: lead.companyName, phoneE164: lead.phoneE164 },
        },
      }),
    ]);

    return res.json({ ok: true });
  })
);

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default router;
