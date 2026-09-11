"use client";

import { Progress, Stack, Text, Group } from "@mantine/core";
import { Coins } from "lucide-react";
import { creditUiState } from "@orbixlead/shared";
import { colors } from "@/theme/tokens";

const stateColor = {
  normal: colors.primary,
  attention: colors.warning,
  critical: colors.danger,
  blocked: colors.danger,
} as const;

export function CreditsDisplay({
  remaining,
  cap,
  unlimited,
  compact = false,
}: {
  remaining: number;
  cap: number;
  unlimited?: boolean;
  compact?: boolean;
}) {
  if (unlimited) {
    return (
      <Group gap={6} wrap="nowrap">
        <Coins size={16} color={colors.primary} />
        <Text size="sm" fw={600} c={colors.textPrimary}>
          Ilimitado
        </Text>
      </Group>
    );
  }

  const state = creditUiState(remaining, cap);
  const pct = cap > 0 ? Math.min(100, Math.round((remaining / cap) * 100)) : 0;
  const color = stateColor[state];

  if (compact) {
    return (
      <Group gap={8} wrap="nowrap">
        <Coins size={16} color={color} />
        <Text size="sm" fw={600} c={colors.textPrimary}>
          {remaining.toLocaleString("pt-BR")} / {cap.toLocaleString("pt-BR")}
        </Text>
      </Group>
    );
  }

  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Group gap={6}>
          <Coins size={16} color={color} />
          <Text size="xs" fw={600} c={colors.textSecondary}>
            Créditos
          </Text>
        </Group>
        <Text size="xs" fw={700} c={colors.textPrimary}>
          {remaining.toLocaleString("pt-BR")} / {cap.toLocaleString("pt-BR")}
        </Text>
      </Group>
      <Progress value={pct} color={color} size="sm" radius="xl" />
    </Stack>
  );
}
