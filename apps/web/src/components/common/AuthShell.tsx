"use client";

import { ReactNode } from "react";
import { Paper, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { BrandLogo } from "@/components/common/BrandLogo";
import { colors, layout } from "@/theme/tokens";

type AuthShellProps = {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ subtitle, children, footer }: AuthShellProps) {
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: isMobile ? "16px 12px" : 24,
        background: `linear-gradient(180deg, ${colors.primaryLight} 0%, ${colors.background} 42%)`,
      }}
    >
      <Paper
        w="100%"
        maw={420}
        p={isMobile ? "md" : "xl"}
        withBorder
        radius="md"
        shadow="sm"
        style={{ minWidth: 0 }}
      >
        <Stack gap={isMobile ? "md" : "lg"}>
          <div>
            <BrandLogo size={isMobile ? 36 : 44} wordmarkAs="title" priority />
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
