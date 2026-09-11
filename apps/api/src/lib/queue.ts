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
