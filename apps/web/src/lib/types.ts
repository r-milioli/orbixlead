export type PipelineStage = {
  id: string;
  slug: string;
  label: string;
  position: number;
};

export type Lead = {
  id: string;
  companyName: string;
  phoneE164: string;
  temperature: "FRIO" | "MORNO" | "QUENTE" | "frio" | "morno" | "quente";
  rating?: number | null;
  reviewCount?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  socialUrls?: string[] | Record<string, string> | null;
  hasWebsite?: boolean;
  segment?: string | null;
  notes?: string | null;
  stageId: string;
  stage?: PipelineStage;
  closedAt?: string | null;
  closedReason?: "converted" | "lost" | "CONVERTED" | "LOST" | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  softDeletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ScrapingJob = {
  id: string;
  country: string;
  city: string;
  segment: string;
  quantity: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "queued" | "running" | "completed" | "failed" | "cancelled";
  reservedCredits: number;
  settledCredits: number;
  newCount: number;
  existingCount: number;
  discardedCount: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ScrapingResult = {
  id: string;
  jobId: string;
  companyName: string;
  phoneRaw?: string | null;
  phoneE164?: string | null;
  temperature?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  socialUrls?: unknown;
  hasWebsite: boolean;
  isDuplicate: boolean;
  discarded: boolean;
  softDeletedAt?: string | null;
  leadId?: string | null;
};

export type MessageTemplate = {
  id: string;
  name: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ScheduleItem = {
  id: string;
  leadId: string;
  scheduledAt: string;
  reason: string;
  notes?: string | null;
  status?: "scheduled" | "cancelled" | "SCHEDULED" | "CANCELLED";
  cancelledAt?: string | null;
  lead?: Pick<Lead, "id" | "companyName" | "phoneE164">;
  createdAt?: string;
  updatedAt?: string;
};

export type Goal = {
  id: string;
  name: string;
  periodType: "MONTHLY" | "WEEKLY" | "DAILY" | "monthly" | "weekly" | "daily";
  scope?: "company" | "operator" | "COMPANY" | "OPERATOR";
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  parentId?: string | null;
  year: number;
  month?: number | null;
  week?: number | null;
  day?: number | null;
  targetConversions: number;
  precoVenda: number | string;
  custoPorConversao: number | string;
  convertedCount?: number;
  children?: Goal[];
  createdAt?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};

export type DashboardData = {
  scope?: "company" | "operator";
  kpis?: {
    conversionRate?: number;
    costPerConversion?: number | null;
    leadsLast7Days?: number;
    convertedLast7Days?: number;
    importedToday?: number;
    convertedToday?: number;
  };
  funnel?: { slug: string; label: string; count: number }[];
  period?: {
    importedLeads?: number;
    conversions?: number;
    avgLeadCost?: number;
    costPerConversion?: number | null;
  };
  goal?: {
    id: string;
    name: string;
    target: number;
    current: number;
    progress: number;
    scope?: "company" | "operator";
    assigneeId?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
  } | null;
  availableGoals?: {
    id: string;
    name: string;
    scope: "company" | "operator";
    assigneeId?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
    target: number;
    current: number;
    progress: number;
  }[];
  companyGoals?: {
    id: string;
    name: string;
    target: number;
    current: number;
    progress: number;
  }[];
  operatorGoals?: {
    id: string;
    name: string;
    target: number;
    current: number;
    progress: number;
    assignee?: { id: string; name: string; email: string } | null;
  }[];
  prospection30d?: { day: string; imported: number; converted: number }[];
  conversionsBySegment?: { segment: string; count: number }[];
  upcomingSchedules?: number;
};

export type TenantAdmin = {
  id: string;
  name: string;
  unlimited: boolean;
  creditCap: number;
  creditRemaining: number;
  cycleEndsAt?: string | null;
  createdAt?: string;
  _count?: { users?: number; leads?: number };
};

export function normalizeTemperature(
  value?: string | null
): "frio" | "morno" | "quente" {
  const v = (value || "morno").toLowerCase();
  if (v === "frio") return "frio";
  if (v === "quente") return "quente";
  return "morno";
}

export function normalizeJobStatus(status: string): string {
  return status.toLowerCase();
}
