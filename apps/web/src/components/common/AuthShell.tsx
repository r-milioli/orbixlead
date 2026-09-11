"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { colors } from "@/theme/tokens";

type AuthShellProps = {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ subtitle, children, footer }: AuthShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: `linear-gradient(180deg, ${colors.primaryLight} 0%, ${colors.background} 42%)`,
      }}
    >
      <Paper w="100%" maw={420} p="xl" withBorder radius="md" shadow="sm">
        <Stack gap="lg">
          <div>
            <Group gap={10} mb={8}>
              <Image src="/logo.png" alt="Orbixlead" width={44} height={44} priority />
              <Title order={2} style={{ letterSpacing: "-0.02em" }}>
                <Text span c={colors.primary} inherit>
                  Orbix
                </Text>
                <Text span c={colors.textPrimary} inherit>
                  lead
                </Text>
              </Title>
            </Group>
            <Text size="sm" c={colors.textSecondary}>
              {subtitle}
            </Text>
          </div>
          {children}
          {footer}
        </Stack>
      </Paper>
    </div>
  );
}
