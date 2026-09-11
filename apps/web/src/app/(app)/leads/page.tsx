"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
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
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  KanbanSquare,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { api, ApiError } from "@/lib/api";
import type { ScrapingResult } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

const PAGE_SIZE = 25;

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

export default function LeadsPage() {
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

  const load = async (filters: AdvancedFilters, search: string) => {
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

  useEffect(() => {
    void load(appliedFilters, q);
  }, []);

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
    void load(draftFilters, q);
    notifications.show({
      color: "orbix",
      title: "Filtros aplicados",
      message: "A listagem foi atualizada.",
    });
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    void load(DEFAULT_FILTERS, q);
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
      await load(appliedFilters, q);
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

  const rangeLabel =
    rows.length === 0
      ? "Mostrando 0 de 0 leads"
      : `Mostrando ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, rows.length)} de ${rows.length} leads`;

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
        title="Leads Capturados"
        subtitle="Gerencie os leads encontrados nas suas prospecções."
        actions={
          <Group gap="sm">
            <Button
              variant="default"
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
              leftSection={<KanbanSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              disabled={selected.length === 0}
              loading={sending}
              onClick={() => void sendToCrm(selected)}
            >
              Adicionar ao CRM
              {selected.length > 0 ? ` (${selected.length})` : ""}
            </Button>
          </Group>
        }
      />

      <Group gap="sm" mb="md" wrap="wrap">
        <TextInput
          placeholder="Buscar empresa, telefone..."
          leftSection={<Search size={16} strokeWidth={ICON_STROKE} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(appliedFilters, q);
          }}
          style={{ flex: "1 1 260px", maxWidth: 360 }}
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
            void load(next, q);
          }}
          w={160}
        />
        <Button variant="subtle" onClick={() => void load(appliedFilters, q)}>
          Buscar
        </Button>
      </Group>

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
        <Card padding={0}>
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
                            <Menu.Divider />
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

          <Group
            justify="space-between"
            px="md"
            py="md"
            style={{ borderTop: `1px solid ${colors.borderLight}` }}
          >
            <Text size="sm" c={colors.textMuted}>
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
              withEdges
            />
          </Group>
        </Card>
      )}

      <Drawer
        opened={filtersOpen}
        onClose={closeFilters}
        position="right"
        size={420}
        title="Filtros avançados"
        padding="md"
        overlayProps={{ backgroundOpacity: 0.45 }}
      >
        <Stack gap="lg">
          <div>
            <Text size="sm" fw={600} mb={8}>
              Temperatura
            </Text>
            <Group gap="md">
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

          <Group justify="space-between" mt="md">
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
    </>
  );
}
