"use client";

import { Group, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { colors, layout } from "@/theme/tokens";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });

  return (
    <Group
      justify="space-between"
      align={isMobile ? "stretch" : "flex-end"}
      gap={isMobile ? "sm" : "lg"}
      mb={isMobile ? 16 : 24}
      wrap="wrap"
      style={{ flexDirection: isMobile ? "column" : "row" }}
    >
      <div style={{ minWidth: 0, width: isMobile ? "100%" : undefined }}>
        <Title
          order={1}
          c={colors.textPrimary}
          style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
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
        <Group gap={8} wrap="wrap" grow={!!isMobile} w={isMobile ? "100%" : undefined}>
          {actions}
        </Group>
      ) : null}
    </Group>
  );
}
