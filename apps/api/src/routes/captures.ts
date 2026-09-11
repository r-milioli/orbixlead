import { Router } from "express";
import { z } from "zod";
import { maxJobQuantity, normalizeCompanyName } from "@orbixlead/shared";
import { JobStatus, Prisma, Role, Temperature } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { enqueueScrapingJob, removeScrapingJob } from "../lib/queue";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";
import { releaseReservation, reserve } from "../services/credits";

const router = Router();

const tempToApi: Record<Temperature, string> = {
  FRIO: "frio",
  MORNO: "morno",
  QUENTE: "quente",
};

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/results",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.user!.tenantId!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const segment = typeof req.query.segment === "string" ? req.query.segment.trim() : "";
    const site = typeof req.query.site === "string" ? req.query.site : "all";
    const origin = typeof req.query.origin === "string" ? req.query.origin : "all";
    const onlyAvailable = req.query.onlyAvailable === "1" || req.query.onlyAvailable === "true";
    const temperaturesRaw = typeof req.query.temperatures === "string" ? req.query.temperatures : "";
    const temperatures = temperaturesRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const tempFilter =
      temperatures.length > 0
        ? temperatures
            .map((t) => {
              if (t === "frio") return Temperature.FRIO;
              if (t === "morno") return Temperature.MORNO;
              if (t === "quente") return Temperature.QUENTE;
              return null;
            })
            .filter((t): t is Temperature => t != null)
        : [];

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const jobWhere: {
      tenantId: string;
      createdAt?: { gte?: Date; lt?: Date };
    } = { tenantId };

    if (origin === "today") {
      jobWhere.createdAt = { gte: dayStart };
    } else if (origin === "previous") {
      jobWhere.createdAt = { lt: dayStart };
    }

    const results = await prisma.scrapingResult.findMany({
      where: {
        softDeletedAt: null,
        discarded: false,
        job: {
          ...jobWhere,
          ...(segment ? { segment: { contains: segment, mode: "insensitive" } } : {}),
        },
        ...(onlyAvailable ? { leadId: null, isDuplicate: false } : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(tempFilter.length ? { temperature: { in: tempFilter } } : {}),
        ...(site === "with" ? { hasWebsite: true } : {}),
        ...(site === "without" ? { hasWebsite: false } : {}),
        ...(q
          ? {
              OR: [
                { companyName: { contains: q, mode: "insensitive" } },
                { phoneE164: { contains: q } },
                { phoneRaw: { contains: q } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        job: { select: { id: true, city: true, segment: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return res.json({
      results: results.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        companyName: r.companyName,
        phoneRaw: r.phoneRaw,
        phoneE164: r.phoneE164,
        temperature: r.temperature ? tempToApi[r.temperature] : null,
        rating: r.rating,
        reviewCount: r.reviewCount,
        city: r.city ?? r.job.city,
        address: r.address,
        website: r.website,
        mapsUrl: r.mapsUrl,
        socialUrls: r.socialUrls,
        hasWebsite: r.hasWebsite,
        isDuplicate: r.isDuplicate,
        discarded: r.discarded,
        leadId: r.leadId,
        segment: r.job.segment,
        jobCreatedAt: r.job.createdAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
    });
  })
);

router.get(
  "/jobs",
  asyncHandler(async (req: AuthedRequest, res) => {
    const takeRaw = typeof req.query.take === "string" ? Number(req.query.take) : 50;
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 100) : 50;

    const jobs = await prisma.scrapingJob.findMany({
      where: { tenantId: req.user!.tenantId! },
      orderBy: { createdAt: "desc" },
      take,
    });

    return res.json({ jobs: jobs.map(serializeJob) });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        city: z.string().min(1),
        segment: z.string().min(1),
        quantity: z.number().int().positive(),
        country: z.string().default("BR"),
      })
      .parse(req.body);

    if (body.country !== "BR") {
      return res.status(400).json({ error: "MVP suporta apenas Brasil (BR)" });
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: req.user!.tenantId! },
    });

    const maxQty = maxJobQuantity(tenant.creditRemaining, tenant.unlimited);
    if (body.quantity > maxQty) {
      return res.status(400).json({
        error: `Quantidade máxima permitida: ${maxQty}`,
      });
    }

    const job = await prisma.scrapingJob.create({
      data: {
        tenantId: tenant.id,
        requestedById: req.user!.id,
        country: body.country,
        city: body.city,
        segment: body.segment,
        quantity: body.quantity,
        status: "QUEUED",
        reservedCredits: body.quantity,
      },
    });

    try {
      await reserve({
        tenantId: tenant.id,
        amount: body.quantity,
        jobId: job.id,
        createdById: req.user!.id,
        note: `Reserva captura ${job.id}`,
      });
    } catch (err) {
      await prisma.scrapingJob.delete({ where: { id: job.id } });
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
      return res.status(status).json({
        error: err instanceof Error ? err.message : "Falha ao reservar créditos",
      });
    }

    await enqueueScrapingJob({
      jobId: job.id,
      tenantId: tenant.id,
      country: body.country,
      city: body.city,
      segment: body.segment,
      quantity: body.quantity,
    });

    return res.status(201).json({ job: serializeJob(job) });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req: AuthedRequest, res) => {
    const job = await prisma.scrapingJob.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });

    if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) {
      return res.status(400).json({
        error: "Só é possível cancelar capturas na fila ou em processamento",
      });
    }

    await removeScrapingJob(job.id);

    const releaseAmount = Math.max(0, job.reservedCredits - job.settledCredits);
    if (releaseAmount > 0) {
      await releaseReservation({
        tenantId: job.tenantId,
        amount: releaseAmount,
        jobId: job.id,
        note: `Release cancelamento captura ${job.id}`,
      });
    }

    const logs = Array.isArray(job.logs) ? [...(job.logs as unknown[])] : [];
    logs.push({ at: new Date().toISOString(), message: "user.cancel" });

    const updated = await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.CANCELLED,
        errorMessage: "Cancelado pelo usuário",
        finishedAt: new Date(),
        logs: logs as Prisma.InputJsonValue,
      },
    });

    return res.json({ job: serializeJob(updated) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const job = await prisma.scrapingJob.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    return res.json({ job: serializeJob(job) });
  })
);

