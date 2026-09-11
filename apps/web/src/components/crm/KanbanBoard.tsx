"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Group,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { MessageCircle, MoreHorizontal, Phone } from "lucide-react";
import Link from "next/link";
import type { Lead, PipelineStage } from "@/lib/types";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { colors, shadows } from "@/theme/tokens";

type Props = {
  stages: PipelineStage[];
  leadsByStage: Record<string, Lead[]>;
  onMove: (leadId: string, stageId: string) => Promise<void> | void;
};

export function KanbanBoard({ stages, leadsByStage, onMove }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [waLead, setWaLead] = useState<Lead | null>(null);

  const ordered = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  return (
    <>
      <ScrollArea type="auto" offsetScrollbars>
        <div
          style={{
            display: "flex",
            gap: 12,
            minHeight: 520,
            paddingBottom: 8,
          }}
        >
          {ordered.map((stage) => {
            const leads = leadsByStage[stage.id] || [];
            const isOver = overStageId === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStageId(stage.id);
                }}
                onDragLeave={() => {
                  setOverStageId((cur) => (cur === stage.id ? null : cur));
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const leadId = e.dataTransfer.getData("text/lead-id");
                  setOverStageId(null);
                  setDraggingId(null);
                  if (leadId) {
                    await onMove(leadId, stage.id);
                  }
                }}
                style={{
                  width: 280,
                  flexShrink: 0,
                  background: isOver ? colors.primaryLight : colors.surfaceSecondary,
                  borderRadius: 8,
                  padding: 8,
                  border: isOver ? `1px dashed ${colors.primary}` : "1px solid transparent",
                  transition: "background .15s ease, border .15s ease",
                }}
              >
                <Group justify="space-between" mb={8} px={4} pt={4}>
                  <div>
                    <Text size="sm" fw={600} c={colors.textPrimary}>
                      {stage.label}
                    </Text>
                    <Text size="xs" c={colors.textMuted}>
                      {leads.length}
                    </Text>
                  </div>
                </Group>

                <Stack gap={8}>
                  {leads.map((lead) => {
                    const dragging = draggingId === lead.id;
                    return (
                      <Paper
                        key={lead.id}
                        p="sm"
                        withBorder
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/lead-id", lead.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverStageId(null);
                        }}
                        style={{
                          cursor: "grab",
                          opacity: dragging ? 0.65 : 1,
                          transform: dragging ? "rotate(1deg)" : undefined,
                          boxShadow: dragging ? shadows.md : shadows.xs,
                          borderColor: colors.border,
                          background: colors.surface,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" mb={6}>
                          <UnstyledButton
                            component={Link}
                            href={`/crm/leads/${lead.id}`}
                            style={{ flex: 1 }}
                          >
                            <Text size="sm" fw={600} c={colors.textPrimary} lineClamp={2}>
                              {lead.companyName}
                            </Text>
                          </UnstyledButton>
                          <Menu withinPortal position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" size="sm">
                                <MoreHorizontal size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item component={Link} href={`/crm/leads/${lead.id}`}>
                                Abrir detalhes
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>

                        <Text size="xs" c={colors.textMuted} mb={4}>
                          {[lead.city, lead.segment].filter(Boolean).join(" · ") || "—"}
                        </Text>

                        <TemperatureBadge value={lead.temperature} />

                        <Group gap={6} mt="sm">
                          <ActionIcon
                            variant="light"
                            color="gray"
                            component="a"
                            href={`tel:${lead.phoneE164}`}
                            title="Ligar"
                          >
                            <Phone size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="orbix"
                            title="WhatsApp"
                            onClick={() => setWaLead(lead)}
                          >
                            <MessageCircle size={16} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {waLead ? (
        <WhatsAppModal
          opened={Boolean(waLead)}
          onClose={() => setWaLead(null)}
          phoneE164={waLead.phoneE164}
          companyName={waLead.companyName}
        />
      ) : null}
    </>
  );
}
