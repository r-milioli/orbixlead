"use client";

import Image from "next/image";
import { Box, Group, Text, Title, useComputedColorScheme } from "@mantine/core";
import { colors } from "@/theme/tokens";

type BrandLogoProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkAs?: "text" | "title";
  collapsed?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  size = 36,
  showWordmark = true,
  wordmarkAs = "text",
  collapsed = false,
  priority = false,
}: BrandLogoProps) {
  const scheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = scheme === "dark";
  const src = isDark ? "/logo-white.png" : "/logo.png";
  const markSize = collapsed ? Math.max(size, 40) : size;

  const wordmark =
    wordmarkAs === "title" ? (
      <Title order={2} style={{ letterSpacing: "-0.02em" }}>
        <Text span c={colors.primary} inherit>
          Orbix
        </Text>
        <Text span c={colors.textPrimary} inherit>
          lead
        </Text>
      </Title>
    ) : (
      <Text fw={700} size="lg" style={{ letterSpacing: "-0.02em" }}>
        <Text span c={colors.primary} inherit>
          Orbix
        </Text>
        <Text span c={colors.textPrimary} inherit>
          lead
        </Text>
      </Text>
    );

  return (
    <Group
      gap={10}
      wrap="nowrap"
      justify={collapsed ? "center" : "flex-start"}
      w={collapsed ? "100%" : undefined}
    >
      <Box
        style={{
          width: markSize,
          height: markSize,
          flexShrink: 0,
          position: "relative",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Image
          key={src}
          src={src}
          alt="Orbixlead"
          width={markSize}
          height={markSize}
          priority={priority}
          style={{ objectFit: "contain", width: "100%", height: "100%" }}
        />
      </Box>
      {showWordmark && !collapsed ? wordmark : null}
    </Group>
  );
}
