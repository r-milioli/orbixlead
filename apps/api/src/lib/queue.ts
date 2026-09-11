import { Queue } from "bullmq";
import { redis } from "./redis";

export const SCRAPING_QUEUE = "scraping";

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
  return scrapingQueue.add("scrape", payload, { jobId: payload.jobId });
}

/** Remove job from BullMQ (waiting/delayed/active if possible). */
export async function removeScrapingJob(jobId: string): Promise<boolean> {
  const job = await scrapingQueue.getJob(jobId);
  if (!job) return false;
  try {
    await job.remove();
    return true;
  } catch {
    // Active jobs may not remove cleanly; try discard
    try {
      await job.discard();
      return true;
    } catch {
      return false;
    }
  }
}
