import type { Temperature } from "@orbixlead/shared";

/**
 * Minimal payload (user contract). API producer may also send city/segment/quantity
 * on the BullMQ job — those are used as fallback if /start is unavailable.
 */
export type ScrapingJobData = {
  jobId: string;
  tenantId?: string;
  country?: string;
  city?: string;
  segment?: string;
  quantity?: number;
};

/** Resposta de POST /internal/jobs/:id/start */
export type JobStartInfo = {
  id: string;
  city: string;
  segment: string;
  quantity: number;
  country?: string;
};

/** Item interno do scraper (API complete só exige subset). */
export type ScrapedResult = {
  companyName: string;
  phoneRaw?: string | null;
  phoneE164?: string | null;
  temperature: Temperature;
  rating?: number | null;
  reviewCount?: number | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  socialUrls?: string[];
  hasWebsite: boolean;
};

export type ScrapeParams = {
  city: string;
  segment: string;
  quantity: number;
  country?: string;
};
