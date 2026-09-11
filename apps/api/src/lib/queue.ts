import { Queue } from "bullmq";
import { redis } from "./redis";
import { logger } from "./logger";

export const SCRAPING_QUEUE = "scraping";
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
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function enqueueScrapingJob(payload: ScrapingJobPayload) {
  logger.info("scraping_enqueue_start", {
    jobId: payload.jobId,
    city: payload.city,
    segment: payload.segment,
    quantity: payload.quantity,
  });

  const added = await Promise.race([
    scrapingQueue.add("scrape", payload, { jobId: payload.jobId }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout ao enfileirar no Redis (${ENQUEUE_TIMEOUT_MS}ms)`));
      }, ENQUEUE_TIMEOUT_MS);
    }),
  ]);

  logger.info("scraping_enqueued", {
    jobId: payload.jobId,
    bullJobId: added.id,
    queue: SCRAPING_QUEUE,
  });
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
