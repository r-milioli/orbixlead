"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Menu,
  Pagination,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  Archive,
  ExternalLink,
  KanbanSquare,
  MapPin,
  MoreHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import dayjs from "dayjs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { api, ApiError } from "@/lib/api";
import type { Lead, ScrapingResult } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors, layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

const PAGE_SIZE = 25;

function dayKeyInSaoPaulo(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

function isCreatedTodayBRT(iso?: string | null) {
  if (!iso) return false;
  return dayKeyInSaoPaulo(iso) === dayKeyInSaoPaulo(new Date());
}

type CapturedLead = ScrapingResult & {
  segment?: string | null;
  jobCreatedAt?: string;
};

type AdvancedFilters = {
  temperatures: ("frio" | "morno" | "quente")[];
  city: string;
  segment: string;
  origin: "all" | "today" | "previous";
  site: "all" | "with" | "without";
  onlyAvailable: boolean;
};

const DEFAULT_FILTERS: AdvancedFilters = {
  temperatures: [],
  city: "",
  segment: "",
  origin: "all",
  site: "all",
  onlyAvailable: true,
};

function Stars({ rating }: { rating?: number | null }) {
  const value = Math.round(Number(rating ?? 0));
  if (!value) {
    return (
      <Text size="sm" c={colors.textMuted}>
        —
      </Text>
    );
  }
  return (
    <Group gap={2} wrap="nowrap">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < value ? "#FAB005" : "transparent"}
          color={i < value ? "#FAB005" : colors.border}
          strokeWidth={ICON_STROKE}
        />
      ))}
    </Group>
  );
}

