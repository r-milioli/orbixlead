"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart } from "@mantine/charts";
import {
  Box,
  Button,
  Card,
  Group,
  Progress,
  RingProgress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { LayoutDashboard, Plus, RefreshCw, Target, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

const COMPANY_VIEW = "__company__";

type GoalFinancial = {
  faturamento: number;
  custoTotal: number;
  lucro: number;
  lucroPercent: number;
};

type GoalProgressItem = {
  id: string;
  name: string;
  target: number;
  current: number;
  remaining?: number;
  progress: number;
  precoVenda?: number;
  custoPorConversao?: number;
  predicted?: GoalFinancial;
  realized?: GoalFinancial;
  remainingRevenue?: number;
  scope: "company" | "operator";
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
};

type MetricsResponse = {
  metrics: {
    filter: {
      year: number;
      month: number;
      isCurrentMonth: boolean;
      label: string;
    };
    scope: "company" | "operator";
    selectedGoalId: string;
    funnel: { slug: string; label: string; count: number }[];
    kpis: {
      conversionRate: number;
      conversionRateMonth: number;
      costPerConversion: number | null;
      leadsLast7Days: number;
      convertedLast7Days: number;
      importedToday: number;
      convertedToday: number;
      capturesToday: number;
      leadsFoundToday: number;
      capturesMonth: number;
      leadsFoundMonth: number;
    };
    period: {
      importedLeads: number;
      conversions: number;
      avgLeadCost: number;
      costPerConversion: number | null;
    };
    goal: GoalProgressItem | null;
    availableGoals: GoalProgressItem[];
    companyGoals: GoalProgressItem[];
    operatorGoals: GoalProgressItem[];
    prospection30d: { day: string; imported: number; converted: number }[];
    conversionsBySegment: { segment: string; count: number }[];
    upcomingSchedules: number;
  };
};

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `R$ ${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function goalSelectLabel(g: GoalProgressItem) {
  if (g.scope === "operator") {
    const who = g.assignee?.name ? ` · ${g.assignee.name}` : "";
    return `Operador${who} · ${g.name}`;
  }
  return `Empresa · ${g.name}`;
}

function buildMonthOptions(now = new Date()) {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return options;
}

function currentMonthValue(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function KpiCard({
  label,
  value,
  delta,
  positive = true,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}) {
  const Trend = positive ? TrendingUp : TrendingDown;
  return (
    <Card padding={16}>
      <Text size="sm" c={colors.textMuted} style={{ fontWeight: 400, fontSize: 13 }}>
        {label}
      </Text>
      <Text
        mt={8}
        mb={delta ? 8 : 0}
        c={colors.textPrimary}
        style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}
      >
        {value}
      </Text>
      {delta ? (
        <Group gap={5} c={positive ? colors.success : colors.danger}>
          <Trend size={14} strokeWidth={ICON_STROKE} />
          <Text size="xs" style={{ fontWeight: 500, fontSize: 12 }}>
            {delta}
          </Text>
        </Group>
      ) : null}
    </Card>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box mb={18}>
      <Title order={3} style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
        {title}
      </Title>
      {subtitle ? (
        <Text size="xs" c={colors.textMuted} mt={4} style={{ fontSize: 12 }}>
          {subtitle}
        </Text>
      ) : null}
    </Box>
  );
}

function StatChip({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Box
      style={{
        background: colors.surfaceSecondary,
        borderRadius: 10,
        padding: "12px 14px",
        minHeight: 78,
      }}
    >
      <Text size="xs" c={colors.textMuted} mb={4} style={{ fontSize: 11, letterSpacing: "0.02em" }}>
        {label}
      </Text>
      <Text
        fw={700}
        style={{
          fontSize: 16,
          letterSpacing: "-0.02em",
          color: accent ?? colors.textPrimary,
          lineHeight: 1.2,
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text size="xs" c={colors.textMuted} mt={4} style={{ fontSize: 11 }}>
          {hint}
        </Text>
      ) : null}
    </Box>
  );
}

function GoalDetailCard({ goal }: { goal: GoalProgressItem }) {
  const hasTarget = goal.target > 0;
  const remaining = goal.remaining ?? Math.max(0, goal.target - goal.current);
  const pct = hasTarget ? Math.round(goal.progress * 100) : 0;
  const done = hasTarget && remaining === 0;
  const predicted = goal.predicted;
  const realized = goal.realized;

  return (
    <Box
      style={{
        border: `1px solid ${colors.borderLight}`,
        borderRadius: 12,
        padding: 16,
        background: `linear-gradient(165deg, ${colors.primaryLight} 0%, ${colors.surface} 42%)`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md" mb={14}>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group gap={8} mb={4}>
            <Target size={16} strokeWidth={ICON_STROKE} color={colors.primary} />
            <Text size="sm" fw={700} lineClamp={1} style={{ letterSpacing: "-0.01em" }}>
              {goal.name}
            </Text>
          </Group>
          {goal.scope === "operator" && goal.assignee?.name ? (
            <Text size="xs" c={colors.textMuted}>
              Responsável: {goal.assignee.name}
            </Text>
          ) : (
            <Text size="xs" c={colors.textMuted}>
              Meta mensal da empresa
            </Text>
          )}
          <Text mt={10} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {goal.current}
            <Text span c={colors.textMuted} style={{ fontSize: 16, fontWeight: 500 }}>
              {" "}
              / {hasTarget ? goal.target : "—"}
            </Text>
          </Text>
          <Text size="xs" c={colors.textSecondary} mt={2}>
            {done
              ? "Meta atingida"
              : hasTarget
                ? `Faltam ${remaining} convers${remaining === 1 ? "ão" : "ões"} para o alvo`
                : "Sem alvo definido"}
          </Text>
        </Box>

        {hasTarget ? (
          <RingProgress
            size={92}
            thickness={8}
            roundCaps
            sections={[{ value: Math.min(100, pct), color: done ? "teal" : "orbix" }]}
            label={
              <Text ta="center" fw={700} style={{ fontSize: 16 }}>
                {pct}%
              </Text>
            }
          />
        ) : null}
      </Group>

      {hasTarget ? (
        <Progress
          value={Math.min(100, pct)}
          size="md"
          radius="xl"
          color={done ? "teal" : "orbix"}
          mb={14}
        />
      ) : null}

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={8}>
        <StatChip
          label="Falta atingir"
          value={hasTarget ? String(remaining) : "—"}
          hint={done ? "Concluído" : "conversões"}
          accent={done ? colors.success : colors.warning}
        />
        <StatChip
          label="Faturamento previsto"
          value={formatMoney(predicted?.faturamento)}
          hint="ao bater a meta"
        />
        <StatChip
          label="Lucro previsto"
          value={formatMoney(predicted?.lucro)}
          hint={
            predicted
              ? `${(predicted.lucroPercent * 100).toFixed(0)}% de margem`
              : undefined
          }
          accent={colors.success}
        />
        <StatChip
          label="Já realizado"
          value={formatMoney(realized?.faturamento)}
          hint={`${goal.current} conversões`}
        />
        <StatChip
          label="Lucro realizado"
          value={formatMoney(realized?.lucro)}
          hint="no período"
        />
        <StatChip
          label="Potencial restante"
          value={formatMoney(goal.remainingRevenue ?? 0)}
          hint={remaining > 0 ? `${remaining} × preço de venda` : "meta completa"}
          accent={colors.primaryDark}
        />
      </SimpleGrid>
    </Box>
  );
}

function GoalProgressFallback({
  current,
  periodLabel,
}: {
  current: number;
  periodLabel: string;
}) {
  return (
    <Box
      style={{
        border: `1px solid ${colors.borderLight}`,
        borderRadius: 12,
        padding: 16,
        background: colors.surfaceSecondary,
      }}
    >
      <Text size="sm" fw={700}>
        Resultado da empresa · {periodLabel}
      </Text>
      <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
        {current.toLocaleString("pt-BR")}
      </Text>
      <Text size="xs" c={colors.textMuted} mt={4}>
        Conversões oficiais no mês. Crie uma meta com escopo Empresa para ver alvo, quanto falta
        e resultado previsto.
      </Text>
    </Box>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isOperador } = useAuth();
  const [data, setData] = useState<MetricsResponse["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canCapture = isAdmin || user?.canCapture !== false;
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [y, m] = monthValue.split("-").map(Number);
      const params = new URLSearchParams({
        year: String(y),
        month: String(m),
      });
      if (selectedGoalId) {
        params.set("goalId", selectedGoalId);
      }
      const res = await api<MetricsResponse>(`/api/v1/dashboard/metrics?${params}`);
      setData(res.metrics);
      if (!selectedGoalId && res.metrics.selectedGoalId) {
        setSelectedGoalId(res.metrics.selectedGoalId);
      }
    } catch {
      setError("Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, [monthValue, selectedGoalId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const funnel = data?.funnel ?? [];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count), 1);
  const totalFunnel = funnel.reduce((sum, f) => sum + f.count, 0);
  const kpis = data?.kpis;
  const goal = data?.goal;
  const availableGoals = data?.availableGoals ?? [];
  const companyGoals = data?.companyGoals ?? [];
  const operatorGoals = data?.operatorGoals ?? [];
  const isCurrentMonth = data?.filter.isCurrentMonth ?? true;
  const periodLabel = data?.filter.label ?? "mês atual";

  const metricOptions = [
    {
      value: COMPANY_VIEW,
      label: isOperador ? "Visão geral (empresa)" : "Visão geral da empresa",
    },
    ...availableGoals.map((g) => ({
      value: g.id,
      label: goalSelectLabel(g),
    })),
  ];

  const scopeLabel =
    data?.scope === "operator"
      ? goal?.assignee?.name
        ? `Escopo: ${goal.assignee.name}`
        : "Escopo: operador"
      : "Escopo: empresa";

  const chartData = (data?.prospection30d ?? []).map((d) => ({
    day: d.day,
    Importados: d.imported,
    Convertidos: d.converted,
  }));

  const daySuffix = isCurrentMonth ? "hoje" : "no último dia do mês";
  const weekSuffix = isCurrentMonth ? "últimos 7 dias" : "últimos 7 dias do mês";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o desempenho da sua operação."
        actions={
          <>
            <Button
              variant="default"
              leftSection={<RefreshCw size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              loading={loading}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Atualizar
            </Button>
            {canCapture ? (
              <Button
                leftSection={<Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                component={Link}
                href="/captura"
              >
                Nova captura
              </Button>
            ) : null}
          </>
        }
      />

      <Box mb="md" maw={720}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12} style={{ alignItems: "end" }}>
          <Select
            label="Período"
            data={monthOptions}
            value={monthValue}
            onChange={(value) => {
              if (!value) return;
              setMonthValue(value);
              setSelectedGoalId(null);
            }}
            allowDeselect={false}
          />
          <Select
            label="Métricas em visualização"
            data={metricOptions}
            value={selectedGoalId ?? COMPANY_VIEW}
            onChange={(value) => {
              if (value) setSelectedGoalId(value);
            }}
            allowDeselect={false}
            searchable={availableGoals.length > 4}
          />
        </SimpleGrid>
        <Text size="xs" c={colors.textMuted} mt={8}>
          {isOperador
            ? "Mês corrente por padrão. Escolha a meta para definir os números do painel (padrão: sua meta)."
            : "Mês corrente por padrão. Escolha a meta para definir os números do painel (padrão: meta da empresa)."}
        </Text>
      </Box>

      {loading && !data ? (
        <Stack gap={16}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={118} radius="md" />
            ))}
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Skeleton height={280} radius="md" />
            <Skeleton height={280} radius="md" />
          </SimpleGrid>
        </Stack>
      ) : error ? (
        <EmptyState title="Dashboard indisponível" description={error} icon={LayoutDashboard} />
      ) : (
        <Stack gap={16}>
          <Text size="xs" c={colors.textMuted}>
            {scopeLabel} · {periodLabel} · conversões pelo fechamento oficial
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={16}>
            <KpiCard
              label="Taxa de conversão"
              value={`${((kpis?.conversionRate ?? 0) * 100).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}%`}
              delta={isCurrentMonth ? weekSuffix : "no mês"}
              positive
            />
            <KpiCard
              label="Custo por conversão"
              value={formatMoney(kpis?.costPerConversion)}
              delta={
                data?.period.avgLeadCost
                  ? `custo médio R$ ${Number(data.period.avgLeadCost).toFixed(2)}`
                  : undefined
              }
              positive={false}
            />
            <KpiCard
              label={isCurrentMonth ? "Leads no CRM — 7 dias" : "Leads no CRM — mês"}
              value={(
                isCurrentMonth ? (kpis?.leadsLast7Days ?? 0) : (data?.period.importedLeads ?? 0)
              ).toLocaleString("pt-BR")}
              delta="enviados ao CRM"
            />
            <KpiCard
              label={isCurrentMonth ? "Convertidos — 7 dias" : "Convertidos — mês"}
              value={(
                isCurrentMonth
                  ? (kpis?.convertedLast7Days ?? 0)
                  : (data?.period.conversions ?? 0)
              ).toLocaleString("pt-BR")}
              delta="fechamento oficial"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={16}>
            <Card padding={16}>
              <SectionHead title="Funil de conversão" subtitle="Snapshot atual do pipeline" />
              {funnel.length === 0 ? (
                <EmptyState
                  title="Sem dados de funil"
                  description="Mova leads no CRM para popular o funil."
                />
              ) : (
                <Stack gap={10}>
                  {funnel.map((item) => {
                    const widthPct = Math.max(8, (item.count / maxFunnel) * 100);
                    return (
                      <Box
                        key={item.slug}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "90px 1fr 50px",
                          gap: 10,
                          alignItems: "center",
                          fontSize: 12,
                        }}
                      >
                        <Text size="xs" c={colors.textSecondary} style={{ fontWeight: 500 }}>
                          {item.label}
                        </Text>
                        <Box
                          style={{
                            height: 24,
                            background: colors.primaryLight,
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            style={{
                              width: `${widthPct}%`,
                              height: "100%",
                              background: colors.primary,
                              opacity: 0.85,
                              borderRadius: 4,
                            }}
                          />
                        </Box>
                        <Text ta="right" fw={700} size="xs">
                          {item.count}
                        </Text>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Card>

            <Card padding={16}>
              <SectionHead
                title={`Prospecção — ${periodLabel}`}
                subtitle="Leads no CRM vs. convertidos (fechamento)"
              />
              {chartData.length === 0 ? (
                <EmptyState
                  title="Sem prospecção no período"
                  description="Envie leads da captura para o CRM para ver a evolução."
                />
              ) : (
                <BarChart
                  h={220}
                  data={chartData}
                  dataKey="day"
                  series={[
                    { name: "Importados", color: "orbix.5" },
                    { name: "Convertidos", color: "orbix.2" },
                  ]}
                  tickLine="none"
                  gridAxis="none"
                  withLegend={false}
                  barProps={{ radius: 4 }}
                />
              )}
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={16}>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                {isCurrentMonth ? "Buscas hoje" : "Buscas no mês"}
              </Text>
              <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {(
                  isCurrentMonth ? (kpis?.capturesToday ?? 0) : (kpis?.capturesMonth ?? 0)
                ).toLocaleString("pt-BR")}
              </Text>
              <Text size="xs" c={colors.textMuted} mt={6}>
                {(
                  isCurrentMonth ? (kpis?.leadsFoundToday ?? 0) : (kpis?.leadsFoundMonth ?? 0)
                ).toLocaleString("pt-BR")}{" "}
                leads novos na captura
              </Text>
            </Card>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                {isCurrentMonth ? "Importados hoje" : "Importados no mês"}
              </Text>
              <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {(
                  isCurrentMonth
                    ? (kpis?.importedToday ?? 0)
                    : (data?.period.importedLeads ?? 0)
                ).toLocaleString("pt-BR")}
              </Text>
              <Text size="xs" c={colors.textMuted} mt={6}>
                {isCurrentMonth
                  ? `Enviados ao CRM ${daySuffix}`
                  : "Enviados da captura para o CRM"}
              </Text>
            </Card>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                {isCurrentMonth ? "Convertidos hoje" : "Convertidos no mês"}
              </Text>
              <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {(
                  isCurrentMonth
                    ? (kpis?.convertedToday ?? 0)
                    : (data?.period.conversions ?? 0)
                ).toLocaleString("pt-BR")}
              </Text>
              <Text size="xs" c={colors.textMuted} mt={6}>
                Fechamento oficial no CRM
              </Text>
            </Card>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                Meta selecionada
              </Text>
              <Text mt={8} mb={8} style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {goal
                  ? `${goal.current} / ${goal.target}`
                  : `${data?.period.conversions ?? 0} / —`}
              </Text>
              <Box
                style={{
                  height: 6,
                  background: colors.borderLight,
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <Box
                  style={{
                    width: `${Math.round((goal?.progress ?? 0) * 100)}%`,
                    height: "100%",
                    background: colors.primary,
                    borderRadius: 99,
                  }}
                />
              </Box>
              <Text size="xs" c={colors.textMuted} mt={7} style={{ fontSize: 12 }}>
                {goal
                  ? `${Math.round(goal.progress * 100)}% · ${goalSelectLabel(goal)}`
                  : "Nenhuma meta da empresa neste período"}
              </Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: isAdmin ? 2 : 1 }} spacing={16}>
            <Card padding={16}>
              <SectionHead
                title="Metas da empresa"
                subtitle={`Progresso, quanto falta e resultado previsto (${periodLabel})`}
              />
              {companyGoals.length === 0 ? (
                <GoalProgressFallback
                  current={data?.period.conversions ?? 0}
                  periodLabel={periodLabel}
                />
              ) : (
                <Stack gap={14}>
                  {companyGoals.map((g) => (
                    <GoalDetailCard key={g.id} goal={g} />
                  ))}
                </Stack>
              )}
            </Card>

            {(isAdmin || operatorGoals.length > 0) && (
              <Card padding={16}>
                <SectionHead
                  title={isAdmin ? "Operadores e metas" : "Minhas metas"}
                  subtitle={
                    isAdmin
                      ? "Progresso e resultado previsto por operador"
                      : "Progresso e resultado previsto das suas metas"
                  }
                />
                {operatorGoals.length === 0 ? (
                  <EmptyState
                    title="Nenhuma meta de operador"
                    description={
                      isAdmin
                        ? "Atribua metas mensais a operadores em Metas."
                        : "Você ainda não possui meta pessoal neste período."
                    }
                  />
                ) : (
                  <Stack gap={14}>
                    {operatorGoals.map((g) => (
                      <GoalDetailCard key={g.id} goal={g} />
                    ))}
                  </Stack>
                )}
              </Card>
            )}
          </SimpleGrid>

          {data?.conversionsBySegment && data.conversionsBySegment.length > 0 ? (
            <Card padding={16}>
              <SectionHead
                title="Conversões por segmento"
                subtitle={`Onde vale mais investir · ${periodLabel}`}
              />
              <BarChart
                h={220}
                data={data.conversionsBySegment.map((s) => ({
                  segment: s.segment,
                  Convertidos: s.count,
                }))}
                dataKey="segment"
                series={[{ name: "Convertidos", color: "orbix.5" }]}
                tickLine="none"
                gridAxis="y"
                barProps={{ radius: 4 }}
              />
            </Card>
          ) : null}

          <Text size="xs" c={colors.textMuted}>
            Funil total: {totalFunnel.toLocaleString("pt-BR")} leads
            {isCurrentMonth
              ? ` · ${data?.upcomingSchedules ?? 0} agendamentos futuros`
              : ""}
            {weekSuffix ? ` · referência: ${weekSuffix}` : ""}
          </Text>
        </Stack>
      )}
    </>
  );
}
