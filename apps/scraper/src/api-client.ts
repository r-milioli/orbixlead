import type { JobStartInfo, ScrapedResult } from "./types.js";

export class JobCancelledError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was cancelled`);
    this.name = "JobCancelledError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function baseUrl(): string {
  return requireEnv("API_URL").replace(/\/$/, "");
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-internal-key": requireEnv("INTERNAL_API_KEY"),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }

  return parseJson<T>(res);
}

/** Payload shape accepted by API complete endpoint (zod strips extras). */
function toApiResults(results: ScrapedResult[]) {
  return results.map((r) => ({
    companyName: r.companyName,
    ...(r.phoneRaw ? { phoneRaw: r.phoneRaw } : {}),
    ...(r.city ? { city: r.city } : {}),
    ...(r.address ? { address: r.address } : {}),
    ...(r.website ? { website: r.website } : {}),
    ...(r.mapsUrl ? { mapsUrl: r.mapsUrl } : {}),
    ...(r.socialUrls?.length ? { socialUrls: r.socialUrls } : {}),
    ...(typeof r.rating === "number" ? { rating: r.rating } : {}),
    ...(typeof r.reviewCount === "number" ? { reviewCount: r.reviewCount } : {}),
  }));
}

/**
 * Marks job as running and returns scrape parameters.
 * POST /api/v1/internal/jobs/:id/start
 */
export async function notifyJobStart(jobId: string): Promise<JobStartInfo> {
  const url = `${baseUrl()}/api/v1/internal/jobs/${jobId}/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
  });

  const text = await res.text().catch(() => "");
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  if (res.status === 409) {
    throw new JobCancelledError(jobId);
  }

  if (!res.ok) {
    throw new Error(`API POST /api/v1/internal/jobs/${jobId}/start → ${res.status}: ${text.slice(0, 400)}`);
  }

  const job =
    typeof data === "object" && data && "job" in data && (data as { job: JobStartInfo }).job
      ? (data as { job: JobStartInfo }).job
      : (data as JobStartInfo);

  if (!job?.id || !job.city || !job.segment || !job.quantity) {
    throw new Error(
      `Job start response missing required fields (id/city/segment/quantity): ${JSON.stringify(data)}`
    );
  }

  return {
    id: job.id,
    city: job.city,
    segment: job.segment,
    quantity: job.quantity,
    country: job.country ?? "BR",
  };
}

/**
 * Submits scraped results. API normalizes phone, scores, dedupes, settles credits.
 * POST /api/v1/internal/jobs/:id/complete  body: { results: [...] }
 */
export async function notifyJobComplete(
  jobId: string,
  results: ScrapedResult[]
): Promise<void> {
  await request("POST", `/api/v1/internal/jobs/${jobId}/complete`, {
    results: toApiResults(results),
  });
}

/**
 * Marks job failed (API releases reservation when final=true).
 * POST /api/v1/internal/jobs/:id/fail  body: { errorMessage, final?, attempt? }
 */
export async function notifyJobFail(
  jobId: string,
  message: string,
  opts?: { final?: boolean; attempt?: number }
): Promise<void> {
  await request("POST", `/api/v1/internal/jobs/${jobId}/fail`, {
    errorMessage: message,
    final: opts?.final ?? true,
    ...(opts?.attempt !== undefined ? { attempt: opts.attempt } : {}),
  });
}
