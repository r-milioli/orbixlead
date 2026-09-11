"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart } from "@mantine/charts";
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Download, LayoutDashboard, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type MetricsResponse = {
  metrics: {
    funnel: { slug: string; label: string; count: number }[];
    kpis: {
      conversionRate: number;
      costPerConversion: number | null;
      leadsLast7Days: number;
      convertedLast7Days: number;
      importedToday: number;
      advancedToday: number;
    };
    period: {
      importedLeads: number;
      conversions: number;
      avgLeadCost: number;
      costPerConversion: number | null;
    };
    goal: {
      id: string;
      name: string;
      target: number;
      current: number;
      progress: number;
      scope?: string;
      assigneeId?: string | null;
    } | null;
    availableGoals?: {
      id: string;
      name: string;
      scope: string;
      assigneeId?: string | null;
    }[];
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

export default function DashboardPage() {
  const { user, isAdmin, isOperador } = useAuth();
  const [data, setData] = useState<MetricsResponse["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const canCapture = isAdmin || user?.canCapture !== false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const qs = selectedGoalId ? `?goalId=${encodeURIComponent(selectedGoalId)}` : "";
        const res = await api<MetricsResponse>(`/api/v1/dashboard/metrics${qs}`);
        if (!cancelled) {
          setData(res.metrics);
          if (!selectedGoalId && res.metrics.goal?.id) {
            setSelectedGoalId(res.metrics.goal.id);
          }
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar o dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGoalId]);

  const funnel = data?.funnel ?? [];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count), 1);
  const totalFunnel = funnel.reduce((sum, f) => sum + f.count, 0) || 1;
  const kpis = data?.kpis;
  const goal = data?.goal;
  const availableGoals = data?.availableGoals ?? [];
  const showGoalSelector = isOperador && availableGoals.length > 1;

  const chartData = (data?.prospection30d ?? []).map((d) => ({
    day: d.day,
    Importados: d.imported,
    Convertidos: d.converted,
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o desempenho da sua operação."
        actions={
          <>
            <Button
              variant="default"
              leftSection={<Download size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              component={Link}
              href="/leads"
            >
              Exportar
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

      {showGoalSelector ? (
        <Select
          mb="md"
          maw={360}
          label="Meta em acompanhamento"
          data={availableGoals.map((g) => ({
            value: g.id,
            label:
              g.scope === "operator"
                ? `Minha meta · ${g.name}`
                : `Empresa · ${g.name}`,
          }))}
          value={selectedGoalId}
          onChange={setSelectedGoalId}
        />
      ) : null}
      {loading ? (
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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={16}>
            <KpiCard
              label="Taxa de conversão"
              value={`${((kpis?.conversionRate ?? 0) * 100).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}%`}
              delta="últimos 7 dias"
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
              label="Leads — últimos 7 dias"
              value={(kpis?.leadsLast7Days ?? 0).toLocaleString("pt-BR")}
              delta="no período"
            />
            <KpiCard
              label="Convertidos — últimos 7 dias"
              value={(kpis?.convertedLast7Days ?? 0).toLocaleString("pt-BR")}
              delta="no período"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={16}>
            <Card padding={16}>
              <SectionHead title="Funil de conversão" subtitle="Progressão do pipeline" />
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
                title="Prospecção — 30 dias"
                subtitle="Leads importados vs. convertidos"
              />
              {chartData.length === 0 ? (
                <EmptyState
                  title="Sem prospecção recente"
                  description="Execute capturas para ver a evolução."
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

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={16}>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                Importados hoje
              </Text>
              <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {(kpis?.importedToday ?? 0).toLocaleString("pt-BR")}
              </Text>
            </Card>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                Avançaram hoje
              </Text>
              <Text mt={8} style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {(kpis?.advancedToday ?? 0).toLocaleString("pt-BR")}
              </Text>
            </Card>
            <Card padding={16}>
              <Text size="sm" c={colors.textMuted} style={{ fontSize: 13 }}>
                Meta mensal
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
                  ? `${Math.round(goal.progress * 100)}% concluído`
                  : "Defina uma meta mensal em Metas"}
              </Text>
            </Card>
          </SimpleGrid>

          {data?.conversionsBySegment && data.conversionsBySegment.length > 0 ? (
            <Card padding={16}>
              <SectionHead
                title="Conversões por segmento"
                subtitle="Onde vale mais investir no mês"
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
            Funil total: {totalFunnel.toLocaleString("pt-BR")} leads ·{" "}
            {data?.upcomingSchedules ?? 0} agendamentos futuros
          </Text>
        </Stack>
      )}
    </>
  );
}
