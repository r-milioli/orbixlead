import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import {
  JobCancelledError,
  notifyJobComplete,
  notifyJobFail,
  notifyJobStart,
} from "./api-client.js";
import { scrapeMaps } from "./maps.js";
import { scrapeMock } from "./mock.js";
import type { ScrapingJobData } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer monorepo root .env, then local overrides
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

// CONF-01: suporte a Docker Secrets via padrão *_FILE.
for (const name of ["INTERNAL_API_KEY", "REDIS_URL", "DATABASE_URL", "API_URL"]) {
  const filePath = process.env[`${name}_FILE`];
  if (!filePath || process.env[name]) continue;
  try {
    const value = fs.readFileSync(filePath, "utf8").trim();
    if (value) process.env[name] = value;
  } catch (err) {
    console.error(`[secrets] Falha ao ler ${name}_FILE: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const QUEUE_NAME = "scraping";
const MODE = (process.env.SCRAPER_MODE ?? "mock").toLowerCase();

function log(level: "info" | "error" | "warn", msg: string, meta?: unknown) {
  const line = { ts: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

async function processJob(job: Job<ScrapingJobData>): Promise<void> {
  const jobId = job.data?.jobId;
  if (!jobId) {
    throw new Error("Job payload missing jobId");
  }

  log("info", "job.received", {
    bullJobId: job.id,
    jobId,
    attempt: job.attemptsMade + 1,
    mode: MODE,
  });

  let started = false;
  const maxAttempts = job.opts.attempts ?? 1;
  const attempt = job.attemptsMade + 1;
  const isLastAttempt = attempt >= maxAttempts;

  try {
    const info = await notifyJobStart(jobId);
    started = true;
    log("info", "job.started", { jobId, city: info.city, segment: info.segment, quantity: info.quantity });

    const params = {
      city: info.city,
      segment: info.segment,
      quantity: info.quantity,
      country: info.country ?? job.data.country ?? "BR",
    };

    const results =
      MODE === "playwright"
        ? await scrapeMaps(params, (level, msg, meta) => log(level, msg, { jobId, ...meta }))
        : await scrapeMock(params);

    log("info", "job.scraped", { jobId, count: results.length, mode: MODE });

    await notifyJobComplete(jobId, results);
    log("info", "job.completed", { jobId, count: results.length });
  } catch (err) {
    if (err instanceof JobCancelledError) {
      log("info", "job.aborted_cancelled", { jobId });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    log("error", "job.failed", { jobId, message, attempt, maxAttempts, isLastAttempt });

    if (started) {
      try {
        await notifyJobFail(jobId, message, { final: isLastAttempt, attempt });
      } catch (notifyErr) {
        const notifyMessage = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
        // Job may have been cancelled while scraping — ignore late fail
        if (notifyMessage.includes("cancelled") || notifyMessage.includes("409")) {
          log("info", "job.fail_ignored_cancelled", { jobId });
          return;
        }
        log("error", "job.fail_notify_error", {
          jobId,
          message: notifyMessage,
        });
      }
    }

    // Re-throw so BullMQ records the attempt / can retry per producer settings
    throw err;
  }
}

function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }
  if (!process.env.API_URL) {
    throw new Error("API_URL is required");
  }
  if (!process.env.INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY is required");
  }
  if (MODE !== "mock" && MODE !== "playwright") {
    throw new Error(`SCRAPER_MODE must be mock|playwright, got: ${MODE}`);
  }

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Playwright pode levar vários minutos; default do BullMQ (30s) causa stall silencioso.
  const worker = new Worker<ScrapingJobData>(QUEUE_NAME, processJob, {
    connection,
    concurrency: 1,
    lockDuration: 12 * 60_000,
    stalledInterval: 60_000,
  });

  worker.on("ready", () => {
    log("info", "worker.ready", { queue: QUEUE_NAME, mode: MODE, concurrency: 1 });
  });

  worker.on("failed", (job, err) => {
    log("error", "worker.job_failed_event", {
      bullJobId: job?.id,
      jobId: job?.data?.jobId,
      message: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "worker.error", { message: err.message });
  });

  const shutdown = async (signal: string) => {
    log("info", "worker.shutdown", { signal });
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main();
