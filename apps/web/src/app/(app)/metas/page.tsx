"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { goalMetrics } from "@orbixlead/shared";
import { Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Goal } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors } from "@/theme/tokens";

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function GoalCard({ goal }: { goal: Goal }) {
  const target = goal.targetConversions;
  const current = goal.convertedCount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const preco = Number(goal.precoVenda);
  const custo = Number(goal.custoPorConversao);
  const metrics = goalMetrics({
    precoVenda: preco,
    conversoesAlvo: target,
    custoPorConversao: custo,
  });

  return (
    <Card padding="lg" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={5}>{goal.name}</Title>
        <Text size="xs" c={colors.textMuted} tt="uppercase" fw={600}>
          {String(goal.periodType).toLowerCase() === "monthly"
            ? "Mensal"
            : String(goal.periodType).toLowerCase() === "weekly"
              ? "Semanal"
              : "Diária"}
        </Text>
      </Group>
      <Text size="sm" c={colors.textSecondary} mb={8}>
        {current} de {target} conversões
      </Text>
      <Progress value={pct} color="orbix" size="md" mb={6} />
      <Text size="sm" fw={700} c={colors.primary} mb="md">
        {pct}%
      </Text>
      <SimpleGrid cols={2} spacing="xs">
        <Text size="xs" c={colors.textMuted}>
          Faturamento
        </Text>
        <Text size="xs" fw={600} ta="right">
          {money(metrics.faturamento)}
        </Text>
        <Text size="xs" c={colors.textMuted}>
          Custo
        </Text>
        <Text size="xs" fw={600} ta="right">
          {money(metrics.custoTotal)}
        </Text>
        <Text size="xs" c={colors.textMuted}>
          Lucro
        </Text>
        <Text size="xs" fw={600} ta="right">
          {money(metrics.lucro)} ({(metrics.lucroPercent * 100).toFixed(0)}%)
        </Text>
      </SimpleGrid>

      {goal.children && goal.children.length > 0 ? (
        <Stack gap="sm" mt="md">
          <Text size="xs" fw={600} c={colors.textMuted}>
            Desdobramentos
          </Text>
          {goal.children.map((child) => (
            <GoalCard key={child.id} goal={child} />
          ))}
        </Stack>
      ) : null}
    </Card>
  );
}

export default function MetasPage() {
  const { tenant } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState<number | string>(new Date().getFullYear());
  const [month, setMonth] = useState<number | string>(new Date().getMonth() + 1);
  const [targetConversions, setTargetConversions] = useState<number | string>(20);
  const [precoVenda, setPrecoVenda] = useState<number | string>(500);
  const [custoPorConversao, setCustoPorConversao] = useState<number | string>(
    Number(tenant?.avgLeadCost ?? 2.5)
  );
  const [parentId, setParentId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<string>("monthly");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/v1/goals?tree=1");
      setGoals(unwrapList<Goal>(data, "goals"));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar metas.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const monthlyRoots = useMemo(() => {
    const list = goals.filter((g) => {
      const t = String(g.periodType).toLowerCase();
      return t === "monthly" && !g.parentId;
    });
    if (list.length > 0) return list;
    // API may already return tree
    return goals.filter((g) => !g.parentId);
  }, [goals]);

  const preview = goalMetrics({
    precoVenda: Number(precoVenda) || 0,
    conversoesAlvo: Number(targetConversions) || 0,
    custoPorConversao: Number(custoPorConversao) || 0,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/goals", {
        method: "POST",
        body: {
          name,
          periodType,
          year: Number(year),
          month: periodType === "daily" || periodType === "monthly" || periodType === "weekly"
            ? Number(month)
            : undefined,
          targetConversions: Number(targetConversions),
          precoVenda: Number(precoVenda),
          custoPorConversao: Number(custoPorConversao),
          parentId: parentId || undefined,
        },
      });
      setName("");
      notifications.show({ color: "green", title: "Meta criada", message: "" });
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao criar meta.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Metas" subtitle="Metas mensais com desdobramento semanal e diário" />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mb="xl">
        <Card padding="lg">
          <Title order={4} mb="md">
            Nova meta
          </Title>
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Nome da meta"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <Select
                label="Período"
                data={[
                  { value: "monthly", label: "Mensal" },
                  { value: "weekly", label: "Semanal" },
                  { value: "daily", label: "Diária" },
                ]}
                value={periodType}
                onChange={(v) => setPeriodType(v || "monthly")}
              />
              {periodType !== "monthly" ? (
                <Select
                  label="Meta pai (mensal)"
                  clearable
                  data={monthlyRoots.map((g) => ({ value: g.id, label: g.name }))}
                  value={parentId}
                  onChange={setParentId}
                />
              ) : null}
              <SimpleGrid cols={2}>
                <NumberInput label="Ano" value={year} onChange={setYear} required />
                <NumberInput
                  label="Mês"
                  min={1}
                  max={12}
                  value={month}
                  onChange={setMonth}
                  required
                />
              </SimpleGrid>
              <NumberInput
                label="Conversões alvo"
                min={1}
                value={targetConversions}
                onChange={setTargetConversions}
                required
              />
              <NumberInput
                label="Preço de venda (R$)"
                min={0}
                decimalScale={2}
                value={precoVenda}
                onChange={setPrecoVenda}
                required
              />
              <NumberInput
                label="Custo por conversão (R$)"
                min={0}
                decimalScale={2}
                value={custoPorConversao}
                onChange={setCustoPorConversao}
                required
              />
              <Card withBorder shadow="none" padding="sm" bg={colors.surfaceSecondary}>
                <Text size="xs" fw={600} mb={6}>
                  Resultado previsto
                </Text>
                <Text size="sm">Faturamento: {money(preview.faturamento)}</Text>
                <Text size="sm">Custo: {money(preview.custoTotal)}</Text>
                <Text size="sm">
                  Lucro: {money(preview.lucro)} ({(preview.lucroPercent * 100).toFixed(0)}%)
                </Text>
              </Card>
              <Button type="submit" leftSection={<Plus size={16} />} loading={saving}>
                Criar meta
              </Button>
            </Stack>
          </form>
        </Card>

        <div>
          {loading ? (
            <Center mih={240}>
              <Loader color="orbix" />
            </Center>
          ) : monthlyRoots.length === 0 ? (
            <EmptyState
              title="Nenhuma meta"
              description="Crie uma meta mensal para acompanhar conversões."
              icon={Target}
            />
          ) : (
            <Stack gap="md">
              {monthlyRoots.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </Stack>
          )}
        </div>
      </SimpleGrid>
    </>
  );
}
