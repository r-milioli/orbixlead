"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { maxJobQuantity } from "@orbixlead/shared";
import { Ban, MapPin, Search, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { ScrapingJob, ScrapingResult } from "@/lib/types";
import { normalizeJobStatus } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors, layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

const statusLabel: Record<string, string> = {
  queued: "Na fila",
  running: "Processando",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

function statusColor(status: string): string {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "cancelled") return "gray";
  return "orbix";
}

function ResultStatusBadge({ r }: { r: ScrapingResult }) {
  if (r.leadId) {
    return (
      <Badge variant="light" color="green">
        No CRM
      </Badge>
    );
  }
  if (r.isDuplicate) {
    return (
      <Badge variant="light" color="gray">
        Já na base
      </Badge>
    );
  }
  if (r.discarded) {
    return (
      <Badge variant="light" color="red">
        Descartado
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="orbix">
      Novo
    </Badge>
  );
}

export default function CapturaPage() {
  const { tenant, refresh } = useAuth();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const cardPad = isMobile ? "md" : "lg";
  const initialTab = searchParams.get("tab") === "historico" ? "historico" : "nova";
  const [tab, setTab] = useState<string | null>(initialTab);
  const [city, setCity] = useState("");
  const [segment, setSegment] = useState("");
  const [quantity, setQuantity] = useState<number | string>(20);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<ScrapingJob | null>(null);
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [history, setHistory] = useState<ScrapingJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ScrapingJob | null>(null);

  const unlimited = Boolean(tenant?.unlimited);
  const remaining = tenant?.creditRemaining ?? 0;
  const maxQty = maxJobQuantity(remaining, unlimited);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api("/api/v1/captures/jobs?take=50");
      setHistory(unwrapList<ScrapingJob>(data, "jobs"));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Não foi possível carregar o histórico.",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadResults = async (jobId: string) => {
    try {
      const data = await api(`/api/v1/captures/${jobId}/results`);
      const list = unwrapList<ScrapingResult>(data, "results");
      setResults(list.filter((r) => !r.softDeletedAt));
    } catch {
      /* ignore until completed */
    }
  };

  const pollJob = (jobId: string) => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      try {
        const payload = await api(`/api/v1/captures/${jobId}`);
        const updated = unwrapOne<ScrapingJob>(payload, "job");
        setJob(updated);
        const st = normalizeJobStatus(updated.status);
        if (st === "completed" || st === "failed" || st === "cancelled") {
          clearPoll();
          if (st === "completed") {
            await loadResults(jobId);
          }
          await refresh();
          void loadHistory();
          if (st === "completed") {
            notifications.show({
              color: "green",
              title: "Captura concluída",
              message: `${updated.newCount} novos · ${updated.existingCount} já na base`,
            });
          } else if (st === "failed") {
            notifications.show({
              color: "red",
              title: "Captura falhou",
              message: updated.errorMessage || "Tente novamente.",
            });
          } else {
            notifications.show({
              color: "gray",
              title: "Captura cancelada",
              message: "A fila foi interrompida e os créditos reservados foram liberados.",
            });
          }
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
  };

  useEffect(() => () => clearPoll(), []);

  useEffect(() => {
    if (tab === "historico") {
      void loadHistory();
    }
  }, [tab, loadHistory]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!city.trim() || !segment.trim() || !qty || qty < 1) {
      notifications.show({
        color: "red",
        title: "Campos obrigatórios",
        message: "Informe cidade, segmentação e quantidade.",
      });
      return;
    }
    if (!unlimited && remaining <= 0) {
      notifications.show({
        color: "red",
        title: "Sem créditos",
        message: "Sua conta não possui créditos suficientes.",
      });
      return;
    }
    setSubmitting(true);
    setSelected([]);
    setResults([]);
    try {
      const payload = await api("/api/v1/captures", {
        method: "POST",
        body: {
          country: "BR",
          city: city.trim(),
          segment: segment.trim(),
          quantity: Math.min(qty, maxQty),
        },
      });
      const created = unwrapOne<ScrapingJob>(payload, "job");
      setJob(created);
      await refresh();
      void loadHistory();
      notifications.show({
        color: "orbix",
        title: "Captura adicionada à fila",
        message: "Processando sua busca...",
      });
      pollJob(created.id);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao iniciar captura.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectable = results.filter(
    (r) => !r.isDuplicate && !r.discarded && r.phoneE164 && !r.leadId
  );

  const sendToCrm = async () => {
    if (!job || selected.length === 0) return;
    setSending(true);
    try {
      await api(`/api/v1/captures/send-to-crm`, {
        method: "POST",
        body: { resultIds: selected },
      });
      notifications.show({
        color: "green",
        title: "Enviado ao CRM",
        message: `${selected.length} lead(s) no estágio Novos.`,
      });
      setSelected([]);
      await loadResults(job.id);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao enviar.",
      });
    } finally {
      setSending(false);
    }
  };

  const softDeleteResult = async () => {
    if (!job || !pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/captures/results/${pendingDelete.id}`, {
        method: "DELETE",
      });
      setResults((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setSelected((prev) => prev.filter((id) => id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Não foi possível excluir.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setCancellingId(pendingCancel.id);
    try {
      const payload = await api(`/api/v1/captures/${pendingCancel.id}/cancel`, {
        method: "POST",
      });
      const updated = unwrapOne<ScrapingJob>(payload, "job");
      setHistory((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      if (job?.id === updated.id) {
        setJob(updated);
        clearPoll();
      }
      await refresh();
      notifications.show({
        color: "gray",
        title: "Captura cancelada",
        message: "A fila foi interrompida. O registro permanece no histórico.",
      });
      setPendingCancel(null);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Não foi possível cancelar.",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const openHistoryJob = async (row: ScrapingJob) => {
    setJob(row);
    setTab("nova");
    setSelected([]);
    setResults([]);
    const st = normalizeJobStatus(row.status);
    if (st === "completed") {
      await loadResults(row.id);
    } else if (st === "queued" || st === "running") {
      pollJob(row.id);
    }
  };

  const jobStatus = job ? normalizeJobStatus(job.status) : null;
  const canCancelActive =
    job && (jobStatus === "queued" || jobStatus === "running");

  return (
    <>
      <PageHeader
        title="Captura"
        subtitle="Busque leads no Brasil por cidade e segmentação"
      />

      <Tabs value={tab} onChange={setTab} mb={{ base: "md", sm: "xl" }}>
        <Tabs.List grow={!!isMobile}>
          <Tabs.Tab value="nova">Nova captura</Tabs.Tab>
          <Tabs.Tab value="historico">Histórico</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="nova" pt={{ base: "md", sm: "lg" }}>
          <Card padding={cardPad} mb={{ base: "md", sm: "xl" }} style={{ minWidth: 0 }}>
            <Title order={4} mb="md" style={{ fontSize: isMobile ? 16 : undefined }}>
              Nova captura
            </Title>
            <form onSubmit={onSubmit}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={isMobile ? 12 : "md"} mb="md">
                <TextInput label="País" value="Brasil" disabled size={isMobile ? "sm" : "md"} />
                <TextInput
                  label="Cidade"
                  required
                  placeholder="Ex.: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.currentTarget.value)}
                  size={isMobile ? "sm" : "md"}
                />
                <TextInput
                  label="Segmentação"
                  required
                  placeholder="Ex.: clínicas odontológicas"
                  value={segment}
                  onChange={(e) => setSegment(e.currentTarget.value)}
                  size={isMobile ? "sm" : "md"}
                />
                <NumberInput
                  label="Quantidade"
                  required
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={setQuantity}
                  size={isMobile ? "sm" : "md"}
                  description={
                    unlimited
                      ? `Máximo ${maxQty} por busca`
                      : `Restam ${remaining} créditos · máx. ${maxQty}`
                  }
                />
              </SimpleGrid>
              <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile}>
                <Button
                  type="submit"
                  size={isMobile ? "sm" : "md"}
                  leftSection={<Search size={18} />}
                  loading={submitting}
                  disabled={!unlimited && remaining <= 0}
                >
                  Capturar leads
                </Button>
              </Group>
            </form>
          </Card>

          {job ? (
            <Card padding={cardPad} mb={{ base: "md", sm: "xl" }} style={{ minWidth: 0 }}>
              <Group justify="space-between" mb="sm" wrap="wrap" gap="sm" align="flex-start">
                <Box style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <Text fw={600}>Status da captura</Text>
                  <Text size="sm" c={colors.textMuted} lineClamp={2}>
                    {job.city} · {job.segment} · {job.quantity} leads
                  </Text>
                </Box>
                <Group gap="sm" wrap="wrap" w={isMobile ? "100%" : undefined}>
                  <Badge color={statusColor(jobStatus || "")} variant="light">
                    {statusLabel[jobStatus || ""] || job.status}
                  </Badge>
                  {canCancelActive ? (
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      leftSection={<Ban size={14} strokeWidth={ICON_STROKE} />}
                      loading={cancellingId === job.id}
                      onClick={() => setPendingCancel(job)}
                      style={isMobile ? { flex: 1 } : undefined}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </Group>
              </Group>
              {(jobStatus === "queued" || jobStatus === "running") && (
                <Text size="sm" c={colors.textSecondary}>
                  Processando sua busca...
                </Text>
              )}
              {jobStatus === "completed" && (
                <Text size="sm" c={colors.textSecondary}>
                  Novos: {job.newCount} · Já na base: {job.existingCount} · Descartados:{" "}
                  {job.discardedCount} · Créditos usados: {job.settledCredits}
                </Text>
              )}
              {jobStatus === "failed" && (
                <Text size="sm" c={colors.danger}>
                  {job.errorMessage || "Falha no processamento."}
                </Text>
              )}
              {jobStatus === "cancelled" && (
                <Text size="sm" c={colors.textMuted}>
                  {job.errorMessage || "Cancelado pelo usuário."}
                </Text>
              )}
            </Card>
          ) : null}

          {jobStatus === "completed" ? (
            <Card padding={cardPad} style={{ minWidth: 0 }}>
              <Stack gap="md" mb="md">
                <Title order={4} style={{ fontSize: isMobile ? 16 : undefined }}>
                  Resultados
                </Title>
                <Group
                  gap={8}
                  wrap="wrap"
                  grow={!!isMobile}
                  w={isMobile ? "100%" : undefined}
                  justify={isMobile ? "stretch" : "flex-end"}
                >
                  <Button
                    variant="default"
                    size="sm"
                    disabled={selectable.length === 0}
                    onClick={() => setSelected(selectable.map((r) => r.id))}
                  >
                    Selecionar enviáveis
                  </Button>
                  <Button
                    size="sm"
                    disabled={selected.length === 0}
                    loading={sending}
                    onClick={() => void sendToCrm()}
                  >
                    Enviar para CRM ({selected.length})
                  </Button>
                </Group>
              </Stack>

              {results.length === 0 ? (
                <EmptyState
                  title="Nenhum resultado"
                  description="Esta captura não retornou leads novos."
                />
              ) : isMobile ? (
                <Stack gap={10}>
                  {results.map((r) => {
                    const canSelect =
                      !r.isDuplicate && !r.discarded && Boolean(r.phoneE164) && !r.leadId;
                    return (
                      <Box
                        key={r.id}
                        style={{
                          border: `1px solid ${colors.borderLight}`,
                          borderRadius: 10,
                          padding: 12,
                          background: colors.surface,
                          minWidth: 0,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                          <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                            <Checkbox
                              checked={selected.includes(r.id)}
                              disabled={!canSelect}
                              onChange={() => toggleSelect(r.id)}
                              mt={2}
                            />
                            <Box style={{ minWidth: 0 }}>
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" fw={600} lineClamp={2} style={{ minWidth: 0 }}>
                                  {r.companyName}
                                </Text>
                                {r.mapsUrl ? (
                                  <ActionIcon
                                    component="a"
                                    href={r.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    variant="subtle"
                                    color="gray"
                                    size="sm"
                                    aria-label="Abrir no Google Maps"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <MapPin size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  </ActionIcon>
                                ) : null}
                              </Group>
                              <Text size="xs" c={colors.textMuted} mt={2}>
                                {r.city || "—"}
                              </Text>
                            </Box>
                          </Group>
                          <ResultStatusBadge r={r} />
                        </Group>

                        <Group gap={8} wrap="wrap" mb={10}>
                          <Text size="sm">{r.phoneE164 || r.phoneRaw || "—"}</Text>
                          <TemperatureBadge value={r.temperature} />
                        </Group>

                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-sm"
                          fullWidth
                          leftSection={<Trash2 size={14} />}
                          onClick={() =>
                            setPendingDelete({ id: r.id, name: r.companyName })
                          }
                        >
                          Excluir
                        </Button>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={720}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th />
                        <Table.Th>Empresa</Table.Th>
                        <Table.Th>Telefone</Table.Th>
                        <Table.Th>Temperatura</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {results.map((r) => {
                        const canSelect =
                          !r.isDuplicate && !r.discarded && Boolean(r.phoneE164) && !r.leadId;
                        return (
                          <Table.Tr key={r.id}>
                            <Table.Td>
                              <Checkbox
                                checked={selected.includes(r.id)}
                                disabled={!canSelect}
                                onChange={() => toggleSelect(r.id)}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Group gap={6} wrap="nowrap">
                                  <Text size="sm" fw={600}>
                                    {r.companyName}
                                  </Text>
                                  {r.mapsUrl ? (
                                    <Tooltip label="Abrir no Google Maps">
                                      <ActionIcon
                                        component="a"
                                        href={r.mapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label="Abrir no Google Maps"
                                      >
                                        <MapPin size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                      </ActionIcon>
                                    </Tooltip>
                                  ) : null}
                                </Group>
                                <Text size="xs" c={colors.textMuted}>
                                  {r.city || "—"}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{r.phoneE164 || r.phoneRaw || "—"}</Text>
                            </Table.Td>
                            <Table.Td>
                              <TemperatureBadge value={r.temperature} />
                            </Table.Td>
                            <Table.Td>
                              <ResultStatusBadge r={r} />
                            </Table.Td>
                            <Table.Td>
                              <Button
                                variant="subtle"
                                color="red"
                                size="compact-sm"
                                leftSection={<Trash2 size={14} />}
                                onClick={() =>
                                  setPendingDelete({ id: r.id, name: r.companyName })
                                }
                              >
                                Excluir
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel value="historico" pt={{ base: "md", sm: "lg" }}>
          <Card padding={isMobile ? "sm" : 0} style={{ minWidth: 0 }}>
            {historyLoading ? (
              <Center mih={200}>
                <Loader color="orbix" />
              </Center>
            ) : history.length === 0 ? (
              <EmptyState
                title="Nenhuma captura ainda"
                description="As filas geradas aparecerão aqui com cidade, segmento e status."
              />
            ) : isMobile ? (
              <Stack gap={10}>
                {history.map((row) => {
                  const st = normalizeJobStatus(row.status);
                  const cancellable = st === "queued" || st === "running";
                  return (
                      <Box
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void openHistoryJob(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void openHistoryJob(row);
                          }
                        }}
                        style={{
                          border: `1px solid ${colors.borderLight}`,
                          borderRadius: 10,
                          padding: 12,
                          background: colors.surface,
                          cursor: "pointer",
                          minWidth: 0,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" gap="sm" mb={8} wrap="nowrap">
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" fw={700} lineClamp={1}>
                              {row.city}
                            </Text>
                            <Text size="xs" c={colors.textMuted} lineClamp={2}>
                              {row.segment}
                            </Text>
                          </Box>
                          <Badge color={statusColor(st)} variant="light" style={{ flexShrink: 0 }}>
                            {statusLabel[st] || row.status}
                          </Badge>
                        </Group>

                        <SimpleGrid cols={2} spacing={8} mb={cancellable ? 10 : 0}>
                          <Box>
                            <Text size="xs" c={colors.textMuted}>
                              Data
                            </Text>
                            <Text size="sm">
                              {dayjs(row.createdAt).format("DD/MM/YY HH:mm")}
                            </Text>
                          </Box>
                          <Box>
                            <Text size="xs" c={colors.textMuted}>
                              Quantidade
                            </Text>
                            <Text size="sm">{row.quantity}</Text>
                          </Box>
                          <Box>
                            <Text size="xs" c={colors.textMuted}>
                              Resultados
                            </Text>
                            <Text size="sm" c={colors.textSecondary} lineClamp={2}>
                              {st === "completed"
                                ? `${row.newCount} novos · ${row.existingCount} base`
                                : "—"}
                            </Text>
                          </Box>
                          <Box>
                            <Text size="xs" c={colors.textMuted}>
                              Créditos
                            </Text>
                            <Text size="sm">
                              {row.settledCredits}/{row.reservedCredits}
                            </Text>
                          </Box>
                        </SimpleGrid>

                        {(st === "failed" || st === "cancelled") && row.errorMessage ? (
                          <Text size="xs" c={colors.textMuted} mt={8} lineClamp={2}>
                            {row.errorMessage}
                          </Text>
                        ) : null}

                        {cancellable ? (
                          <Button
                            mt={10}
                            fullWidth
                            size="compact-sm"
                            variant="light"
                            color="red"
                            leftSection={<Ban size={14} strokeWidth={ICON_STROKE} />}
                            loading={cancellingId === row.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingCancel(row);
                            }}
                          >
                            Cancelar fila
                          </Button>
                        ) : null}
                      </Box>
                  );
                })}
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={960}>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                  <Table.Thead style={{ background: colors.background }}>
                    <Table.Tr>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Cidade</Table.Th>
                      <Table.Th>Segmento</Table.Th>
                      <Table.Th>Qtd</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Resultados</Table.Th>
                      <Table.Th>Créditos</Table.Th>
                      <Table.Th w={120} ta="center">
                        Ações
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((row) => {
                      const st = normalizeJobStatus(row.status);
                      const cancellable = st === "queued" || st === "running";
                      return (
                        <Table.Tr
                          key={row.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => void openHistoryJob(row)}
                        >
                          <Table.Td>
                            <Text size="sm">
                              {dayjs(row.createdAt).format("DD/MM/YYYY HH:mm")}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{row.city}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{row.segment}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{row.quantity}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={4}>
                              <Badge color={statusColor(st)} variant="light" w="fit-content">
                                {statusLabel[st] || row.status}
                              </Badge>
                              {(st === "failed" || st === "cancelled") && row.errorMessage ? (
                                <Text size="xs" c={colors.textMuted} lineClamp={2}>
                                  {row.errorMessage}
                                </Text>
                              ) : null}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c={colors.textSecondary}>
                              {st === "completed"
                                ? `${row.newCount} novos · ${row.existingCount} base · ${row.discardedCount} desc.`
                                : "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {row.settledCredits}/{row.reservedCredits}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center" onClick={(e) => e.stopPropagation()}>
                            {cancellable ? (
                              <Tooltip label="Cancelar fila">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  aria-label="Cancelar fila"
                                  loading={cancellingId === row.id}
                                  onClick={() => setPendingCancel(row)}
                                >
                                  <Ban size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                </ActionIcon>
                              </Tooltip>
                            ) : (
                              <Text size="xs" c={colors.textMuted}>
                                —
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={softDeleteResult}
        loading={deleting}
        title="Excluir resultado"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name ?? ""}"? Esta ação não pode ser desfeita.`}
      />

      <ConfirmModal
        opened={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        onConfirm={confirmCancel}
        loading={Boolean(cancellingId)}
        title="Cancelar captura"
        message={`Cancelar a captura em "${pendingCancel?.city ?? ""}" (${pendingCancel?.segment ?? ""})? Ela sai da fila, libera créditos reservados e permanece no histórico.`}
        confirmLabel="Cancelar fila"
        danger
      />
    </>
  );
}
