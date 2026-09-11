"use client";

import { Group, Text, Title } from "@mantine/core";
import { colors } from "@/theme/tokens";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Group
      justify="space-between"
      align="flex-end"
      gap="lg"
      mb={24}
      wrap="wrap"
    >
      <div>
        <Title
          order={1}
          c={colors.textPrimary}
          style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" }}
        >
          {title}
        </Title>
        {subtitle ? (
          <Text size="sm" c={colors.textMuted} mt={6} style={{ fontWeight: 400 }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
      {actions ? (
        <Group gap={8} wrap="wrap">
          {actions}
        </Group>
      ) : null}
    </Group>
  );
}
