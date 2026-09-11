import type { LeadCardMarker } from "@orbixlead/shared";
import { LEAD_CARD_MARKERS } from "@orbixlead/shared";

export { LEAD_CARD_MARKERS };
export type { LeadCardMarker };

export function normalizeCardMarker(value?: string | null): LeadCardMarker {
  const found = LEAD_CARD_MARKERS.find((m) => m.value === value);
  return found?.value ?? "none";
}

export function cardMarkerStyle(marker?: string | null): {
  background: string;
  borderColor: string;
} {
  const key = normalizeCardMarker(marker);
  if (key === "none") {
    return {
      background: "var(--orbix-surface)",
      borderColor: "var(--orbix-border)",
    };
  }
  return {
    background: `var(--orbix-card-${key}-bg)`,
    borderColor: `var(--orbix-card-${key}-border)`,
  };
}

export function cardMarkerMeta(marker?: string | null) {
  const key = normalizeCardMarker(marker);
  return LEAD_CARD_MARKERS.find((m) => m.value === key)!;
}
