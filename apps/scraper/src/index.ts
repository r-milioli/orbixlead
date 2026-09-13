import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Queue, QueueEvents, Worker, type Job } from "bullmq";
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
/** Deve ser idêntico ao da API — Redis compartilhado na VPS. */
const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "orbixlead";
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
/** Heartbeat em idle: prova nos logs que o processo segue vivo sem job. */
const IDLE_HEARTBEAT_MS = Number(process.env.SCRAPER_IDLE_HEARTBEAT_MS ?? 300_000);

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
    connectionName: `orbixlead-scraper:${process.env.HOSTNAME ?? "unknown"}`,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5_000);
      log("warn", "redis.retry", { times, delayMs: delay });
      return delay;
    },
  };
}

/** Preenchido em main() — heartbeat durante scrape longo. */
let onJobPulse: (() => void) | null = null;

async function processJob(job: Job<ScrapingJobData>): Promise<void> {
  // Log ANTES de validar — se faltar jobId, ainda aparece nos logs (Macaé: failed sem received).
  log("info", "job.received", {
    bullJobId: job.id,
    jobId: job.data?.jobId ?? null,
    attempt: job.attemptsMade + 1,
    mode: MODE,
    dataKeys: job.data ? Object.keys(job.data) : [],
  });

  const jobId = job.data?.jobId ?? (typeof job.id === "string" ? job.id : null);
  if (!jobId) {
    throw new Error(`Job payload missing jobId (bullJobId=${job.id})`);
  }

  let started = false;
  const maxAttempts = job.opts.attempts ?? 1;
  const attempt = job.attemptsMade + 1;
  const isLastAttempt = attempt >= maxAttempts;

  // Evita idleMs crescer durante Playwright (scrape pode passar de 3–12 min).
  const pulse = setInterval(() => {
    onJobPulse?.();
  }, 20_000);
  pulse.unref?.();

  try {
    let info: Awaited<ReturnType<typeof notifyJobStart>>;
    try {
      info = await notifyJobStart(jobId);
    } catch (startErr) {
      // Fallback: payload BullMQ já traz city/segment/quantity (producer API).
      const city = job.data?.city;
      const segment = job.data?.segment;
      const quantity = job.data?.quantity;
      if (city && segment && typeof quantity === "number" && quantity > 0) {
        log("warn", "job.start_fallback_payload", {
          jobId,
          message: startErr instanceof Error ? startErr.message : String(startErr),
          city,
          segment,
          quantity,
        });
        info = {
          id: jobId,
          city,
          segment,
          quantity,
          country: job.data.country ?? "BR",
        };
      } else {
        throw startErr;
      }
    }
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
        ? await scrapeMaps(params, (level, msg, meta) => {
            onJobPulse?.();
            log(level, msg, { jobId, ...meta });
          })
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
  } finally {
    clearInterval(pulse);
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
    prefix: BULLMQ_PREFIX,
    concurrency: 1,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_MS,
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: 2,
    name: `scraper:${process.env.HOSTNAME ?? "unknown"}:${process.pid}`,
  });

  // Fila só para inspeção (watchdog) — connection options são clonadas pelo BullMQ.
  const inspectQueue = new Queue(QUEUE_NAME, { connection, prefix: BULLMQ_PREFIX });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection, prefix: BULLMQ_PREFIX });

  let lastActivityAt = Date.now();
  let lastIdleHeartbeatAt = Date.now();
  let redisCloseAt: number | null = null;
  /** Desde quando há job em `waiting` sem `active` — NÃO usar idle desde o último job. */
  let waitingSince: number | null = null;
  /** Delayed “vencido” sem promoção — possível blocking client morto. */
  let overdueDelayedSince: number | null = null;
  const markActivity = () => {
    lastActivityAt = Date.now();
    redisCloseAt = null;
    waitingSince = null;
    overdueDelayedSince = null;
  };
  onJobPulse = markActivity;

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    log("error", "queue.job_failed_event", { bullJobId: jobId, failedReason });
  });
  queueEvents.on("delayed", ({ jobId, delay }) => {
    log("warn", "queue.job_delayed_event", { bullJobId: jobId, delay });
  });
  queueEvents.on("stalled", ({ jobId }) => {
    log("warn", "queue.job_stalled_event", { bullJobId: jobId });
  });

  worker.on("ready", () => {
    markActivity();
    log("info", "worker.ready", {
      queue: QUEUE_NAME,
      prefix: BULLMQ_PREFIX,
      mode: MODE,
      concurrency: 1,
      lockDurationMs: LOCK_DURATION_MS,
      lockRenewMs: LOCK_RENEW_MS,
      stalledIntervalMs: STALLED_INTERVAL_MS,
      pid: process.pid,
      hostname: process.env.HOSTNAME ?? null,
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
        // Se aparecer mais de 1 worker, outro container/processo está roubando a fila.
        const peers = await inspectQueue.getWorkers();
        log(peers.length > 1 ? "warn" : "info", "worker.peers", {
          count: peers.length,
          peers: peers.map((p) => ({
            id: p.id,
            name: p.name,
            addr: p.addr,
            age: p.age,
            idle: p.idle,
          })),
        });
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
   * - waiting > 0 sem active por STUCK_IDLE_MS contínuos → exit (blocking client morto).
   * - delayed NÃO conta (backoff).
   * - NÃO matar por "active órfão" via idleMs: scrape Playwright >3min é normal;
   *   BullMQ stalled + lock renew cuidam de crash mid-job.
   */
  const watchdog = setInterval(() => {
    void (async () => {
      try {
        if (!worker.isRunning()) {
          log("error", "worker.watchdog_not_running", {});
          process.exit(1);
        }

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

        // Delayed vencido (backoff já passou) sem virar waiting/active → investigar / reiniciar.
        if (delayed > 0 && waiting === 0 && active === 0) {
          const delayedJobs = await inspectQueue.getDelayed(0, 10);
          const now = Date.now();
          const overdue = delayedJobs.filter((j) => {
            const when = (j.timestamp ?? 0) + (j.opts.delay ?? 0);
            return when <= now;
          });
          for (const j of overdue.slice(0, 3)) {
            log("warn", "worker.delayed_job_detail", {
              bullJobId: j.id,
              jobId: j.data?.jobId ?? null,
              attemptsMade: j.attemptsMade,
              failedReason: j.failedReason ?? null,
              delay: j.opts.delay ?? null,
              timestamp: j.timestamp,
              dataKeys: j.data ? Object.keys(j.data) : [],
            });
          }
          if (overdue.length > 0) {
            if (overdueDelayedSince == null) overdueDelayedSince = Date.now();
            const overdueForMs = Date.now() - overdueDelayedSince;
            if (overdueForMs >= STUCK_IDLE_MS) {
              log("error", "worker.watchdog_delayed_stuck", {
                delayed,
                overdue: overdue.length,
                overdueForMs,
                counts,
              });
              process.exit(1);
            }
          } else {
            overdueDelayedSince = null;
          }
        } else {
          overdueDelayedSince = null;
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
        } else if (Date.now() - lastIdleHeartbeatAt >= IDLE_HEARTBEAT_MS) {
          lastIdleHeartbeatAt = Date.now();
          log("info", "worker.idle_heartbeat", {
            idleMs,
            running: worker.isRunning(),
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
      await queueEvents.close();
    } catch {
      // ignore
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
