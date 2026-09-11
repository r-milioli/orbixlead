"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput, DateTimePicker } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  Building2,
  Calendar,
  CalendarClock,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Phone,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { api, ApiError } from "@/lib/api";
import type { ScheduleItem } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors, layout, ICON_SIZE, ICON_STROKE, radius, shadows } from "@/theme/tokens";

dayjs.locale("pt-br");

type RangePreset = "today" | "week" | "month" | "custom";
type EditMode = "edit" | "reschedule";

function presetRange(preset: Exclude<RangePreset, "custom">): [Date, Date] {
  const now = dayjs();
  if (preset === "today") {
    return [now.startOf("day").toDate(), now.endOf("day").toDate()];
  }
  if (preset === "month") {
    return [now.startOf("month").toDate(), now.endOf("month").toDate()];
  }
  return [now.startOf("week").toDate(), now.endOf("week").toDate()];
}

function scheduleTone(item: ScheduleItem): "cancelled" | "past" | "today" | "upcoming" {
  if ((item.status || "").toLowerCase() === "cancelled") return "cancelled";
  const when = dayjs(item.scheduledAt);
  const now = dayjs();
  if (when.isBefore(now, "minute")) return "past";
  if (when.isSame(now, "day")) return "today";
  return "upcoming";
}

const toneStyles = {
  cancelled: {
    accent: colors.textDisabled,
    badge: "gray" as const,
    label: "Cancelado",
    timeColor: colors.textDisabled,
  },
  past: {
    accent: colors.border,
    badge: "gray" as const,
    label: "Passado",
    timeColor: colors.textMuted,
  },
  today: {
    accent: colors.primary,
    badge: "orbix" as const,
    label: "Hoje",
    timeColor: colors.primaryDark,
  },
  upcoming: {
    accent: colors.info,
    badge: "cyan" as const,
    label: "Próximo",
    timeColor: colors.textSecondary,
  },
};

function toApiDatetime(date: Date): string {
  return date.toISOString();
}

