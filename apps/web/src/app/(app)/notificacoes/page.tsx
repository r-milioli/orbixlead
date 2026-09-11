"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { notifications as toast } from "@mantine/notifications";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { api, ApiError } from "@/lib/api";
import { emitNotificationsChanged } from "@/lib/notifications-events";
import type { AppNotification } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type TabFilter = "all" | "unread" | "read";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacoesPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ notifications: AppNotification[] }>(
        "/api/v1/notifications?status=all&take=200"
      );
      setItems(unwrapList<AppNotification>(data, "notifications"));
    } catch (err) {
      toast.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar notificações.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
  const readCount = useMemo(() => items.filter((n) => Boolean(n.readAt)).length, [items]);

  const visible = useMemo(() => {
    if (tab === "unread") return items.filter((n) => !n.readAt);
    if (tab === "read") return items.filter((n) => Boolean(n.readAt));
    return items;
  }, [items, tab]);

  const markRead = async (id: string) => {
    setBusyId(id);
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
      );
      emitNotificationsChanged();
    } catch (err) {
      toast.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Não foi possível marcar como lida.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api("/api/v1/notifications/read-all", { method: "POST" });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
      emitNotificationsChanged();
      toast.show({ color: "green", title: "Tudo marcado como lido", message: "" });
    } catch (err) {
      toast.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao marcar todas.",
      });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Histórico completo. O sininho mostra apenas as não lidas."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="default"
              leftSection={<CheckCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              loading={markingAll}
              onClick={() => void markAllRead()}
            >
              Marcar todas como lidas
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onChange={(v) => setTab((v as TabFilter) || "all")} color="orbix" mb="lg">
        <Tabs.List>
          <Tabs.Tab value="all">Todas ({items.length})</Tabs.Tab>
          <Tabs.Tab value="unread">Não lidas ({unreadCount})</Tabs.Tab>
          <Tabs.Tab value="read">Lidas ({readCount})</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <Center mih={240}>
          <Loader color="orbix" />
        </Center>
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            tab === "unread"
              ? "Nenhuma notificação não lida"
              : tab === "read"
                ? "Nenhuma notificação lida"
                : "Nenhuma notificação"
          }
          description={
            tab === "unread"
              ? "Quando houver novidades, elas aparecem aqui e no sininho."
              : "As notificações lidas ficam nesta página para consulta."
          }
          icon={tab === "unread" ? Bell : BellOff}
        />
      ) : (
        <Stack gap="sm">
          {visible.map((n) => {
            const unread = !n.readAt;
            return (
              <Card
                key={n.id}
                padding="md"
                withBorder
                style={{
                  background: unread ? colors.primaryLight : colors.surface,
                  borderColor: unread ? colors.primary : colors.border,
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap={8} mb={4}>
                      <Text fw={700} style={{ letterSpacing: "-0.01em" }}>
                        {n.title}
                      </Text>
                      {unread ? (
                        <Badge size="sm" color="orbix" variant="filled">
                          Nova
                        </Badge>
                      ) : (
                        <Badge size="sm" color="gray" variant="light">
                          Lida
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c={colors.textSecondary}>
                      {n.body}
                    </Text>
                    <Text size="xs" c={colors.textMuted} mt={8}>
                      {formatWhen(n.createdAt)}
                    </Text>
                  </Box>
                  {unread ? (
                    <Button
                      size="xs"
                      variant="light"
                      loading={busyId === n.id}
                      onClick={() => void markRead(n.id)}
                    >
                      Marcar como lida
                    </Button>
                  ) : null}
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
