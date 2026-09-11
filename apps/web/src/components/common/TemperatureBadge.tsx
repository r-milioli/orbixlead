"use client";

import { Badge } from "@mantine/core";
import { normalizeTemperature } from "@/lib/types";
import { temperatureColors } from "@/theme/tokens";

const labels = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
} as const;

export function TemperatureBadge({ value }: { value?: string | null }) {
  const temp = normalizeTemperature(value);
  const palette = temperatureColors[temp];
  return (
    <Badge
      variant="light"
      styles={{
        root: {
          background: palette.bg,
          color: palette.color,
          textTransform: "none",
          fontWeight: 600,
        },
      }}
    >
      {labels[temp]}
    </Badge>
  );
}
