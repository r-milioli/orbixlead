"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  Archive,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  StickyNote,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { LeadCardMarker } from "@orbixlead/shared";
import type { Lead, PipelineStage } from "@/lib/types";
import {
  LEAD_CARD_MARKERS,
  cardMarkerMeta,
  cardMarkerStyle,
  normalizeCardMarker,
} from "@/lib/cardMarkers";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { colors, layout, shadows, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type Props = {
  stages: PipelineStage[];
  leadsByStage: Record<string, Lead[]>;
  onMove: (leadId: string, stageId: string) => Promise<void> | void;
  onCardMarkerChange?: (leadId: string, cardMarker: LeadCardMarker) => Promise<void> | void;
  canManageStages?: boolean;
  onRenameStage?: (stage: PipelineStage) => void;
  onArchiveStage?: (stage: PipelineStage) => void;
};

function MarkerSwatch({ marker, size = 12 }: { marker: LeadCardMarker; size?: number }) {
  const style = cardMarkerStyle(marker);
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: marker === "none" ? colors.surface : style.background,
        border: `2px solid ${marker === "none" ? colors.border : style.borderColor}`,
        flexShrink: 0,
      }}
    />
  );
}

export function KanbanBoard({
  stages,
  leadsByStage,
  onMove,
  onCardMarkerChange,
  canManageStages = false,
  onRenameStage,
  onArchiveStage,
}: Props) {
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [waLead, setWaLead] = useState<Lead | null>(null);

  const ordered = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const columnWidth = isMobile ? "min(280px, calc(100vw - 56px))" : 280;
  const menuWidth = isMobile ? "calc(100vw - 16px)" : 220;

  return (
    <>
      <ScrollArea
        type="auto"
        offsetScrollbars
        styles={{
          viewport: {
            scrollSnapType: isMobile ? "x mandatory" : undefined,
            WebkitOverflowScrolling: "touch",
          },
        }}
      >
        <div
          style={{
            display: "flex",
            gap: isMobile ? 10 : 12,
            minHeight: isMobile ? 420 : 520,
            paddingBottom: 8,
            paddingRight: isMobile ? 8 : 0,
          }}
        >
          {ordered.map((stage) => {
            const leads = leadsByStage[stage.id] || [];
            const isOver = overStageId === stage.id;
            const canArchive = stage.slug !== "new" && ordered.length > 1;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  if (isMobile) return;
                  e.preventDefault();
                  setOverStageId(stage.id);
                }}
                onDragLeave={() => {
                  setOverStageId((cur) => (cur === stage.id ? null : cur));
                }}
                onDrop={async (e) => {
                  if (isMobile) return;
                  e.preventDefault();
                  const leadId = e.dataTransfer.getData("text/lead-id");
                  setOverStageId(null);
                  setDraggingId(null);
                  if (leadId) {
                    await onMove(leadId, stage.id);
                  }
                }}
                style={{
                  width: columnWidth,
                  flexShrink: 0,
                  scrollSnapAlign: isMobile ? "start" : undefined,
                  background: isOver ? colors.primaryLight : colors.surfaceSecondary,
                  borderRadius: 8,
                  padding: isMobile ? 6 : 8,
                  border: isOver ? `1px dashed ${colors.primary}` : "1px solid transparent",
                  transition: "background .15s ease, border .15s ease",
                  minWidth: 0,
                }}
              >
                <Group justify="space-between" mb={8} px={4} pt={4} wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} c={colors.textPrimary} lineClamp={1}>
                      {stage.label}
                    </Text>
                    <Text size="xs" c={colors.textMuted}>
                      {leads.length}
                    </Text>
                  </div>
                  {canManageStages ? (
                    <Menu withinPortal position="bottom-end" width={menuWidth}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label={`Opções do estágio ${stage.label}`}
                        >
                          <MoreHorizontal size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                          onClick={() => onRenameStage?.(stage)}
                        >
                          Renomear
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                          disabled={!canArchive}
                          onClick={() => onArchiveStage?.(stage)}
                        >
                          Arquivar
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  ) : null}
                </Group>

                <Stack gap={8}>
                  {leads.map((lead) => {
                    const dragging = draggingId === lead.id;
                    const marker = normalizeCardMarker(lead.cardMarker);
                    const markerVisual = cardMarkerStyle(marker);
                    const markerInfo = cardMarkerMeta(marker);
                    const otherStages = ordered.filter((s) => s.id !== stage.id);
                    return (
                      <Paper
                        key={lead.id}
                        p="sm"
                        withBorder
                        draggable={!isMobile}
                        onDragStart={
                          isMobile
                            ? undefined
                            : (e) => {
                                e.dataTransfer.setData("text/lead-id", lead.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDraggingId(lead.id);
                              }
                        }
                        onDragEnd={
                          isMobile
                            ? undefined
                            : () => {
                                setDraggingId(null);
                                setOverStageId(null);
                              }
                        }
                        style={{
                          cursor: isMobile ? "default" : "grab",
                          opacity: dragging ? 0.65 : 1,
                          transform: dragging ? "rotate(1deg)" : undefined,
                          boxShadow: dragging ? shadows.md : shadows.xs,
                          borderColor: markerVisual.borderColor,
                          background: markerVisual.background,
                          minWidth: 0,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" mb={6} wrap="nowrap" gap={6}>
                          <UnstyledButton
                            component={Link}
                            href={`/crm/leads/${lead.id}`}
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <Text size="sm" fw={600} c={colors.textPrimary} lineClamp={2}>
                              {lead.companyName}
                            </Text>
                          </UnstyledButton>
                          <Menu withinPortal position="bottom-end" width={menuWidth}>
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onMouseDown={(e) => e.stopPropagation()}
                                aria-label={`Ações de ${lead.companyName}`}
                              >
                                <MoreHorizontal size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item component={Link} href={`/crm/leads/${lead.id}`}>
                                Abrir detalhes
                              </Menu.Item>
                              {otherStages.length > 0 ? (
                                <>
                                  <Menu.Divider />
                                  <Menu.Label>Mover para</Menu.Label>
                                  {otherStages.map((target) => (
                                    <Menu.Item
                                      key={target.id}
                                      onClick={() => void onMove(lead.id, target.id)}
                                    >
                                      {target.label}
                                    </Menu.Item>
                                  ))}
                                </>
                              ) : null}
                              {onCardMarkerChange ? (
                                <>
                                  <Menu.Divider />
                                  <Menu.Label>Destaque visual</Menu.Label>
                                  {LEAD_CARD_MARKERS.map((option) => (
                                    <Menu.Item
                                      key={option.value}
                                      leftSection={<MarkerSwatch marker={option.value} />}
                                      rightSection={
                                        marker === option.value ? (
                                          <Text size="xs" c={colors.primary}>
                                            ●
                                          </Text>
                                        ) : null
                                      }
                                      onClick={() => void onCardMarkerChange(lead.id, option.value)}
                                    >
                                      {option.label}
                                    </Menu.Item>
                                  ))}
                                </>
                              ) : null}
                            </Menu.Dropdown>
                          </Menu>
                        </Group>

                        {marker !== "none" ? (
                          <Text size="xs" c={colors.textSecondary} mb={4} fw={500}>
                            {markerInfo.label}
                          </Text>
                        ) : null}

                        <Text size="xs" c={colors.textMuted} mb={4} lineClamp={2}>
                          {[lead.city, lead.segment].filter(Boolean).join(" · ") || "—"}
                        </Text>

                        <Group gap={6} mb={4} wrap="wrap">
                          <TemperatureBadge value={lead.temperature} />
                          {lead.notes?.trim() ? (
                            <Tooltip
                              label={lead.notes.trim()}
                              multiline
                              maw={isMobile ? "calc(100vw - 32px)" : 280}
                              withArrow
                              position="top"
                              openDelay={200}
                              style={{ whiteSpace: "pre-wrap" }}
                            >
                              <ActionIcon
                                variant="light"
                                color="gray"
                                size="sm"
                                aria-label="Ver anotação do lead"
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ cursor: "help" }}
                              >
                                <StickyNote size={14} strokeWidth={ICON_STROKE} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null}
                          {lead.assignee ? (
                            <Badge
                              size="sm"
                              variant="light"
                              color="orbix"
                              leftSection={<UserRound size={11} />}
                              style={{ textTransform: "none", maxWidth: "100%" }}
                            >
                              <Text span size="xs" lineClamp={1} style={{ maxWidth: 120 }}>
                                {lead.assignee.name}
                              </Text>
                            </Badge>
                          ) : null}
                        </Group>

                        <Group gap={6} mt="sm">
                          <ActionIcon
                            variant="light"
                            color="gray"
                            component="a"
                            href={`tel:${lead.phoneE164}`}
                            title="Ligar"
                            aria-label="Ligar"
                          >
                            <Phone size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="orbix"
                            title="WhatsApp"
                            aria-label="WhatsApp"
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
