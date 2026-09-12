import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import {
  normalizeCompanyName,
  normalizePhoneE164,
  scoreTemperature,
} from "@orbixlead/shared";
import { JobStatus, Prisma, Temperature } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { logger } from "../lib/logger";
import { releaseReservation, settle } from "../services/credits";
import { sendMail } from "../lib/mailer";

const router = Router();

function timingSafeEquals(a: string, b: string): boolean {
  // SEC-09: comparação em tempo constante. Só compara se os tamanhos baterem
  // (o próprio timingSafeEqual exige buffers de mesmo tamanho).
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireInternalKey(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const key = (req.header("x-internal-key") ?? "").trim();
  const expected = (process.env.INTERNAL_API_KEY ?? "").trim();
  if (!expected || !key || !timingSafeEquals(key, expected)) {
    logger.warn("internal_unauthorized", {
      path: req.originalUrl,
      method: req.method,
      hasHeader: Boolean(key),
      hasExpected: Boolean(expected),
    });
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

// OBS-01: log por-request das rotas internas só em desenvolvimento (reduz ruído/PII em prod).
if (process.env.NODE_ENV !== "production") {
  router.use((req, _res, next) => {
    logger.info("internal_request", {
      method: req.method,
      path: req.originalUrl,
      contentType: req.header("content-type") ?? null,
      contentLength: req.header("content-length") ?? null,
    });
    return next();
  });
}
router.use(requireInternalKey);

const tempFromScore: Record<string, Temperature> = {
  frio: Temperature.FRIO,
  morno: Temperature.MORNO,
  quente: Temperature.QUENTE,
};

/** Scraper: mark running and return scrape params. */
router.post(
  "/jobs/:id/start",
  asyncHandler(async (req, res) => {
    const job = await prisma.scrapingJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status === JobStatus.CANCELLED) {
      return res.status(409).json({ error: "cancelled", status: "cancelled" });
    }
    if (
      job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED
    ) {
      return res.status(400).json({ error: "Job já finalizado" });
    }

    const logs = Array.isArray(job.logs) ? [...(job.logs as unknown[])] : [];
    logs.push({ at: new Date().toISOString(), message: "scraper.start" });

    const updated = await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.RUNNING,
        startedAt: job.startedAt ?? new Date(),
        attempt: job.attempt + 1,
        logs: logs as Prisma.InputJsonValue,
      },
    });

    return res.json({
      id: updated.id,
      city: updated.city,
      segment: updated.segment,
      quantity: updated.quantity,
      country: updated.country,
      status: "running",
    });
  })
);

router.post(
  "/jobs/:id/progress",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(["running", "queued"]).optional(),
        attempt: z.number().int().optional(),
        log: z.string().optional(),
        startedAt: z.string().datetime().optional(),
      })
      .parse(req.body);

    const job = await prisma.scrapingJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status === JobStatus.CANCELLED) {
      return res.json({ ok: true, ignored: true, status: "cancelled" });
    }

    const logs = Array.isArray(job.logs) ? [...(job.logs as unknown[])] : [];
    if (body.log) {
      logs.push({ at: new Date().toISOString(), message: body.log });
    }

    const updated = await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: body.status === "running" ? JobStatus.RUNNING : body.status === "queued" ? JobStatus.QUEUED : undefined,
        attempt: body.attempt,
        logs: logs as Prisma.InputJsonValue,
        startedAt: body.startedAt ? new Date(body.startedAt) : job.startedAt ?? (body.status === "running" ? new Date() : undefined),
      },
    });

    return res.json({ ok: true, jobId: updated.id, status: updated.status.toLowerCase() });
  })
);

