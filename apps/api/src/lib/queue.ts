import { Queue } from "bullmq";
import { redis } from "./redis";
import { logger } from "./logger";

export const SCRAPING_QUEUE = "scraping";
/** Prefixo obrigatório: Redis da VPS é compartilhado com outros stacks (fila "scraping" colide). */
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "orbixlead";
const ENQUEUE_TIMEOUT_MS = 10_000;

export type ScrapingJobPayload = {
  jobId: string;
  tenantId: string;
  country: string;
  city: string;
  segment: string;
  quantity: number;
};

export const scrapingQueue = new Queue<ScrapingJobPayload>(SCRAPING_QUEUE, {
  connection: redis.duplicate(),
  prefix: BULLMQ_PREFIX,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

/**
 * BullMQ: add() com jobId existente em failed/completed devolve o job antigo
 * e NÃO reenfileira. Remove leftovers antes de criar.
 */
async function clearStaleJob(jobId: string): Promise<void> {
  const existing = await scrapingQueue.getJob(jobId);
  if (!existing) return;
  const state = await existing.getState();
  logger.warn("scraping_enqueue_stale_job", {
    jobId,
    state,
    attemptsMade: existing.attemptsMade,
    failedReason: existing.failedReason ?? null,
  });
  if (state === "completed" || state === "failed" || state === "delayed" || state === "waiting") {
    try {
      await existing.remove();
    } catch {
      try {
        await existing.discard();
      } catch {
        // segue — add pode falhar e a API trata
      }
    }
  }
}

export async function enqueueScrapingJob(payload: ScrapingJobPayload) {
  logger.info("scraping_enqueue_start", {
    jobId: payload.jobId,
    city: payload.city,
    segment: payload.segment,
    quantity: payload.quantity,
    prefix: BULLMQ_PREFIX,
    queue: SCRAPING_QUEUE,
  });

  await clearStaleJob(payload.jobId);

  const added = await Promise.race([
    scrapingQueue.add("scrape", payload, { jobId: payload.jobId }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout ao enfileirar no Redis (${ENQUEUE_TIMEOUT_MS}ms)`));
      }, ENQUEUE_TIMEOUT_MS);
    }),
  ]);

  const state = await added.getState();
  logger.info("scraping_enqueued", {
    jobId: payload.jobId,
    bullJobId: added.id,
    queue: SCRAPING_QUEUE,
    prefix: BULLMQ_PREFIX,
    state,
    attemptsMade: added.attemptsMade,
    failedReason: added.failedReason ?? null,
  });

  if (state === "failed" || state === "completed") {
    throw new Error(
      `Job ${payload.jobId} ficou em estado "${state}" após enqueue (possível colisão de jobId no Redis)`
    );
  }

  return added;
}

/** Remove job from BullMQ (waiting/delayed/active if possible). */
export async function removeScrapingJob(jobId: string): Promise<boolean> {
  const job = await scrapingQueue.getJob(jobId);
  if (!job) return false;
  try {
    await job.remove();
    return true;
  } catch {
    try {
      await job.discard();
      return true;
    } catch {
      return false;
    }
  }
}
