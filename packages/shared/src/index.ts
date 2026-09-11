export type Role = "super_admin" | "admin" | "operador";

export type Temperature = "frio" | "morno" | "quente";

export type PipelineSlug =
  | "new"
  | "contacted"
  | "scheduled"
  | "follow_up"
  | "converted"
  | "lost";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type CreditLedgerType =
  | "grant"
  | "reserve"
  | "settle"
  | "release"
  | "adjust";

export type GoalPeriodType = "monthly" | "weekly" | "daily";

export const PIPELINE_DEFAULT: { slug: PipelineSlug; label: string; position: number }[] = [
  { slug: "new", label: "Novos", position: 0 },
  { slug: "contacted", label: "Abordados", position: 1 },
  { slug: "scheduled", label: "Agendados", position: 2 },
  { slug: "follow_up", label: "Follow up", position: 3 },
  { slug: "converted", label: "Convertidos", position: 4 },
  { slug: "lost", label: "Perdidos", position: 5 },
];

export const CREDIT_PACKAGES = [500, 1500, 5000] as const;

export const MAX_LEADS_PER_JOB = 100;

export const KNOWN_PIPELINE_SLUGS: PipelineSlug[] = PIPELINE_DEFAULT.map((s) => s.slug);

const COMPANY_SUFFIXES =
  /\b(ltda|me|eireli|sa|s\/a|ss|epp|ei|ltda\.|s\.a\.)\b/gi;

export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize BR phone to E.164 (+55...). Returns null if invalid. */
export function normalizePhoneE164(raw: string, defaultCountry = "BR"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (defaultCountry === "BR") {
    if (normalized.startsWith("55") && normalized.length >= 12) {
      // already with country
    } else if (normalized.length === 10 || normalized.length === 11) {
      normalized = `55${normalized}`;
    } else if (normalized.length < 10) {
      return null;
    }
    if (normalized.length < 12 || normalized.length > 13) return null;
  }

  return `+${normalized}`;
}

export type ScoringInput = {
  rating?: number | null;
  reviewCount?: number | null;
  hasWebsite: boolean;
  socialCount: number;
};

function reviewsStrong(rating?: number | null, reviewCount?: number | null): boolean {
  const reviews = reviewCount ?? 0;
  const stars = rating ?? 0;
  return reviews >= 50 || (stars >= 4.5 && reviews >= 20);
}

function reviewsWeak(reviewCount?: number | null): boolean {
  return (reviewCount ?? 0) < 10;
}

export function scoreTemperature(input: ScoringInput): Temperature {
  const strong = reviewsStrong(input.rating, input.reviewCount);
  const weak = reviewsWeak(input.reviewCount);
  const hasSocial = input.socialCount >= 1;

  if (input.hasWebsite && hasSocial && strong) return "frio";
  if (!input.hasWebsite && weak) return "quente";
  if (!input.hasWebsite && (strong || hasSocial)) return "morno";
  return "morno";
}

export function goalMetrics(params: {
  precoVenda: number;
  conversoesAlvo: number;
  custoPorConversao: number;
}) {
  const faturamento = params.precoVenda * params.conversoesAlvo;
  const custoTotal = params.custoPorConversao * params.conversoesAlvo;
  const lucro = faturamento - custoTotal;
  const lucroPercent = faturamento > 0 ? lucro / faturamento : 0;
  return { faturamento, custoTotal, lucro, lucroPercent };
}

export function creditUiState(remaining: number, cap: number): "normal" | "attention" | "critical" | "blocked" {
  if (remaining <= 0) return "blocked";
  if (cap <= 0) return "normal";
  const pct = remaining / cap;
  if (pct < 0.1) return "critical";
  if (pct < 0.2) return "attention";
  return "normal";
}

export function maxJobQuantity(remaining: number, unlimited: boolean): number {
  if (unlimited) return MAX_LEADS_PER_JOB;
  return Math.min(remaining, MAX_LEADS_PER_JOB);
}

export function applyTemplate(
  template: string,
  vars: { nome?: string; empresa?: string }
): string {
  return template
    .replaceAll("{nome}", vars.nome ?? "")
    .replaceAll("{empresa}", vars.empresa ?? "");
}

export function buildWhatsAppUrl(phoneE164: string, message: string): string {
  const phone = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
