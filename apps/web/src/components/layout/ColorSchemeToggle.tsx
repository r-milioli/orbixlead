"use client";

import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { Moon, Sun } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computed === "dark";

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      onClick={() => setColorScheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      ) : (
        <Moon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      )}
    </ActionIcon>
  );
}