export default function AgendaPage() {
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const menuWidth = isMobile ? "calc(100vw - 16px)" : 210;
  const [preset, setPreset] = useState<RangePreset>("week");
  const [range, setRange] = useState<[Date | null, Date | null]>(presetRange("week"));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ScheduleItem | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ScheduleItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [editor, setEditor] = useState<{
    item: ScheduleItem;
    mode: EditMode;
  } | null>(null);
  const [editAt, setEditAt] = useState<Date | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const [from, to] = range;
    const params = new URLSearchParams();
    if (from) params.set("from", dayjs(from).startOf("day").toISOString());
    if (to) params.set("to", dayjs(to).endOf("day").toISOString());
    return params.toString();
  }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/v1/schedules${query ? `?${query}` : ""}`);
      const list = unwrapList<ScheduleItem>(data, "schedules");
      setItems(
        [...list].sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        )
      );
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar agenda.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = dayjs(item.scheduledAt).format("YYYY-MM-DD");
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([day, dayItems]) => ({ day, dayItems }));
  }, [items]);

  const applyPreset = (next: Exclude<RangePreset, "custom">) => {
    setPreset(next);
    setRange(presetRange(next));
  };

  const openEditor = (item: ScheduleItem, mode: EditMode) => {
    setEditor({ item, mode });
    setEditAt(new Date(item.scheduledAt));
    setEditReason(item.reason);
    setEditNotes(item.notes || "");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
  };

  const saveEditor = async (e: FormEvent) => {
    e.preventDefault();
    if (!editor || !editAt || !editReason.trim()) {
      notifications.show({
        color: "red",
        title: "Campos obrigatórios",
        message: "Informe data/hora e motivo.",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = await api(`/api/v1/schedules/${editor.item.id}`, {
        method: "PATCH",
        body: {
          scheduledAt: toApiDatetime(editAt),
          reason: editReason.trim(),
          notes: editNotes.trim() || null,
          reactivate: true,
        },
      });
      const updated = unwrapOne<ScheduleItem>(payload, "schedule");
      setItems((prev) =>
        prev
          .map((i) => (i.id === updated.id ? updated : i))
          .sort(
            (a, b) =>
              new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          )
      );
      setEditor(null);
      notifications.show({
        color: "green",
        title: editor.mode === "reschedule" ? "Reagendado" : "Agendamento atualizado",
        message:
          editor.mode === "reschedule"
            ? "Nova data/hora salva."
            : "As alterações foram salvas.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao salvar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = async () => {
    if (!pendingCancel) return;
    setCancelling(true);
    try {
      const payload = await api(`/api/v1/schedules/${pendingCancel.id}/cancel`, {
        method: "POST",
      });
      const updated = unwrapOne<ScheduleItem>(payload, "schedule");
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setPendingCancel(null);
      notifications.show({
        color: "gray",
        title: "Agendamento cancelado",
        message: "O compromisso permanece no histórico como cancelado.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao cancelar.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/schedules/${pendingDelete.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
      setPendingDelete(null);
      notifications.show({
        color: "green",
        title: "Agendamento excluído",
        message: "O registro foi removido definitivamente.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao excluir.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const activeItems = items.filter((i) => (i.status || "scheduled").toLowerCase() !== "cancelled");
  const todayCount = activeItems.filter((i) => scheduleTone(i) === "today").length;
  const upcomingCount = activeItems.filter((i) => scheduleTone(i) === "upcoming").length;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={
          isMobile
            ? "Retornos e compromissos por dia"
            : "Retornos e compromissos com leads, organizados por dia"
        }
        actions={
          <Stack gap="sm" w={isMobile ? "100%" : undefined}>
            <Group gap={6} grow={!!isMobile} wrap="nowrap">
              {(
                [
                  { id: "today", label: "Hoje" },
                  { id: "week", label: "Semana" },
                  { id: "month", label: "Mês" },
                ] as const
              ).map((chip) => (
                <UnstyledButton
                  key={chip.id}
                  onClick={() => applyPreset(chip.id)}
                  style={{
                    padding: isMobile ? "8px 10px" : "6px 12px",
                    borderRadius: radius.md,
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "center",
                    border: `1px solid ${
                      preset === chip.id ? colors.primary : colors.borderLight
                    }`,
                    background: preset === chip.id ? colors.primaryLight : colors.surface,
                    color: preset === chip.id ? colors.primaryDark : colors.textSecondary,
                    transition: "background 120ms ease, border-color 120ms ease",
                  }}
                >
                  {chip.label}
                </UnstyledButton>
              ))}
            </Group>
            <DatePickerInput
              type="range"
              value={range}
              onChange={(v) => {
                setPreset("custom");
                setRange([
                  v[0] ? (v[0] instanceof Date ? v[0] : new Date(String(v[0]))) : null,
                  v[1] ? (v[1] instanceof Date ? v[1] : new Date(String(v[1]))) : null,
                ]);
              }}
              locale="pt-br"
              valueFormat="DD/MM/YYYY"
              leftSection={<Calendar size={16} strokeWidth={ICON_STROKE} />}
              w={isMobile ? "100%" : 260}
              size={isMobile ? "sm" : "md"}
              dropdownType={isMobile ? "modal" : "popover"}
              styles={{
                input: {
                  borderRadius: radius.md,
                },
              }}
            />
          </Stack>
        }
      />

      {!loading && items.length > 0 ? (
        <Group gap="sm" mb="lg" wrap="wrap">
          <Text size="sm" c={colors.textMuted} style={{ flex: "1 1 160px" }}>
            <Text span fw={600} c={colors.textPrimary}>
              {activeItems.length}
            </Text>{" "}
            ativos · {items.length} no período
          </Text>
          {todayCount > 0 ? (
            <Badge variant="light" color="orbix">
              {todayCount} hoje
            </Badge>
          ) : null}
          {upcomingCount > 0 ? (
            <Badge variant="light" color="cyan">
              {upcomingCount} próximos
            </Badge>
          ) : null}
        </Group>
      ) : null}

      {loading ? (
        <Center mih={280}>
          <Loader color="orbix" />
        </Center>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento neste período"
          description="Ajuste o intervalo ou crie um retorno na ficha do lead."
          icon={Calendar}
        />
      ) : (
        <Stack gap={isMobile ? "lg" : "xl"}>
          {grouped.map(({ day, dayItems }) => {
            const dayDate = dayjs(day);
            const isToday = dayDate.isSame(dayjs(), "day");
            const isTomorrow = dayDate.isSame(dayjs().add(1, "day"), "day");
            const dayLabel = isToday
              ? "Hoje"
              : isTomorrow
                ? "Amanhã"
                : dayDate.format("dddd");

            return (
              <Box key={day}>
                <Group gap="sm" mb="sm" align="baseline" wrap="wrap">
                  <Title
                    order={5}
                    style={{
                      textTransform: "capitalize",
                      letterSpacing: "-0.01em",
                      fontSize: isMobile ? 15 : undefined,
                    }}
                  >
                    {dayLabel}
                  </Title>
                  <Text size="sm" c={colors.textMuted}>
                    {dayDate.format(isMobile ? "DD/MM" : "DD [de] MMMM")}
                  </Text>
                  <Badge variant="light" color={isToday ? "orbix" : "gray"} size="sm">
                    {dayItems.length}
                  </Badge>
                </Group>

                <Stack gap="sm">
                  {dayItems.map((item) => {
                    const tone = scheduleTone(item);
                    const style = toneStyles[tone];
                    const when = dayjs(item.scheduledAt);
                    const cancelled = tone === "cancelled";

                    return (
                      <Box
                        key={item.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "72px 1fr",
                          gap: isMobile ? 8 : 12,
                          alignItems: "stretch",
                          opacity: cancelled ? 0.78 : 1,
                          minWidth: 0,
                        }}
                      >
                        {!isMobile ? (
                          <Stack gap={2} align="flex-end" justify="flex-start" pt={14}>
                            <Text
                              fw={700}
                              style={{
                                fontSize: 18,
                                lineHeight: 1.1,
                                color: style.timeColor,
                                letterSpacing: "-0.02em",
                                textDecoration: cancelled ? "line-through" : undefined,
                              }}
                            >
                              {when.format("HH:mm")}
                            </Text>
                            <Text size="xs" c={colors.textMuted} tt="capitalize">
                              {when.format("ddd")}
                            </Text>
                          </Stack>
                        ) : null}

                        <Box
                          style={{
                            position: "relative",
                            background: colors.surface,
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: radius.lg,
                            boxShadow: shadows.xs,
                            overflow: "hidden",
                            minWidth: 0,
                          }}
                        >
                          <Box
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              background: style.accent,
                            }}
                          />

                          <Group
                            justify="space-between"
                            align="flex-start"
                            wrap="wrap"
                            gap="sm"
                            p={isMobile ? "sm" : "md"}
                            pl={isMobile ? 14 : 18}
                          >
                            <Stack gap={8} style={{ flex: "1 1 200px", minWidth: 0 }}>
                              <Group gap={8} wrap="wrap">
                                {isMobile ? (
                                  <Text
                                    fw={700}
                                    style={{
                                      fontSize: 16,
                                      color: style.timeColor,
                                      letterSpacing: "-0.02em",
                                      textDecoration: cancelled ? "line-through" : undefined,
                                    }}
                                  >
                                    {when.format("HH:mm")}
                                  </Text>
                                ) : null}
                                <Badge variant="light" color={style.badge} size="sm">
                                  {style.label}
                                </Badge>
                                {!isMobile ? (
                                  <Group gap={6}>
                                    <Clock3
                                      size={14}
                                      color={colors.textMuted}
                                      strokeWidth={ICON_STROKE}
                                    />
                                    <Text size="xs" c={colors.textMuted}>
                                      {when.format("DD/MM/YYYY · HH:mm")}
                                    </Text>
                                  </Group>
                                ) : null}
                              </Group>

                              <div>
                                <Group gap={8} mb={4} wrap="nowrap">
                                  <Building2
                                    size={16}
                                    color={colors.textSecondary}
                                    strokeWidth={ICON_STROKE}
                                    style={{ flexShrink: 0 }}
                                  />
                                  <Text
                                    fw={600}
                                    style={{
                                      fontSize: 15,
                                      letterSpacing: "-0.01em",
                                      color: colors.textPrimary,
                                      textDecoration: cancelled ? "line-through" : undefined,
                                      minWidth: 0,
                                    }}
                                    lineClamp={2}
                                  >
                                    {item.lead?.companyName || "Lead"}
                                  </Text>
                                </Group>
                                <Text size="sm" fw={600} c={colors.textSecondary} lineClamp={2}>
                                  {item.reason}
                                </Text>
                                {item.notes ? (
                                  <Text size="sm" c={colors.textMuted} mt={6} lineClamp={2}>
                                    {item.notes}
                                  </Text>
                                ) : null}
                              </div>

                              <Group gap={6} mt={2} grow={!!isMobile} wrap="wrap">
                                {item.lead?.phoneE164 ? (
                                  <Button
                                    component="a"
                                    href={`tel:${item.lead.phoneE164}`}
                                    variant="default"
                                    size="compact-sm"
                                    leftSection={<Phone size={14} strokeWidth={ICON_STROKE} />}
                                  >
                                    Ligar
                                  </Button>
                                ) : null}
                                {item.leadId ? (
                                  <Button
                                    component={Link}
                                    href={`/crm/leads/${item.leadId}`}
                                    variant="light"
                                    size="compact-sm"
                                    leftSection={
                                      <ExternalLink size={14} strokeWidth={ICON_STROKE} />
                                    }
                                  >
                                    Abrir lead
                                  </Button>
                                ) : null}
                              </Group>
                            </Stack>

                            <Menu
                              shadow="md"
                              width={menuWidth}
                              position="bottom-end"
                              withinPortal
                            >
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" aria-label="Ações">
                                  <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                  onClick={() => openEditor(item, "edit")}
                                >
                                  Editar
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={
                                    <CalendarClock size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  }
                                  onClick={() => openEditor(item, "reschedule")}
                                >
                                  Reagendar
                                </Menu.Item>
                                {!cancelled ? (
                                  <Menu.Item
                                    leftSection={<Ban size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                    onClick={() => setPendingCancel(item)}
                                  >
                                    Cancelar
                                  </Menu.Item>
                                ) : null}
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                  onClick={() => setPendingDelete(item)}
                                >
                                  Excluir
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Modal
        opened={Boolean(editor)}
        onClose={closeEditor}
        title={editor?.mode === "reschedule" ? "Reagendar" : "Editar agendamento"}
        centered
        radius="lg"
        fullScreen={!!isMobile}
      >
        <form onSubmit={saveEditor}>
          <Stack gap="md">
            <Text size="sm" c={colors.textMuted} lineClamp={2}>
              {editor?.item.lead?.companyName || "Lead"}
            </Text>
            <DateTimePicker
              label="Data e hora"
              required
              value={editAt}
              onChange={(v) => {
                if (!v) {
                  setEditAt(null);
                  return;
                }
                setEditAt(v instanceof Date ? v : new Date(String(v)));
              }}
              locale="pt-br"
              valueFormat="DD/MM/YYYY HH:mm"
              size={isMobile ? "sm" : "md"}
              dropdownType={isMobile ? "modal" : "popover"}
            />
            {editor?.mode === "edit" ? (
              <>
                <TextInput
                  label="Motivo"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.currentTarget.value)}
                  size={isMobile ? "sm" : "md"}
                />
                <Textarea
                  label="Anotações"
                  minRows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.currentTarget.value)}
                  size={isMobile ? "sm" : "md"}
                />
              </>
            ) : (
              <Text size="sm" c={colors.textSecondary}>
                Motivo atual: <Text span fw={600}>{editReason}</Text>
              </Text>
            )}
            <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} gap="sm" wrap="wrap">
              <Button variant="default" onClick={closeEditor} disabled={saving}>
                Voltar
              </Button>
              <Button type="submit" loading={saving}>
                {editor?.mode === "reschedule" ? "Salvar nova data" : "Salvar"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        onConfirm={cancelSchedule}
        loading={cancelling}
        title="Cancelar agendamento"
        message={`Cancelar o retorno "${pendingCancel?.reason ?? ""}" de ${pendingCancel?.lead?.companyName ?? "lead"}? Ele permanece no histórico como cancelado.`}
        confirmLabel="Cancelar compromisso"
        danger
      />

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title="Excluir agendamento"
        message={`Excluir definitivamente "${pendingDelete?.reason ?? ""}" de ${pendingDelete?.lead?.companyName ?? "lead"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </>
  );
}
