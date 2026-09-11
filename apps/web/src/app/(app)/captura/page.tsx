"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { maxJobQuantity } from "@orbixlead/shared";
import { Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { ScrapingJob, ScrapingResult } from "@/lib/types";
import { normalizeJobStatus } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors } from "@/theme/tokens";

const statusLabel: Record<string, string> = {
  queued: "Na fila",
  running: "Processando",
  completed: "Concluída",
  failed: "Falhou",
};

export default function CapturaPage() {
  const { tenant, refresh } = useAuth();
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

  const unlimited = Boolean(tenant?.unlimited);
  const remaining = tenant?.creditRemaining ?? 0;
  const maxQty = maxJobQuantity(remaining, unlimited);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

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
        if (st === "completed" || st === "failed") {
          clearPoll();
          await loadResults(jobId);
          await refresh();
          if (st === "completed") {
            notifications.show({
              color: "green",
              title: "Captura concluída",
              message: `${updated.newCount} novos · ${updated.existingCount} já na base`,
            });
          } else {
            notifications.show({
              color: "red",
              title: "Captura falhou",
              message: updated.errorMessage || "Tente novamente.",
            });
          }
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
  };

  useEffect(() => () => clearPoll(), []);

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

  const jobStatus = job ? normalizeJobStatus(job.status) : null;

  return (
    <>
      <PageHeader
        title="Captura"
        subtitle="Busque leads no Brasil por cidade e segmentação"
      />

      <Card padding="lg" mb="xl">
        <Title order={4} mb="md">
          Nova captura
        </Title>
        <form onSubmit={onSubmit}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
            <TextInput label="País" value="Brasil" disabled />
            <TextInput
              label="Cidade"
              required
              placeholder="Ex.: São Paulo"
              value={city}
              onChange={(e) => setCity(e.currentTarget.value)}
            />
            <TextInput
              label="Segmentação"
              required
              placeholder="Ex.: clínicas odontológicas"
              value={segment}
              onChange={(e) => setSegment(e.currentTarget.value)}
            />
            <NumberInput
              label="Quantidade"
              required
              min={1}
              max={maxQty}
              value={quantity}
              onChange={setQuantity}
              description={
                unlimited
                  ? `Máximo ${maxQty} por busca`
                  : `Restam ${remaining} créditos · máx. ${maxQty}`
              }
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button
              type="submit"
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
        <Card padding="lg" mb="xl">
          <Group justify="space-between" mb="sm">
            <div>
              <Text fw={600}>Status da captura</Text>
              <Text size="sm" c={colors.textMuted}>
                {job.city} · {job.segment} · {job.quantity} leads
              </Text>
            </div>
            <Badge
              color={
                jobStatus === "completed"
                  ? "green"
                  : jobStatus === "failed"
                    ? "red"
                    : "orbix"
              }
              variant="light"
            >
              {statusLabel[jobStatus || ""] || job.status}
            </Badge>
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
        </Card>
      ) : null}

      {jobStatus === "completed" ? (
        <Card padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Resultados</Title>
            <Group>
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
          </Group>

          {results.length === 0 ? (
            <EmptyState
              title="Nenhum resultado"
              description="Esta captura não retornou leads novos."
            />
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
                            <Text size="sm" fw={600}>
                              {r.companyName}
                            </Text>
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
                          {r.leadId ? (
                            <Badge variant="light" color="green">
                              No CRM
                            </Badge>
                          ) : r.isDuplicate ? (
                            <Badge variant="light" color="gray">
                              Já na base
                            </Badge>
                          ) : r.discarded ? (
                            <Badge variant="light" color="red">
                              Descartado
                            </Badge>
                          ) : (
                            <Badge variant="light" color="orbix">
                              Novo
                            </Badge>
                          )}
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

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={softDeleteResult}
        loading={deleting}
        title="Excluir resultado"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name ?? ""}"? Esta ação não pode ser desfeita.`}
      />
    </>
  );
}
