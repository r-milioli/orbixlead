"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ActionIcon,
  Anchor,
  Badge,
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
import { ArrowLeft, Archive, Globe, MapPin, MessageCircle, Phone, RotateCcw, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { TemperatureBadge } from "@/components/common/TemperatureBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Lead, PipelineStage, ScheduleItem } from "@/lib/types";
import { unwrapList, unwrapOne } from "@/lib/unwrap";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

function websiteHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
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
              {schedules.map((s) => (
                <Card key={s.id} padding="sm" withBorder shadow="none">
                  <Text size="sm" fw={600}>
                    {dayjs(s.scheduledAt).format("DD/MM/YYYY HH:mm")}
                  </Text>
                  <Text size="sm">{s.reason}</Text>
                  {s.notes ? (
                    <Text size="xs" c={colors.textMuted}>
                      {s.notes}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      <WhatsAppModal
        opened={waOpen}
        onClose={() => setWaOpen(false)}
        phoneE164={lead.phoneE164}
        companyName={lead.companyName}
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
        title="Encerrar jornada"
        message={
          pendingCloseReason === "converted"
            ? `Encerrar "${lead.companyName}" como convertido? Sai do Kanban e fica em Leads → Encerrados.`
            : `Encerrar "${lead.companyName}" como perdido? Sai do Kanban e fica em Leads → Encerrados.`
        }
        confirmLabel="Encerrar"
        danger={pendingCloseReason === "lost"}
      />
    </>
  );
}
