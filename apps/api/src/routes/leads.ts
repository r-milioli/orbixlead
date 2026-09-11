import { Router } from "express";
import { z } from "zod";
import {
  normalizeCompanyName,
  normalizePhoneE164,
  scoreTemperature,
} from "@orbixlead/shared";
import { Role, Temperature } from "@prisma/client";
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
  softDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stage?: { id: string; slug: string; label: string };
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
    softDeletedAt: lead.softDeletedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/export",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const leads = await prisma.lead.findMany({
      where: { tenantId: req.user!.tenantId!, softDeletedAt: null },
      include: { stage: true },
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
    const leads = await prisma.lead.findMany({
      where: {
        tenantId: req.user!.tenantId!,
        softDeletedAt: null,
        ...(stageId ? { stageId } : {}),
      },
      include: { stage: true },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ leads: leads.map(serializeLead) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
      include: { stage: true, schedules: { orderBy: { scheduledAt: "asc" } } },
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
        include: { stage: true },
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

router.patch(
  "/:id/move",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ stageId: z.string() }).parse(req.body);
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId!, softDeletedAt: null },
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: body.stageId, tenantId: req.user!.tenantId! },
    });
    if (!stage) return res.status(400).json({ error: "Estágio inválido" });

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { stageId: stage.id },
      include: { stage: true },
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
      include: { stage: true },
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