router.get(
  "/:id/results",
  asyncHandler(async (req: AuthedRequest, res) => {
    const job = await prisma.scrapingJob.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });

    const results = await prisma.scrapingResult.findMany({
      where: { jobId: job.id, softDeletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      results: results.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        companyName: r.companyName,
        phoneRaw: r.phoneRaw,
        phoneE164: r.phoneE164,
        temperature: r.temperature ? tempToApi[r.temperature] : null,
        rating: r.rating,
        reviewCount: r.reviewCount,
        city: r.city,
        address: r.address,
        website: r.website,
        mapsUrl: r.mapsUrl,
        socialUrls: r.socialUrls,
        hasWebsite: r.hasWebsite,
        isDuplicate: r.isDuplicate,
        discarded: r.discarded,
        leadId: r.leadId,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  })
);

router.delete(
  "/results/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await prisma.scrapingResult.findFirst({
      where: { id: req.params.id, softDeletedAt: null },
      include: { job: true },
    });
    if (!result || result.job.tenantId !== req.user!.tenantId) {
      return res.status(404).json({ error: "Resultado não encontrado" });
    }

    await prisma.scrapingResult.update({
      where: { id: result.id },
      data: { softDeletedAt: new Date() },
    });

    return res.json({ ok: true });
  })
);

router.post(
  "/send-to-crm",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        resultIds: z.array(z.string()).min(1),
      })
      .parse(req.body);

    const results = await prisma.scrapingResult.findMany({
      where: {
        id: { in: body.resultIds },
        softDeletedAt: null,
        discarded: false,
        isDuplicate: false,
        phoneE164: { not: null },
        job: { tenantId: req.user!.tenantId! },
      },
      include: { job: true },
    });

    const stage = await prisma.pipelineStage.findFirst({
      where: { tenantId: req.user!.tenantId!, slug: "new" },
    });
    if (!stage) return res.status(500).json({ error: "Estágio 'new' não encontrado" });

    const created: string[] = [];
    const skipped: string[] = [];

    for (const result of results) {
      const phoneE164 = result.phoneE164!;
      const companyNameNormalized = normalizeCompanyName(result.companyName);

      const existing = await prisma.lead.findFirst({
        where: {
          tenantId: req.user!.tenantId!,
          phoneE164,
          companyNameNormalized,
          softDeletedAt: null,
        },
      });

      if (existing) {
        await prisma.scrapingResult.update({
          where: { id: result.id },
          data: { leadId: existing.id, isDuplicate: true },
        });
        skipped.push(result.id);
        continue;
      }

      try {
        const lead = await prisma.lead.create({
          data: {
            tenantId: req.user!.tenantId!,
            stageId: stage.id,
            companyName: result.companyName,
            companyNameNormalized,
            phoneE164,
            temperature: result.temperature ?? Temperature.MORNO,
            rating: result.rating,
            reviewCount: result.reviewCount,
            city: result.city ?? result.job.city,
            address: result.address,
            website: result.website,
            mapsUrl: result.mapsUrl,
            socialUrls: result.socialUrls ?? undefined,
            hasWebsite: result.hasWebsite,
            segment: result.job.segment,
            scrapingJobId: result.jobId,
          },
        });
        await prisma.scrapingResult.update({
          where: { id: result.id },
          data: { leadId: lead.id },
        });
        created.push(lead.id);
      } catch (err: unknown) {
        if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
          skipped.push(result.id);
          continue;
        }
        throw err;
      }
    }

    return res.json({
      createdCount: created.length,
      skippedCount: skipped.length,
      leadIds: created,
      skippedResultIds: skipped,
    });
  })
);

function serializeJob(job: {
  id: string;
  tenantId: string;
  country: string;
  city: string;
  segment: string;
  quantity: number;
  status: string;
  reservedCredits: number;
  settledCredits: number;
  newCount: number;
  existingCount: number;
  discardedCount: number;
  errorMessage: string | null;
  attempt: number;
  logs: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: job.id,
    tenantId: job.tenantId,
    country: job.country,
    city: job.city,
    segment: job.segment,
    quantity: job.quantity,
    status: job.status.toLowerCase(),
    reservedCredits: job.reservedCredits,
    settledCredits: job.settledCredits,
    newCount: job.newCount,
    existingCount: job.existingCount,
    discardedCount: job.discardedCount,
    errorMessage: job.errorMessage,
    attempt: job.attempt,
    logs: job.logs,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  };
}

export default router;