router.post(
  "/jobs/:id/complete",
  asyncHandler(async (req, res) => {
    logger.info("internal_complete_received", {
      jobId: req.params.id,
      resultCount: Array.isArray(req.body?.results) ? req.body.results.length : 0,
    });
    const body = z
      .object({
        results: z
          .array(
            z.object({
              companyName: z.string(),
              phoneRaw: z.string().optional(),
              city: z.string().optional(),
              address: z.string().optional(),
              website: z.string().optional(),
              mapsUrl: z.string().optional(),
              socialUrls: z.array(z.string()).max(50).optional(),
              rating: z.number().optional(),
              reviewCount: z.number().int().optional(),
            })
          )
          .max(1000)
          .default([]),
        logs: z.array(z.unknown()).max(1000).optional(),
      })
      .parse(req.body);

    const job = await prisma.scrapingJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status === JobStatus.CANCELLED) {
      return res.json({ ok: true, ignored: true, status: "cancelled" });
    }
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      return res.status(400).json({ error: "Job já finalizado" });
    }

    let newCount = 0;
    let existingCount = 0;
    let discardedCount = 0;

    for (const item of body.results) {
      const phoneE164 = item.phoneRaw ? normalizePhoneE164(item.phoneRaw) : null;
      if (!phoneE164) {
        discardedCount += 1;
        continue;
      }

      const companyNameNormalized = normalizeCompanyName(item.companyName);
      const socialUrls = item.socialUrls ?? [];
      const hasWebsite = Boolean(item.website);
      const temperature = tempFromScore[
        scoreTemperature({
          rating: item.rating,
          reviewCount: item.reviewCount,
          hasWebsite,
          socialCount: socialUrls.length,
        })
      ];

      const duplicate = await prisma.lead.findFirst({
        where: {
          tenantId: job.tenantId,
          phoneE164,
          companyNameNormalized,
          softDeletedAt: null,
        },
      });

      if (duplicate) {
        existingCount += 1;
        await prisma.scrapingResult.create({
          data: {
            jobId: job.id,
            companyName: item.companyName,
            phoneRaw: item.phoneRaw,
            phoneE164,
            temperature,
            rating: item.rating,
            reviewCount: item.reviewCount,
            city: item.city,
            address: item.address,
            website: item.website,
            mapsUrl: item.mapsUrl,
            socialUrls,
            hasWebsite,
            isDuplicate: true,
            discarded: false,
            leadId: duplicate.id,
          },
        });
        continue;
      }

      newCount += 1;
      await prisma.scrapingResult.create({
        data: {
          jobId: job.id,
          companyName: item.companyName,
          phoneRaw: item.phoneRaw,
          phoneE164,
          temperature,
          rating: item.rating,
          reviewCount: item.reviewCount,
          city: item.city,
          address: item.address,
          website: item.website,
          mapsUrl: item.mapsUrl,
          socialUrls,
          hasWebsite,
          isDuplicate: false,
          discarded: false,
        },
      });
    }

    const settledCredits = newCount;
    const releaseAmount = Math.max(0, job.reservedCredits - settledCredits);

    await settle({
      tenantId: job.tenantId,
      amount: settledCredits,
      jobId: job.id,
      note: `Settle captura ${job.id}`,
    });
    await releaseReservation({
      tenantId: job.tenantId,
      amount: releaseAmount,
      jobId: job.id,
      note: `Release captura ${job.id}`,
    });

    const updated = await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        settledCredits,
        newCount,
        existingCount,
        discardedCount,
        finishedAt: new Date(),
        logs: (body.logs as Prisma.InputJsonValue) ?? undefined,
      },
    });

    const users = await prisma.user.findMany({
      where: {
        tenantId: job.tenantId,
        OR: [{ role: "ADMIN" }, { id: job.requestedById }],
      },
    });

    if (users.length) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          title: "Captura concluída",
          body: `Job em ${job.city}/${job.segment}: ${newCount} novos, ${existingCount} existentes.`,
        })),
      });

      for (const u of users) {
        if (u.emailNotifyCapture) {
          await sendMail({
            to: u.email,
            subject: "Captura concluída — Orbixlead",
            text: `Sua captura em ${job.city} (${job.segment}) terminou com ${newCount} leads novos.`,
          });
        }
      }
    }

    return res.json({
      ok: true,
      job: {
        id: updated.id,
        status: "completed",
        settledCredits,
        newCount,
        existingCount,
        discardedCount,
      },
    });
  })
);

router.post(
  "/jobs/:id/fail",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        errorMessage: z.string().min(1),
        attempt: z.number().int().optional(),
        logs: z.array(z.unknown()).optional(),
        final: z.boolean().optional(),
      })
      .parse(req.body);

    const job = await prisma.scrapingJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status === JobStatus.CANCELLED) {
      return res.json({ ok: true, ignored: true, status: "cancelled" });
    }
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      return res.status(400).json({ error: "Job já finalizado" });
    }

    const isFinal = body.final ?? true;

    if (isFinal) {
      await releaseReservation({
        tenantId: job.tenantId,
        amount: job.reservedCredits - job.settledCredits,
        jobId: job.id,
        note: `Release falha captura ${job.id}`,
      });
    }

    const updated = await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: isFinal ? JobStatus.FAILED : JobStatus.QUEUED,
        errorMessage: body.errorMessage,
        attempt: body.attempt ?? job.attempt + 1,
        finishedAt: isFinal ? new Date() : null,
        logs: (body.logs as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return res.json({
      ok: true,
      job: {
        id: updated.id,
        status: updated.status.toLowerCase(),
        errorMessage: updated.errorMessage,
      },
    });
  })
);

export default router;
