"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { Calendar, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { api, ApiError } from "@/lib/api";
import type { ScheduleItem } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors } from "@/theme/tokens";

export default function AgendaPage() {
  const [range, setRange] = useState<[Date | null, Date | null]>([
    dayjs().startOf("week").toDate(),
    dayjs().endOf("week").toDate(),
  ]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ScheduleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = useMemo(() => {
    const [from, to] = range;
    const params = new URLSearchParams();
    if (from) params.set("from", from.toISOString());
    if (to) params.set("to", to.toISOString());
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

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/schedules/${pendingDelete.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
      setPendingDelete(null);
      notifications.show({
        color: "green",
        title: "Agendamento removido",
        message: "O retorno foi excluído da agenda.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao remover.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Retornos e compromissos com leads"
        actions={
          <DatePickerInput
            type="range"
            value={range}
            onChange={(v) =>
              setRange([
                v[0] ? (v[0] instanceof Date ? v[0] : new Date(String(v[0]))) : null,
                v[1] ? (v[1] instanceof Date ? v[1] : new Date(String(v[1]))) : null,
              ])
            }
            locale="pt-br"
            valueFormat="DD/MM/YYYY"
            w={280}
          />
        }
      />

      {loading ? (
        <Center mih={240}>
          <Loader color="orbix" />
        </Center>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento"
          description="Crie agendamentos na página do lead."
          icon={Calendar}
        />
      ) : (
        <Stack gap="sm">
          {items.map((item) => (
            <Card key={item.id} padding="md" withBorder>
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <div>
                  <Text size="xs" c={colors.textMuted} mb={4}>
                    {dayjs(item.scheduledAt).format("dddd, DD/MM/YYYY · HH:mm")}
                  </Text>
                  <Title order={5} mb={4}>
                    {item.lead?.companyName || "Lead"}
                  </Title>
                  <Text size="sm" fw={600}>
                    {item.reason}
                  </Text>
                  {item.notes ? (
                    <Text size="sm" c={colors.textSecondary} mt={4}>
                      {item.notes}
                    </Text>
                  ) : null}
                  {item.leadId ? (
                    <Button
                      component={Link}
                      href={`/crm/leads/${item.leadId}`}
                      variant="subtle"
                      size="compact-sm"
                      mt="xs"
                      px={0}
                    >
                      Abrir lead
                    </Button>
                  ) : null}
                </div>
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => setPendingDelete(item)}
                >
                  Remover
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title="Remover agendamento"
        message={`Tem certeza que deseja remover o agendamento "${pendingDelete?.reason ?? ""}" de ${pendingDelete?.lead?.companyName ?? "lead"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
      />
    </>
  );
}
