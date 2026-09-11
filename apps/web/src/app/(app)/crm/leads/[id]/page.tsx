"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, Archive, Globe, MapPin, MessageCircle, Phone, RotateCcw, Trash2, UserRound } from "lucide-react";
import dayjs from "dayjs";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  LEAD_CARD_MARKERS,
  cardMarkerStyle,
  normalizeCardMarker,
} from "@/lib/cardMarkers";
import type { Lead, PipelineStage, ScheduleItem } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";
import type { LeadCardMarker } from "@orbixlead/shared";

function websiteHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin, isOperador } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [waOpen, setWaOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingCloseReason, setPendingCloseReason] = useState<"converted" | "lost" | null>(
    null
  );
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [leadPayload, stageData] = await Promise.all([
        api(`/api/v1/leads/${params.id}`),
        api("/api/v1/stages"),
      ]);
      const leadData = unwrapOne<Lead & { schedules?: ScheduleItem[] }>(leadPayload, "lead");
      setLead(leadData);
      setNotes(leadData.notes || "");
      setStages(unwrapList<PipelineStage>(stageData, "stages"));
      setSchedules(leadData.schedules ?? []);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Lead não encontrado.",
      });
      router.push("/crm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const data = await api<{ users: { id: string; name: string; role: string }[] }>(
          "/api/v1/collaborators"
        );
        setOperators((data.users || []).filter((u) => u.role === "operador"));
      } catch {
        setOperators([]);
      }
    })();
  }, [isAdmin]);

  const setAssignee = async (assigneeId: string | null) => {
    if (!lead) return;
    setAssigning(true);
    try {
      const payload = await api(`/api/v1/leads/${lead.id}/assignee`, {
        method: "PATCH",
        body: { assigneeId },
      });
      setLead(unwrapOne<Lead>(payload, "lead"));
      setConfirmReleaseOpen(false);
      notifications.show({
        color: "green",
        title: assigneeId ? "Acompanhamento atualizado" : "Acompanhamento liberado",
        message: "",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao atualizar acompanhamento.",
      });
    } finally {
      setAssigning(false);
    }
  };

  const moveStage = async (stageId: string | null) => {
    if (!lead || !stageId) return;
    if (lead.closedAt) {
      notifications.show({
        color: "red",
        title: "Lead encerrado",
        message: "Reabra a jornada antes de mudar o estágio.",
      });
      return;
    }
    try {
      const payload = await api(`/api/v1/leads/${lead.id}/move`, {
        method: "PATCH",
        body: { stageId },
      });
      const updated = unwrapOne<Lead>(payload, "lead");
      setLead(updated);
      notifications.show({ color: "green", title: "Estágio atualizado", message: "" });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao mover.",
      });
    }
  };

  const closeLead = async () => {
    if (!lead || !pendingCloseReason) return;
    setClosing(true);
    try {
      const payload = await api(`/api/v1/leads/${lead.id}/close`, {
        method: "POST",
        body: { reason: pendingCloseReason },
      });
      setLead(unwrapOne<Lead>(payload, "lead"));
      setPendingCloseReason(null);
      notifications.show({
        color: "green",
        title: "Jornada encerrada",
        message: "O lead saiu do Kanban ativo e ficou em Encerrados.",
      });
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

  const reopenLead = async () => {
    if (!lead) return;
    setReopening(true);
    try {
      const payload = await api(`/api/v1/leads/${lead.id}/reopen`, { method: "POST" });
      setLead(unwrapOne<Lead>(payload, "lead"));
      notifications.show({
        color: "green",
        title: "Lead reaberto",
        message: "Voltou ao pipeline ativo.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao reabrir.",
      });
    } finally {
      setReopening(false);
    }
  };

  const saveNotes = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const updatedPayload = await api(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        body: { notes },
      });
      setLead(unwrapOne<Lead>(updatedPayload, "lead"));
      notifications.show({ color: "green", title: "Anotações salvas", message: "" });
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

  const saveCardMarker = async (cardMarker: LeadCardMarker) => {
    if (!lead) return;
    const previous = lead;
    setLead({ ...lead, cardMarker });
    try {
      const updatedPayload = await api(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        body: { cardMarker },
      });
      setLead(unwrapOne<Lead>(updatedPayload, "lead"));
    } catch (err) {
      setLead(previous);
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao atualizar destaque.",
      });
    }
  };

  const createSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!lead || !scheduledAt || !reason.trim()) return;
    setSaving(true);
    try {
      await api("/api/v1/schedules", {
        method: "POST",
        body: {
          leadId: lead.id,
          scheduledAt: scheduledAt.toISOString(),
          reason: reason.trim(),
          notes: scheduleNotes.trim() || undefined,
        },
      });
      setReason("");
      setScheduleNotes("");
      setScheduledAt(null);
      notifications.show({ color: "green", title: "Agendamento criado", message: "" });
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao agendar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const softDelete = async () => {
    if (!lead || !isAdmin) return;
    setDeleting(true);
    try {
      await api(`/api/v1/leads/${lead.id}`, { method: "DELETE" });
      notifications.show({ color: "green", title: "Lead excluído", message: "" });
      setConfirmDeleteOpen(false);
      router.push("/crm");
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

  if (loading || !lead) {
    return (
      <Center mih={320}>
        <Loader color="orbix" />
      </Center>
    );
  }

  const socialList = Array.isArray(lead.socialUrls)
    ? lead.socialUrls
    : lead.socialUrls
      ? Object.values(lead.socialUrls)
      : [];

  return (
    <>
      <Anchor component={Link} href="/crm" size="sm" c={colors.textSecondary} mb="md">
        <Group gap={6}>
          <ArrowLeft size={16} />
          Voltar ao CRM
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" mb="xl" wrap="wrap">
        <div>
          <Title order={2} mb={8}>
            {lead.companyName}
          </Title>
          <Group gap="sm">
            <TemperatureBadge value={lead.temperature} />
            {lead.closedAt ? (
              <Badge
                variant="light"
                color={(lead.closedReason || "").toLowerCase() === "converted" ? "green" : "gray"}
              >
                Encerrado ·{" "}
                {(lead.closedReason || "").toLowerCase() === "converted"
                  ? "Convertido"
                  : (lead.closedReason || "").toLowerCase() === "lost"
                    ? "Perdido"
                    : "Arquivado"}
              </Badge>
            ) : null}
            <Text size="sm" c={colors.textMuted}>
              {lead.city || "—"}
              {lead.segment ? ` · ${lead.segment}` : ""}
            </Text>
          </Group>
        </div>
        <Group>
          <Button
            variant="default"
            leftSection={<Phone size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
            component="a"
            href={`tel:${lead.phoneE164}`}
          >
            Ligar
          </Button>
          <Button
            leftSection={<MessageCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
            onClick={() => setWaOpen(true)}
          >
            WhatsApp
          </Button>
          {lead.mapsUrl ? (
            <Button
              variant="light"
              leftSection={<MapPin size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              component="a"
              href={lead.mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Maps
            </Button>
          ) : null}
          {lead.closedAt ? (
            <Button
              variant="light"
              leftSection={<RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              loading={reopening}
              onClick={() => void reopenLead()}
            >
              Reabrir
            </Button>
          ) : (
            <>
              <Button
                variant="light"
                color="green"
                leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                onClick={() => setPendingCloseReason("converted")}
              >
                Converter
              </Button>
              <Button
                variant="light"
                color="gray"
                leftSection={<Archive size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                onClick={() => setPendingCloseReason("lost")}
              >
                Perder
              </Button>
            </>
          )}
          {isAdmin ? (
            <Button
              color="red"
              variant="light"
              leftSection={<Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Excluir
            </Button>
          ) : null}
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card padding="lg">
          <Title order={4} mb="md">
            Informações
          </Title>
          <Stack gap="sm">
            <Select
              label="Estágio"
              data={stages.map((s) => ({ value: s.id, label: s.label }))}
              value={lead.stageId}
              onChange={(v) => void moveStage(v)}
              disabled={Boolean(lead.closedAt)}
              description={
                lead.closedAt
                  ? "Lead encerrado — reabra para alterar o estágio"
                  : undefined
              }
            />

            <div>
              <Text size="sm" fw={600} mb={6}>
                Acompanhado por
              </Text>
              {lead.assignee ? (
                <Group gap="xs" mb={8}>
                  <Badge
                    variant="light"
                    color="orbix"
                    leftSection={<UserRound size={12} />}
                  >
                    {lead.assignee.name}
                  </Badge>
                  {lead.assigneeId === user?.id ? (
                    <Text size="xs" c={colors.textMuted}>
                      (você)
                    </Text>
                  ) : null}
                </Group>
              ) : (
                <Text size="sm" c={colors.textMuted} mb={8}>
                  Ninguém — disponível para assumir
                </Text>
              )}

              {!lead.closedAt ? (
                <Stack gap="xs">
                  {isAdmin ? (
                    <Select
                      placeholder="Definir operador"
                      searchable
                      clearable
                      data={operators.map((o) => ({ value: o.id, label: o.name }))}
                      value={lead.assigneeId ?? null}
                      disabled={assigning}
                      onChange={(v) => void setAssignee(v)}
                      description="Somente admin pode trocar o operador responsável"
                    />
                  ) : null}

                  {isOperador && !lead.assigneeId ? (
                    <Button
                      size="xs"
                      variant="light"
                      loading={assigning}
                      leftSection={<UserRound size={14} />}
                      onClick={() => void setAssignee(user!.id)}
                      w="fit-content"
                    >
                      Assumir acompanhamento
                    </Button>
                  ) : null}

                  {isOperador && lead.assigneeId === user?.id ? (
                    <Button
                      size="xs"
                      variant="default"
                      loading={assigning}
                      onClick={() => setConfirmReleaseOpen(true)}
                      w="fit-content"
                    >
                      Liberar acompanhamento
                    </Button>
                  ) : null}

                  {isOperador &&
                  lead.assigneeId &&
                  lead.assigneeId !== user?.id ? (
                    <Text size="xs" c={colors.textMuted}>
                      Outro operador já acompanha este lead. Só ele pode liberar, ou um
                      admin pode reatribuir.
                    </Text>
                  ) : null}
                </Stack>
              ) : null}
            </div>

            <TextInput label="Telefone" value={lead.phoneE164} readOnly />
            <TextInput label="Cidade" value={lead.city || ""} readOnly />
            <TextInput label="Endereço" value={lead.address || ""} readOnly />
            <TextInput
              label="Site"
              value={lead.website || "Sem site"}
              readOnly
              rightSection={
                lead.website ? (
                  <Tooltip label="Abrir site">
                    <ActionIcon
                      component="a"
                      href={websiteHref(lead.website)}
                      target="_blank"
                      rel="noreferrer"
                      variant="subtle"
                      color="orbix"
                      aria-label="Abrir site"
                    >
                      <Globe size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Tooltip label="Site não disponível">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      disabled
                      aria-label="Site não disponível"
                    >
                      <Globe size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </ActionIcon>
                  </Tooltip>
                )
              }
              rightSectionPointerEvents="all"
            />
            <div>
              <Text size="sm" fw={600} mb={6}>
                Google Maps
              </Text>
              {lead.mapsUrl ? (
                <Button
                  component="a"
                  href={lead.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="default"
                  size="sm"
                  leftSection={<MapPin size={16} strokeWidth={ICON_STROKE} />}
                >
                  Abrir perfil
                </Button>
              ) : (
                <Text size="sm" c={colors.textMuted}>
                  Não disponível
                </Text>
              )}
            </div>
            <div>
              <Text size="sm" fw={600} mb={4}>
                Redes sociais
              </Text>
              {socialList.length === 0 ? (
                <Text size="sm" c={colors.textMuted}>
                  Nenhuma
                </Text>
              ) : (
                socialList.map((url) => (
                  <Text key={String(url)} size="sm" component="a" href={String(url)} target="_blank">
                    {String(url)}
                  </Text>
                ))
              )}
            </div>
            <Divider my="xs" />
            <Select
              label="Destaque no pipeline"
              description="Cor do card no Kanban para prioridade e status visual"
              data={LEAD_CARD_MARKERS.map((m) => ({
                value: m.value,
                label: `${m.label} — ${m.description}`,
              }))}
              value={normalizeCardMarker(lead.cardMarker)}
              onChange={(value) => {
                if (value) void saveCardMarker(value as LeadCardMarker);
              }}
              allowDeselect={false}
              leftSection={
                <Box
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    ...cardMarkerStyle(lead.cardMarker),
                    borderWidth: 2,
                    borderStyle: "solid",
                  }}
                />
              }
            />
            <Textarea
              label="Anotações"
              minRows={4}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <Button onClick={() => void saveNotes()} loading={saving} w="fit-content">
              Salvar anotações
            </Button>
          </Stack>
        </Card>

        <Card padding="lg">
          <Title order={4} mb="md">
            Agendamento
          </Title>
          <form onSubmit={createSchedule}>
            <Stack gap="sm">
              <DateTimePicker
                label="Data e hora"
                value={scheduledAt}
                onChange={(v) => {
                  if (!v) {
                    setScheduledAt(null);
                    return;
                  }
                  setScheduledAt(v instanceof Date ? v : new Date(String(v)));
                }}
                locale="pt-br"
                valueFormat="DD/MM/YYYY HH:mm"
              />
              <TextInput
                label="Motivo"
                required
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <Textarea
                label="Anotações"
                minRows={3}
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.currentTarget.value)}
              />
              <Button type="submit" loading={saving}>
                Agendar retorno
              </Button>
            </Stack>
          </form>

          <Divider my="lg" />
          <Title order={5} mb="sm">
            Próximos agendamentos
          </Title>
          {schedules.length === 0 ? (
            <Text size="sm" c={colors.textMuted}>
              Nenhum agendamento para este lead.
            </Text>
          ) : (
            <Stack gap="sm">
              {schedules.map((s) => {
                const cancelled = (s.status || "").toLowerCase() === "cancelled";
                return (
                  <Card key={s.id} padding="sm" withBorder shadow="none">
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                      <div style={{ minWidth: 0 }}>
                        <Group gap={8} mb={4}>
                          <Text
                            size="sm"
                            fw={600}
                            style={{ textDecoration: cancelled ? "line-through" : undefined }}
                          >
                            {dayjs(s.scheduledAt).format("DD/MM/YYYY HH:mm")}
                          </Text>
                          {cancelled ? (
                            <Text size="xs" c={colors.textMuted}>
                              Cancelado
                            </Text>
                          ) : null}
                        </Group>
                        <Text size="sm">{s.reason}</Text>
                        {s.notes ? (
                          <Text size="xs" c={colors.textMuted}>
                            {s.notes}
                          </Text>
                        ) : null}
                      </div>
                      <Group gap={4} wrap="nowrap">
                        {!cancelled ? (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            onClick={async () => {
                              try {
                                const payload = await api(`/api/v1/schedules/${s.id}/cancel`, {
                                  method: "POST",
                                });
                                const updated = unwrapOne<ScheduleItem>(payload, "schedule");
                                setSchedules((prev) =>
                                  prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
                                );
                                notifications.show({
                                  color: "gray",
                                  title: "Cancelado",
                                  message: "Agendamento cancelado.",
                                });
                              } catch (err) {
                                notifications.show({
                                  color: "red",
                                  title: "Erro",
                                  message:
                                    err instanceof ApiError ? err.message : "Falha ao cancelar.",
                                });
                              }
                            }}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          onClick={async () => {
                            try {
                              await api(`/api/v1/schedules/${s.id}`, { method: "DELETE" });
                              setSchedules((prev) => prev.filter((x) => x.id !== s.id));
                              notifications.show({
                                color: "green",
                                title: "Excluído",
                                message: "Agendamento removido.",
                              });
                            } catch (err) {
                              notifications.show({
                                color: "red",
                                title: "Erro",
                                message:
                                  err instanceof ApiError ? err.message : "Falha ao excluir.",
                              });
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}
          <Text size="xs" c={colors.textMuted} mt="sm">
            Para editar ou reagendar, use a página Agenda.
          </Text>
        </Card>
      </SimpleGrid>

      <WhatsAppModal
        opened={waOpen}
        onClose={() => setWaOpen(false)}
        phoneE164={lead.phoneE164}
        companyName={lead.companyName}
      />

      <ConfirmModal
        opened={confirmReleaseOpen}
        onClose={() => setConfirmReleaseOpen(false)}
        onConfirm={() => setAssignee(null)}
        loading={assigning}
        title="Liberar acompanhamento"
        message={`Liberar o lead "${lead.companyName}"? Ele ficará disponível para qualquer operador assumir.`}
        confirmLabel="Liberar"
        danger={false}
      />

      <ConfirmModal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={softDelete}
        loading={deleting}
        title="Excluir lead"
        message={`Tem certeza que deseja excluir "${lead.companyName}"? O lead será removido do CRM e a ação será registrada.`}
      />

      <ConfirmModal
        opened={Boolean(pendingCloseReason)}
        onClose={() => setPendingCloseReason(null)}
        onConfirm={closeLead}
        loading={closing}
        title={pendingCloseReason === "converted" ? "Converter lead" : "Encerrar jornada"}
        message={
          pendingCloseReason === "converted"
            ? lead.assignee
              ? `Encerrar "${lead.companyName}" como convertido?\n\nA conversão será contabilizada na meta individual de ${lead.assignee.name} e também na meta da empresa.`
              : `Encerrar "${lead.companyName}" como convertido?\n\nNão há operador acompanhando este lead. A conversão contará apenas na meta da empresa (sem crédito individual).`
            : `Encerrar "${lead.companyName}" como perdido? Sai do Kanban e fica em Leads → Encerrados.`
        }
        confirmLabel={pendingCloseReason === "converted" ? "Converter" : "Encerrar"}
        danger={pendingCloseReason === "lost"}
      />
    </>
  );
}
