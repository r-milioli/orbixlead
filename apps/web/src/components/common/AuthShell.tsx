"use client";

import { ReactNode } from "react";
import { Paper, Stack, Text } from "@mantine/core";
import { BrandLogo } from "@/components/common/BrandLogo";
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
            <BrandLogo size={44} wordmarkAs="title" priority />
            <Text size="sm" c={colors.textSecondary} mt={8}>
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
