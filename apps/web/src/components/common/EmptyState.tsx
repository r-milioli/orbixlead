"use client";

import { Center, Stack, Text, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { colors } from "@/theme/tokens";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <Center py={48} px="md">
      <Stack align="center" gap="sm" maw={360}>
        <Icon size={40} color={colors.textMuted} strokeWidth={1.5} />
        <Title order={4} c={colors.textPrimary} ta="center">
          {title}
        </Title>
        {description ? (
          <Text size="sm" c={colors.textMuted} ta="center">
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Center>
  );
}