function closedReasonLabel(reason?: string | null) {
  const v = (reason || "").toLowerCase();
  if (v === "converted") return "Convertido";
  if (v === "lost") return "Perdido";
  return "—";
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const menuWidth = isMobile ? "calc(100vw - 16px)" : 210;
  const tabFromUrl = searchParams.get("tab");
  const createdFromUrl = searchParams.get("created");
  const initialTab =
    tabFromUrl === "pipeline" || tabFromUrl === "encerrados" || tabFromUrl === "capturados"
      ? tabFromUrl
      : "capturados";
  const [tab, setTab] = useState<string | null>(initialTab);
  const onlyCreatedToday = createdFromUrl === "today";

  const [rows, setRows] = useState<CapturedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, { open: openFilters, close: closeFilters }] = useDisclosure(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [crmLeads, setCrmLeads] = useState<Lead[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmQ, setCrmQ] = useState("");
  const [crmPage, setCrmPage] = useState(1);
  const [pendingClose, setPendingClose] = useState<{
    id: string;
    name: string;
    reason: "converted" | "lost";
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const loadCaptured = async (filters: AdvancedFilters, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filters.city.trim()) params.set("city", filters.city.trim());
      if (filters.segment.trim()) params.set("segment", filters.segment.trim());
      if (filters.origin !== "all") params.set("origin", filters.origin);
      if (filters.site !== "all") params.set("site", filters.site);
      if (filters.temperatures.length) params.set("temperatures", filters.temperatures.join(","));
      if (filters.onlyAvailable) params.set("onlyAvailable", "1");

      const data = await api(`/api/v1/captures/results?${params.toString()}`);
      setRows(unwrapList<CapturedLead>(data, "results"));
      setSelected([]);
      setPage(1);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar leads capturados.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCrm = useCallback(async (status: "open" | "closed", search: string) => {
    setCrmLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (search.trim()) params.set("q", search.trim());
      const data = await api(`/api/v1/leads?${params.toString()}`);
      setCrmLeads(unwrapList<Lead>(data, "leads"));
      setCrmPage(1);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar leads do CRM.",
      });
    } finally {
      setCrmLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptured(appliedFilters, q);
  }, []);

  useEffect(() => {
    if (tab === "pipeline") void loadCrm("open", crmQ);
    if (tab === "encerrados") void loadCrm("closed", crmQ);
  }, [tab, loadCrm]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = rows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageIds = pageItems.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const somePageSelected = pageIds.some((id) => selected.includes(id)) && !allPageSelected;

  const selectableIds = useMemo(
    () => rows.filter((r) => !r.leadId && !r.isDuplicate && r.phoneE164).map((r) => r.id),
    [rows]
  );

  const crmLeadsVisible = useMemo(() => {
    if (!onlyCreatedToday) return crmLeads;
    return crmLeads.filter((l) => isCreatedTodayBRT(l.createdAt));
  }, [crmLeads, onlyCreatedToday]);

  const crmTotalPages = Math.max(1, Math.ceil(crmLeadsVisible.length / PAGE_SIZE));
  const crmCurrentPage = Math.min(crmPage, crmTotalPages);
  const crmPageStart = (crmCurrentPage - 1) * PAGE_SIZE;
  const crmPageItems = crmLeadsVisible.slice(crmPageStart, crmPageStart + PAGE_SIZE);

  const toggleAllPage = (checked: boolean) => {
    const ids = pageItems
      .filter((r) => !r.leadId && !r.isDuplicate && r.phoneE164)
      .map((r) => r.id);
    if (checked) {
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    closeFilters();
    void loadCaptured(draftFilters, q);
    notifications.show({
      color: "orbix",
      title: "Filtros aplicados",
      message: "A listagem foi atualizada.",
    });
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    void loadCaptured(DEFAULT_FILTERS, q);
    notifications.show({
      color: "gray",
      title: "Filtros limpos",
      message: "Os filtros foram redefinidos.",
    });
  };

  const sendToCrm = async (ids: string[]) => {
    if (ids.length === 0) return;
    setSending(true);
    try {
      const res = await api<{ createdCount: number; skippedCount: number }>(
        "/api/v1/captures/send-to-crm",
        {
          method: "POST",
          body: { resultIds: ids },
        }
      );
      notifications.show({
        color: "green",
        title: "Leads adicionados",
        message: `${res.createdCount} enviados ao CRM${
          res.skippedCount ? ` · ${res.skippedCount} ignorados` : ""
        }.`,
      });
      setSelected([]);
      await loadCaptured(appliedFilters, q);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao enviar para o CRM.",
      });
    } finally {
      setSending(false);
    }
  };

  const removeResult = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/captures/results/${pendingDelete.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setSelected((prev) => prev.filter((x) => x !== pendingDelete.id));
      notifications.show({ color: "green", title: "Lead excluído", message: "O lead foi removido." });
      setPendingDelete(null);
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

  const confirmClose = async () => {
    if (!pendingClose) return;
    setClosing(true);
    try {
      await api(`/api/v1/leads/${pendingClose.id}/close`, {
        method: "POST",
        body: { reason: pendingClose.reason },
      });
      notifications.show({
        color: "green",
        title: "Jornada encerrada",
        message: `"${pendingClose.name}" foi arquivado em Encerrados.`,
      });
      setPendingClose(null);
      await loadCrm(tab === "encerrados" ? "closed" : "open", crmQ);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao encerrar.",
      });
    } finally {
      setClosing(false);
    }
  };

  const reopenLead = async (lead: Lead) => {
    setReopeningId(lead.id);
    try {
      const payload = await api(`/api/v1/leads/${lead.id}/reopen`, { method: "POST" });
      unwrapOne<Lead>(payload, "lead");
      notifications.show({
        color: "green",
        title: "Lead reaberto",
        message: "Voltou ao pipeline ativo (Follow up).",
      });
      await loadCrm("closed", crmQ);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao reabrir.",
      });
    } finally {
      setReopeningId(null);
    }
  };

  const rangeLabel =
    rows.length === 0
      ? "Mostrando 0 de 0 leads"
      : `Mostrando ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, rows.length)} de ${rows.length} leads`;

  const crmRangeLabel =
    crmLeads.length === 0
      ? "Mostrando 0 de 0 leads"
      : `Mostrando ${crmPageStart + 1}–${Math.min(crmPageStart + PAGE_SIZE, crmLeads.length)} de ${crmLeads.length} leads`;

  const activeFilterCount =
    appliedFilters.temperatures.length +
    (appliedFilters.city ? 1 : 0) +
    (appliedFilters.segment ? 1 : 0) +
    (appliedFilters.origin !== "all" ? 1 : 0) +
    (appliedFilters.site !== "all" ? 1 : 0) +
    (appliedFilters.onlyAvailable ? 0 : 1);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Capture, acompanhe no pipeline e consulte jornadas encerradas."
        actions={
          tab === "capturados" ? (
            <>
              <Button
                variant="default"
                size={isMobile ? "sm" : "md"}
                leftSection={<SlidersHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                onClick={() => {
                  setDraftFilters(appliedFilters);
                  openFilters();
                }}
              >
                Filtros
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
              <Button
                size={isMobile ? "sm" : "md"}
                leftSection={<KanbanSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                disabled={selected.length === 0}
                loading={sending}
                onClick={() => void sendToCrm(selected)}
              >
                {isMobile
                  ? `CRM${selected.length > 0 ? ` (${selected.length})` : ""}`
                  : `Adicionar ao CRM${selected.length > 0 ? ` (${selected.length})` : ""}`}
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={setTab} mb="md">
        <Tabs.List grow={!!isMobile}>
          <Tabs.Tab value="capturados">Capturados</Tabs.Tab>
          <Tabs.Tab value="pipeline">No pipeline</Tabs.Tab>
          <Tabs.Tab value="encerrados">Encerrados</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="capturados" pt="md">
          <Stack gap="sm" mb="md">
            <Group gap="sm" wrap="wrap" grow={!!isMobile}>
              <TextInput
                placeholder="Buscar empresa, telefone..."
                leftSection={<Search size={16} strokeWidth={ICON_STROKE} />}
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadCaptured(appliedFilters, q);
                }}
                size={isMobile ? "sm" : "md"}
                style={isMobile ? { flex: "1 1 100%" } : { flex: "1 1 260px", maxWidth: 360 }}
              />
              <Select
                placeholder="Temperatura"
                clearable
                data={[
                  { value: "quente", label: "Quente" },
                  { value: "morno", label: "Morno" },
                  { value: "frio", label: "Frio" },
                ]}
                value={appliedFilters.temperatures[0] ?? null}
                onChange={(value) => {
                  const next = {
                    ...appliedFilters,
                    temperatures: value ? [value as "frio" | "morno" | "quente"] : [],
                  };
                  setAppliedFilters(next);
                  setDraftFilters(next);
                  void loadCaptured(next, q);
                }}
                size={isMobile ? "sm" : "md"}
                w={isMobile ? "100%" : 160}
                style={isMobile ? { flex: "1 1 100%" } : undefined}
              />
              <Button
                variant="subtle"
                size={isMobile ? "sm" : "md"}
                onClick={() => void loadCaptured(appliedFilters, q)}
              >
                Buscar
              </Button>
            </Group>
          </Stack>

          {loading ? (
            <Center mih={240}>
              <Loader color="orbix" />
            </Center>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nenhum lead capturado"
              description="Execute uma captura ou ajuste os filtros avançados."
            />
          ) : (
            <Card padding={isMobile ? "sm" : 0} style={{ minWidth: 0 }}>
              {isMobile ? (
                <Stack gap={10}>
                  <Group gap="sm" wrap="nowrap">
                    <Checkbox
                      aria-label="Selecionar página"
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={(e) => toggleAllPage(e.currentTarget.checked)}
                    />
                    <Text size="sm" c={colors.textMuted}>
                      Selecionar página
                    </Text>
                  </Group>
                  {pageItems.map((lead) => {
                    const canSelect = !lead.leadId && !lead.isDuplicate && Boolean(lead.phoneE164);
                    return (
                      <Box
                        key={lead.id}
                        style={{
                          border: `1px solid ${colors.borderLight}`,
                          borderRadius: 10,
                          padding: 12,
                          background: selected.includes(lead.id)
                            ? colors.primaryLight
                            : colors.surface,
                          minWidth: 0,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                          <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                            <Checkbox
                              aria-label={`Selecionar ${lead.companyName}`}
                              checked={selected.includes(lead.id)}
                              disabled={!canSelect}
                              onChange={(e) => toggleOne(lead.id, e.currentTarget.checked)}
                              mt={2}
                            />
                            <Box style={{ minWidth: 0 }}>
                              <Text size="sm" fw={600} lineClamp={2}>
                                {lead.companyName}
                              </Text>
                              <Text size="xs" c={colors.textMuted} lineClamp={1}>
                                {lead.segment || "—"}
                                {lead.leadId ? " · já no CRM" : ""}
                                {lead.isDuplicate ? " · duplicado" : ""}
                              </Text>
                            </Box>
                          </Group>
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
                              {lead.mapsUrl ? (
                                <Menu.Item
                                  component="a"
                                  href={lead.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  leftSection={
                                    <MapPin size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  }
                                >
                                  Abrir no Maps
                                </Menu.Item>
                              ) : null}
                              {canSelect ? (
                                <Menu.Item
                                  leftSection={
                                    <KanbanSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  }
                                  onClick={() => void sendToCrm([lead.id])}
                                >
                                  Adicionar ao CRM
                                </Menu.Item>
                              ) : null}
                              {(lead.mapsUrl || canSelect) && <Menu.Divider />}
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                onClick={() =>
                                  setPendingDelete({ id: lead.id, name: lead.companyName })
                                }
                              >
                                Excluir
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>

                        <Group gap={8} wrap="wrap" mb={8}>
                          <TemperatureBadge value={lead.temperature} />
                          <Stars rating={lead.rating} />
                          {lead.hasWebsite || lead.website ? (
                            <Text size="xs" c={colors.textSecondary}>
                              Com site
                            </Text>
                          ) : (
                            <Badge
                              size="sm"
                              variant="light"
                              styles={{
                                root: {
                                  background: colors.dangerBg,
                                  color: colors.danger,
                                },
                              }}
                            >
                              Sem site
                            </Badge>
                          )}
                        </Group>

                        <Text size="sm">{lead.phoneE164 || lead.phoneRaw || "—"}</Text>
                        <Text size="xs" c={colors.textMuted} mt={2}>
                          {lead.city || "—"}
                        </Text>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={960}>
                  <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                    <Table.Thead style={{ background: colors.background }}>
                      <Table.Tr>
                        <Table.Th w={44}>
                          <Checkbox
                            aria-label="Selecionar página"
                            checked={allPageSelected}
                            indeterminate={somePageSelected}
                            onChange={(e) => toggleAllPage(e.currentTarget.checked)}
                          />
                        </Table.Th>
                        <Table.Th>Empresa</Table.Th>
                        <Table.Th>Cidade</Table.Th>
                        <Table.Th>Temperatura</Table.Th>
                        <Table.Th>Avaliações</Table.Th>
                        <Table.Th>Telefone</Table.Th>
                        <Table.Th>Site</Table.Th>
                        <Table.Th w={56} ta="center">
                          Ações
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pageItems.map((lead) => {
                        const canSelect = !lead.leadId && !lead.isDuplicate && Boolean(lead.phoneE164);
                        return (
                          <Table.Tr
                            key={lead.id}
                            bg={selected.includes(lead.id) ? colors.primaryLight : undefined}
                          >
                            <Table.Td>
                              <Checkbox
                                aria-label={`Selecionar ${lead.companyName}`}
                                checked={selected.includes(lead.id)}
                                disabled={!canSelect}
                                onChange={(e) => toggleOne(lead.id, e.currentTarget.checked)}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {lead.companyName}
                              </Text>
                              <Text size="xs" c={colors.textMuted}>
                                {lead.segment || "—"}
                                {lead.leadId ? " · já no CRM" : ""}
                                {lead.isDuplicate ? " · duplicado" : ""}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{lead.city || "—"}</Text>
                            </Table.Td>
                            <Table.Td>
                              <TemperatureBadge value={lead.temperature} />
                            </Table.Td>
                            <Table.Td>
                              <Stars rating={lead.rating} />
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{lead.phoneE164 || lead.phoneRaw || "—"}</Text>
                            </Table.Td>
                            <Table.Td>
                              {lead.hasWebsite || lead.website ? (
                                <Text size="sm" c={colors.textSecondary}>
                                  Disponível
                                </Text>
                              ) : (
                                <Badge
                                  variant="light"
                                  styles={{
                                    root: {
                                      background: colors.dangerBg,
                                      color: colors.danger,
                                    },
                                  }}
                                >
                                  Sem site
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray" aria-label="Ações">
                                    <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  {lead.mapsUrl ? (
                                    <Menu.Item
                                      component="a"
                                      href={lead.mapsUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      leftSection={
                                        <MapPin size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                      }
                                    >
                                      Abrir no Maps
                                    </Menu.Item>
                                  ) : null}
                                  {canSelect ? (
                                    <Menu.Item
                                      leftSection={
                                        <KanbanSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                      }
                                      onClick={() => void sendToCrm([lead.id])}
                                    >
                                      Adicionar ao CRM
                                    </Menu.Item>
                                  ) : null}
                                  {(lead.mapsUrl || canSelect) && <Menu.Divider />}
                                  <Menu.Item
                                    color="red"
                                    leftSection={<Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                    onClick={() =>
                                      setPendingDelete({ id: lead.id, name: lead.companyName })
                                    }
                                  >
                                    Excluir
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}

              <Group
                justify="space-between"
                px={isMobile ? 0 : "md"}
                py="md"
                mt={isMobile ? "sm" : 0}
                wrap="wrap"
                gap="sm"
                style={{ borderTop: `1px solid ${colors.borderLight}` }}
              >
                <Text size="sm" c={colors.textMuted} style={{ flex: "1 1 160px" }}>
                  {rangeLabel}
                  {selected.length > 0 ? ` · ${selected.length} selecionado(s)` : ""}
                  {selectableIds.length > 0 ? ` · ${selectableIds.length} disponíveis` : ""}
                </Text>
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={setPage}
                  size="sm"
                  radius="sm"
                  color="orbix"
                  withEdges={!isMobile}
                />
              </Group>
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="pipeline" pt="md">
          <Group gap="sm" mb="md" wrap="wrap" grow={!!isMobile}>
            <TextInput
              placeholder="Buscar no pipeline..."
              leftSection={<Search size={16} strokeWidth={ICON_STROKE} />}
              value={crmQ}
              onChange={(e) => setCrmQ(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCrm("open", crmQ);
              }}
              size={isMobile ? "sm" : "md"}
              style={isMobile ? { flex: "1 1 100%" } : { flex: "1 1 260px", maxWidth: 360 }}
            />
            <Button
              variant="subtle"
              size={isMobile ? "sm" : "md"}
              onClick={() => void loadCrm("open", crmQ)}
            >
              Buscar
            </Button>
          </Group>

          {crmLoading ? (
            <Center mih={240}>
              <Loader color="orbix" />
            </Center>
          ) : crmLeads.length === 0 ? (
            <EmptyState
              title="Nenhum lead no pipeline"
              description="Envie resultados da captura para o CRM para acompanhá-los aqui."
            />
          ) : (
            <Card padding={isMobile ? "sm" : 0} style={{ minWidth: 0 }}>
              {isMobile ? (
                <Stack gap={10}>
                  {crmPageItems.map((lead) => (
                    <Box
                      key={lead.id}
                      style={{
                        border: `1px solid ${colors.borderLight}`,
                        borderRadius: 10,
                        padding: 12,
                        background: colors.surface,
                        minWidth: 0,
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" fw={600} lineClamp={2}>
                            {lead.companyName}
                          </Text>
                          <Text size="xs" c={colors.textMuted} mt={2} lineClamp={1}>
                            {lead.segment || "—"}
                          </Text>
                        </Box>
                        <Menu
                          shadow="md"
                          width={isMobile ? "calc(100vw - 16px)" : 220}
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
                              component={Link}
                              href={`/crm/leads/${lead.id}`}
                              leftSection={
                                <ExternalLink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                              }
                            >
                              Abrir ficha
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                              onClick={() =>
                                setPendingClose({
                                  id: lead.id,
                                  name: lead.companyName,
                                  reason: "converted",
                                })
                              }
                            >
                              Encerrar como convertido
                            </Menu.Item>
                            <Menu.Item
                              color="red"
                              leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                              onClick={() =>
                                setPendingClose({
                                  id: lead.id,
                                  name: lead.companyName,
                                  reason: "lost",
                                })
                              }
                            >
                              Encerrar como perdido
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>

                      <Group gap={8} wrap="wrap" mb={8}>
                        <Badge variant="light" color="orbix">
                          {lead.stage?.label || "—"}
                        </Badge>
                        <TemperatureBadge value={lead.temperature} />
                      </Group>
                      <Text size="sm">{lead.phoneE164 || "—"}</Text>
                      <Text size="xs" c={colors.textMuted} mt={2}>
                        {lead.city || "—"}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={900}>
                  <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                    <Table.Thead style={{ background: colors.background }}>
                      <Table.Tr>
                        <Table.Th>Empresa</Table.Th>
                        <Table.Th>Estágio</Table.Th>
                        <Table.Th>Cidade</Table.Th>
                        <Table.Th>Temperatura</Table.Th>
                        <Table.Th>Telefone</Table.Th>
                        <Table.Th>Segmento</Table.Th>
                        <Table.Th w={56} ta="center">
                          Ações
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {crmPageItems.map((lead) => (
                        <Table.Tr key={lead.id}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {lead.companyName}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="orbix">
                              {lead.stage?.label || "—"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{lead.city || "—"}</Text>
                          </Table.Td>
                          <Table.Td>
                            <TemperatureBadge value={lead.temperature} />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{lead.phoneE164}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c={colors.textSecondary}>
                              {lead.segment || "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Menu shadow="md" width={220} position="bottom-end" withinPortal>
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" aria-label="Ações">
                                  <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  component={Link}
                                  href={`/crm/leads/${lead.id}`}
                                  leftSection={
                                    <ExternalLink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  }
                                >
                                  Abrir ficha
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                  onClick={() =>
                                    setPendingClose({
                                      id: lead.id,
                                      name: lead.companyName,
                                      reason: "converted",
                                    })
                                  }
                                >
                                  Encerrar como convertido
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                  onClick={() =>
                                    setPendingClose({
                                      id: lead.id,
                                      name: lead.companyName,
                                      reason: "lost",
                                    })
                                  }
                                >
                                  Encerrar como perdido
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
              <Group
                justify="space-between"
                px={isMobile ? 0 : "md"}
                py="md"
                mt={isMobile ? "sm" : 0}
                wrap="wrap"
                gap="sm"
                style={{ borderTop: `1px solid ${colors.borderLight}` }}
              >
                <Text size="sm" c={colors.textMuted} style={{ flex: "1 1 160px" }}>
                  {crmRangeLabel}
                </Text>
                <Pagination
                  total={crmTotalPages}
                  value={crmCurrentPage}
                  onChange={setCrmPage}
                  size="sm"
                  radius="sm"
                  color="orbix"
                  withEdges={!isMobile}
                />
              </Group>
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="encerrados" pt="md">
          <Group gap="sm" mb="md" wrap="wrap" grow={!!isMobile}>
            <TextInput
              placeholder="Buscar encerrados..."
              leftSection={<Search size={16} strokeWidth={ICON_STROKE} />}
              value={crmQ}
              onChange={(e) => setCrmQ(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCrm("closed", crmQ);
              }}
              size={isMobile ? "sm" : "md"}
              style={isMobile ? { flex: "1 1 100%" } : { flex: "1 1 260px", maxWidth: 360 }}
            />
            <Button
              variant="subtle"
              size={isMobile ? "sm" : "md"}
              onClick={() => void loadCrm("closed", crmQ)}
            >
              Buscar
            </Button>
          </Group>

          {crmLoading ? (
            <Center mih={240}>
              <Loader color="orbix" />
            </Center>
          ) : crmLeads.length === 0 ? (
            <EmptyState
              title="Nenhum lead encerrado"
              description="Ao finalizar a jornada (convertido ou perdido), o lead aparece aqui para consulta."
            />
          ) : (
            <Card padding={isMobile ? "sm" : 0} style={{ minWidth: 0 }}>
              {isMobile ? (
                <Stack gap={10}>
                  {crmPageItems.map((lead) => (
                    <Box
                      key={lead.id}
                      style={{
                        border: `1px solid ${colors.borderLight}`,
                        borderRadius: 10,
                        padding: 12,
                        background: colors.surface,
                        minWidth: 0,
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" fw={600} lineClamp={2}>
                            {lead.companyName}
                          </Text>
                          <Text size="xs" c={colors.textMuted} mt={2} lineClamp={1}>
                            {lead.segment || "—"}
                          </Text>
                        </Box>
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
                              component={Link}
                              href={`/crm/leads/${lead.id}`}
                              leftSection={
                                <ExternalLink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                              }
                            >
                              Consultar ficha
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                              onClick={() => void reopenLead(lead)}
                              disabled={reopeningId === lead.id}
                            >
                              Reabrir no pipeline
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>

                      <Group gap={8} wrap="wrap" mb={8}>
                        <Badge
                          variant="light"
                          color={
                            (lead.closedReason || "").toLowerCase() === "converted"
                              ? "green"
                              : "gray"
                          }
                        >
                          {closedReasonLabel(lead.closedReason)}
                        </Badge>
                        <Text size="xs" c={colors.textMuted}>
                          {lead.closedAt
                            ? dayjs(lead.closedAt).format("DD/MM/YY HH:mm")
                            : "—"}
                        </Text>
                      </Group>
                      <Text size="sm">{lead.phoneE164 || "—"}</Text>
                      <Text size="xs" c={colors.textMuted} mt={2}>
                        {lead.city || "—"}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={960}>
                  <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                    <Table.Thead style={{ background: colors.background }}>
                      <Table.Tr>
                        <Table.Th>Empresa</Table.Th>
                        <Table.Th>Motivo</Table.Th>
                        <Table.Th>Encerrado em</Table.Th>
                        <Table.Th>Cidade</Table.Th>
                        <Table.Th>Telefone</Table.Th>
                        <Table.Th>Segmento</Table.Th>
                        <Table.Th w={56} ta="center">
                          Ações
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {crmPageItems.map((lead) => (
                        <Table.Tr key={lead.id}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {lead.companyName}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={
                                (lead.closedReason || "").toLowerCase() === "converted"
                                  ? "green"
                                  : "gray"
                              }
                            >
                              {closedReasonLabel(lead.closedReason)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {lead.closedAt
                                ? dayjs(lead.closedAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{lead.city || "—"}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{lead.phoneE164}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c={colors.textSecondary}>
                              {lead.segment || "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" aria-label="Ações">
                                  <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  component={Link}
                                  href={`/crm/leads/${lead.id}`}
                                  leftSection={
                                    <ExternalLink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  }
                                >
                                  Consultar ficha
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                                  onClick={() => void reopenLead(lead)}
                                  disabled={reopeningId === lead.id}
                                >
                                  Reabrir no pipeline
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
              <Group
                justify="space-between"
                px={isMobile ? 0 : "md"}
                py="md"
                mt={isMobile ? "sm" : 0}
                wrap="wrap"
                gap="sm"
                style={{ borderTop: `1px solid ${colors.borderLight}` }}
              >
                <Text size="sm" c={colors.textMuted} style={{ flex: "1 1 160px" }}>
                  {crmRangeLabel}
                </Text>
                <Pagination
                  total={crmTotalPages}
                  value={crmCurrentPage}
                  onChange={setCrmPage}
                  size="sm"
                  radius="sm"
                  color="orbix"
                  withEdges={!isMobile}
                />
              </Group>
            </Card>
          )}
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={filtersOpen}
        onClose={closeFilters}
        position="right"
        size={isMobile ? "100%" : 420}
        title="Filtros avançados"
        padding="md"
        overlayProps={{ backgroundOpacity: 0.45 }}
      >
        <Stack gap="lg">
          <div>
            <Text size="sm" fw={600} mb={8}>
              Temperatura
            </Text>
            <Group gap="md" wrap="wrap">
              {(["frio", "morno", "quente"] as const).map((temp) => (
                <Checkbox
                  key={temp}
                  label={temp === "frio" ? "Frio" : temp === "morno" ? "Morno" : "Quente"}
                  checked={draftFilters.temperatures.includes(temp)}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraftFilters((prev) => ({
                      ...prev,
                      temperatures: checked
                        ? [...prev.temperatures, temp]
                        : prev.temperatures.filter((t) => t !== temp),
                    }));
                  }}
                />
              ))}
            </Group>
          </div>

          <TextInput
            label="Cidade"
            placeholder="Buscar cidade"
            value={draftFilters.city}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, city: e.currentTarget.value }))}
          />

          <TextInput
            label="Segmento"
            placeholder="Ex.: restaurante"
            value={draftFilters.segment}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, segment: e.currentTarget.value }))
            }
          />

          <Select
            label="Origem"
            data={[
              { value: "all", label: "Todas as capturas" },
              { value: "today", label: "Captura de hoje" },
              { value: "previous", label: "Captura anterior" },
            ]}
            value={draftFilters.origin}
            onChange={(value) =>
              setDraftFilters((prev) => ({
                ...prev,
                origin: (value as AdvancedFilters["origin"]) || "all",
              }))
            }
            allowDeselect={false}
          />

          <Select
            label="Site"
            data={[
              { value: "all", label: "Todos" },
              { value: "with", label: "Com site" },
              { value: "without", label: "Sem site" },
            ]}
            value={draftFilters.site}
            onChange={(value) =>
              setDraftFilters((prev) => ({
                ...prev,
                site: (value as AdvancedFilters["site"]) || "all",
              }))
            }
            allowDeselect={false}
          />

          <Checkbox
            label="Somente disponíveis para o CRM"
            description="Oculta duplicados e já enviados"
            checked={draftFilters.onlyAvailable}
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                onlyAvailable: e.currentTarget.checked,
              }))
            }
          />

          <Group justify="space-between" mt="md" grow={!!isMobile} wrap="wrap">
            <Button variant="subtle" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <Button onClick={applyFilters}>Aplicar filtros</Button>
          </Group>
        </Stack>
      </Drawer>

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={removeResult}
        loading={deleting}
        title="Excluir lead capturado"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name ?? ""}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />

      <ConfirmModal
        opened={Boolean(pendingClose)}
        onClose={() => setPendingClose(null)}
        onConfirm={confirmClose}
        loading={closing}
        title="Encerrar jornada"
        message={
          pendingClose?.reason === "converted"
            ? `Encerrar "${pendingClose?.name ?? ""}" como convertido? Sai do Kanban ativo e fica em Encerrados para auditoria.`
            : `Encerrar "${pendingClose?.name ?? ""}" como perdido? Sai do Kanban ativo e fica em Encerrados para auditoria.`
        }
        confirmLabel="Encerrar"
        danger={pendingClose?.reason === "lost"}
      />
    </>
  );
}
