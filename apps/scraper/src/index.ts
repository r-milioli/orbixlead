import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Queue, Worker, type Job } from "bullmq";
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
/** Se há jobs waiting e o worker ficou ocioso além disso → exit(1) p/ Docker reiniciar. */
const STUCK_IDLE_MS = Number(process.env.SCRAPER_STUCK_IDLE_MS ?? 90_000);
const WATCHDOG_MS = Number(process.env.SCRAPER_WATCHDOG_MS ?? 30_000);
/**
 * Lock curto + renovação periódica: scrape longo continua ok enquanto o processo vive.
 * Se o container morrer, o job em `active` volta pra fila em ~LOCK_DURATION (não 12 min).
 */
const LOCK_DURATION_MS = Number(process.env.SCRAPER_LOCK_DURATION_MS ?? 120_000);
const LOCK_RENEW_MS = Number(process.env.SCRAPER_LOCK_RENEW_MS ?? 30_000);
const STALLED_INTERVAL_MS = Number(process.env.SCRAPER_STALLED_INTERVAL_MS ?? 30_000);

function log(level: "info" | "error" | "warn", msg: string, meta?: unknown) {
  const line = { ts: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

function redisConnectionOptions(redisUrl: string) {
  const parsed = new URL(redisUrl);
  const dbPath = parsed.pathname.replace("/", "");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: dbPath ? Number(dbPath) : 0,
    // Obrigatório para Worker BullMQ — não limitar retries em comandos bloqueantes.
    maxRetriesPerRequest: null as null,
    enableReadyCheck: true,
    connectTimeout: 10_000,
    // Preferir IPv4 (evita hang intermitente em hosts com AAAA quebrado).
    family: 4 as const,
    // Crítico em idle ~30–40min: firewall/Docker/Redis cortam TCP ocioso.
    // keepAlive manda ACK antes do corte e evita blocking client zumbi.
    keepAlive: 10_000,
    noDelay: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5_000);
      log("warn", "redis.retry", { times, delayMs: delay });
      return delay;
    },
  };
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

  // Passar options (não instância ioredis): BullMQ cria clients dedicados,
  // inclusive o blocking client do BZPOPMIN — mais estável após reconnect.
  const connection = redisConnectionOptions(redisUrl);

  const worker = new Worker<ScrapingJobData>(QUEUE_NAME, processJob, {
    connection,
    concurrency: 1,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_MS,
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: 2,
  });

  // Fila só para inspeção (watchdog) — connection options são clonadas pelo BullMQ.
  const inspectQueue = new Queue(QUEUE_NAME, { connection });

  let lastActivityAt = Date.now();
  let redisCloseAt: number | null = null;
  /** Desde quando há job em `waiting` sem `active` — NÃO usar idle desde o último job. */
  let waitingSince: number | null = null;
  const markActivity = () => {
    lastActivityAt = Date.now();
    redisCloseAt = null;
    waitingSince = null;
  };

  worker.on("ready", () => {
    markActivity();
    log("info", "worker.ready", {
      queue: QUEUE_NAME,
      mode: MODE,
      concurrency: 1,
      lockDurationMs: LOCK_DURATION_MS,
      lockRenewMs: LOCK_RENEW_MS,
      stalledIntervalMs: STALLED_INTERVAL_MS,
    });
    void (async () => {
      try {
        const counts = await inspectQueue.getJobCounts(
          "waiting",
          "delayed",
          "active",
          "paused",
          "failed",
          "completed"
        );
        log("info", "worker.boot_queue_snapshot", { counts });
        if ((counts.active ?? 0) > 0) {
          log("warn", "worker.boot_active_orphans", {
            active: counts.active,
            hint: `Jobs em active sem worker anterior serão recolocados após ~${LOCK_DURATION_MS}ms (stalled)`,
          });
        }
      } catch (err) {
        log("error", "worker.boot_snapshot_error", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  });

  worker.on("active", (job) => {
    markActivity();
    log("info", "worker.job_active", { bullJobId: job.id, jobId: job.data?.jobId });
  });

  worker.on("completed", (job) => {
    markActivity();
    log("info", "worker.job_completed_event", { bullJobId: job.id, jobId: job.data?.jobId });
  });

  worker.on("failed", (job, err) => {
    markActivity();
    log("error", "worker.job_failed_event", {
      bullJobId: job?.id,
      jobId: job?.data?.jobId,
      message: err.message,
    });
  });

  worker.on("stalled", (jobId) => {
    markActivity();
    log("warn", "worker.job_stalled", { bullJobId: jobId });
  });

  worker.on("error", (err) => {
    log("error", "worker.error", { message: err.message });
  });

  worker.on("ioredis:close", () => {
    redisCloseAt = Date.now();
    log("warn", "worker.redis_close", {});
  });

  /**
   * Sintoma observado em prod:
   * - Idle ~30–40min → TCP Redis morre; API ainda enfileira; worker não consome.
   * - Container cai mid-job → job fica em `active`; novo container sobe mas só
   *   reprocessa após stalled.
   *
   * BUG corrigido: NÃO usar idleMs desde o último job completo.
   * Após 65min idle, um job novo chegava e o watchdog matava em ~2s
   * (idleMs já era 3.9e6 ≥ 90s) — inclusive com job só em `delayed`.
   * Agora: só mata se `waiting` permanecer > 0 sem `active` por STUCK_IDLE_MS contínuos.
   * `delayed` não conta (backoff/agendamento — ainda não deve ser consumido).
   */
  const watchdog = setInterval(() => {
    void (async () => {
      try {
        if (!worker.isRunning()) {
          log("error", "worker.watchdog_not_running", {});
          process.exit(1);
        }

        // Redis close sem recuperação rápida → mata processo (Swarm sobe outro).
        if (redisCloseAt && Date.now() - redisCloseAt >= 60_000) {
          log("error", "worker.watchdog_redis_dead", {
            closedForMs: Date.now() - redisCloseAt,
          });
          process.exit(1);
        }

        const counts = await inspectQueue.getJobCounts(
          "waiting",
          "delayed",
          "active",
          "paused",
          "failed"
        );
        const waiting = counts.waiting ?? 0;
        const delayed = counts.delayed ?? 0;
        const active = counts.active ?? 0;
        const idleMs = Date.now() - lastActivityAt;

        if (waiting > 0 && active === 0) {
          if (waitingSince == null) waitingSince = Date.now();
          const waitingForMs = Date.now() - waitingSince;
          if (waitingForMs >= STUCK_IDLE_MS) {
            log("error", "worker.watchdog_stuck", {
              waiting,
              delayed,
              active,
              waitingForMs,
              idleMs,
              stuckIdleMs: STUCK_IDLE_MS,
              counts,
            });
            process.exit(1);
          }
        } else {
          waitingSince = null;
        }

        // Active órfão sem progresso além do lock+stalled → reinicia.
        if (
          waiting === 0 &&
          active > 0 &&
          idleMs >= LOCK_DURATION_MS + STALLED_INTERVAL_MS * 2
        ) {
          log("error", "worker.watchdog_active_orphan", {
            active,
            idleMs,
            counts,
          });
          process.exit(1);
        }

        if (waiting > 0 || delayed > 0 || active > 0) {
          log("info", "worker.watchdog_ok", {
            waiting,
            delayed,
            active,
            idleMs,
            waitingForMs: waitingSince != null ? Date.now() - waitingSince : 0,
            counts,
          });
        }
      } catch (err) {
        log("error", "worker.watchdog_error", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, WATCHDOG_MS);
  watchdog.unref?.();

  const shutdown = async (signal: string) => {
    log("info", "worker.shutdown", { signal });
    clearInterval(watchdog);
    try {
      await worker.close();
    } catch (err) {
      log("warn", "worker.close_error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      await inspectQueue.close();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    log("error", "process.unhandled_rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

main();
