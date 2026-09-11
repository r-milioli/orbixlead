"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { goalMetrics } from "@orbixlead/shared";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Goal } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors, layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type MonthTab = "current" | "past" | "next";

type OperatorOption = { id: string; name: string; role: string };

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function scopeLabel(goal: Goal) {
  const scope = String(goal.scope || "company").toLowerCase();
  if (scope === "operator") {
    return goal.assignee?.name ? `Operador · ${goal.assignee.name}` : "Operador";
  }
  return "Empresa";
}

function periodBadge(goal: Goal) {
  const t = String(goal.periodType).toLowerCase();
  if (t === "monthly") return "Mensal";
  if (t === "weekly") return "Semanal";
  return "Diária";
}

function shiftMonth(base: Date, delta: number) {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

function monthLabel(d: Date) {
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function goalMonthKey(goal: Goal) {
  const y = goal.year;
  const m = goal.month ?? 0;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function dateMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sortNewestFirst(a: Goal, b: Goal) {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

function GoalAccordionItem({
  goal,
  isAdmin,
  onEdit,
  onDelete,
  compact = false,
}: {
  goal: Goal;
  isAdmin: boolean;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  compact?: boolean;
}) {
  const target = goal.targetConversions;
  const current = goal.convertedCount ?? 0;
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const preco = Number(goal.precoVenda);
  const custo = Number(goal.custoPorConversao);
  const predicted = goalMetrics({
    precoVenda: preco,
    conversoesAlvo: target,
    custoPorConversao: custo,
  });
  const realized = goalMetrics({
    precoVenda: preco,
    conversoesAlvo: current,
    custoPorConversao: custo,
  });
  const children = [...(goal.children ?? [])].sort(sortNewestFirst);

  return (
    <Accordion.Item value={goal.id}>
      <Group gap={0} wrap="nowrap" align="stretch">
        <Accordion.Control style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap={compact ? "xs" : "md"}>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text fw={700} lineClamp={2} style={{ letterSpacing: "-0.01em", fontSize: compact ? 14 : undefined }}>
                {goal.name}
              </Text>
              <Group gap={6} mt={6} wrap="wrap">
                <Badge size="sm" variant="light" color="gray">
                  {periodBadge(goal)}
                </Badge>
                <Badge size="sm" variant="light" color="orbix">
                  {scopeLabel(goal)}
                </Badge>
                {children.length > 0 ? (
                  <Badge size="sm" variant="outline" color="gray">
                    {children.length} desdobramento{children.length > 1 ? "s" : ""}
                  </Badge>
                ) : null}
              </Group>
              {compact ? (
                <Text size="xs" c={colors.textMuted} mt={6}>
                  {current}/{target} · {pct}% · faltam {remaining}
                </Text>
              ) : null}
            </Box>
            <Box ta="right" visibleFrom="sm" style={{ flexShrink: 0 }}>
              <Text size="sm" fw={700}>
                {current}/{target}
              </Text>
              <Text size="xs" c={colors.textMuted}>
                {pct}% · faltam {remaining}
              </Text>
            </Box>
          </Group>
        </Accordion.Control>

        {isAdmin ? (
          <Group
            gap={4}
            px={compact ? 4 : "sm"}
            visibleFrom="sm"
            style={{ flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Editar meta"
              onClick={() => onEdit(goal)}
            >
              <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Excluir meta"
              onClick={() => onDelete(goal)}
            >
              <Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ActionIcon>
          </Group>
        ) : null}
      </Group>

      <Accordion.Panel>
        <Stack gap="md">
          {isAdmin ? (
            <Group gap="xs" grow={compact} wrap="wrap">
              <Button
                size="xs"
                variant="light"
                leftSection={<Pencil size={14} strokeWidth={ICON_STROKE} />}
                onClick={() => onEdit(goal)}
              >
                Editar
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<Trash2 size={14} strokeWidth={ICON_STROKE} />}
                onClick={() => onDelete(goal)}
              >
                Excluir
              </Button>
            </Group>
          ) : null}

          <Progress value={pct} color="orbix" size="md" radius="xl" />
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={compact ? 8 : "sm"}>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Realizado
              </Text>
              <Text fw={700} style={{ wordBreak: "break-word" }}>
                {current} / {target}
              </Text>
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Falta atingir
              </Text>
              <Text
                fw={700}
                c={remaining === 0 ? colors.success : colors.warning}
                style={{ wordBreak: "break-word", fontSize: compact ? 13 : undefined }}
              >
                {remaining} convers{remaining === 1 ? "ão" : "ões"}
              </Text>
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Progresso
              </Text>
              <Text fw={700} c={colors.primary}>
                {pct}%
              </Text>
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Faturamento previsto
              </Text>
              <Text fw={600} style={{ wordBreak: "break-word", fontSize: compact ? 13 : undefined }}>
                {money(predicted.faturamento)}
              </Text>
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Lucro previsto
              </Text>
              <Text fw={600} style={{ wordBreak: "break-word", fontSize: compact ? 13 : undefined }}>
                {money(predicted.lucro)} ({(predicted.lucroPercent * 100).toFixed(0)}%)
              </Text>
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" c={colors.textMuted}>
                Já realizado
              </Text>
              <Text fw={600} style={{ wordBreak: "break-word", fontSize: compact ? 13 : undefined }}>
                {money(realized.faturamento)}
              </Text>
            </Box>
          </SimpleGrid>

          {children.length > 0 ? (
            <Box>
              <Text size="xs" fw={700} c={colors.textMuted} mb="xs" tt="uppercase">
                Desdobramentos
              </Text>
              <Accordion
                variant="separated"
                radius="md"
                multiple={false}
                styles={accordionStyles(compact)}
              >
                {children.map((child) => (
                  <GoalAccordionItem
                    key={child.id}
                    goal={child}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    compact={compact}
                  />
                ))}
              </Accordion>
            </Box>
          ) : null}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

const accordionStyles = (compact = false) => ({
  item: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    overflow: "hidden" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
  },
  control: {
    paddingTop: compact ? 10 : 14,
    paddingBottom: compact ? 10 : 14,
    paddingLeft: compact ? 8 : 12,
    paddingRight: compact ? 8 : 12,
    "&:hover": {
      backgroundColor: colors.surfaceHover,
    },
  },
  panel: {
    backgroundColor: colors.surfaceSecondary,
    borderTop: `1px solid ${colors.borderLight}`,
  },
  content: {
    paddingTop: compact ? 10 : 14,
    paddingBottom: compact ? 10 : 14,
    paddingLeft: compact ? 8 : undefined,
    paddingRight: compact ? 8 : undefined,
  },
});

export default function MetasPage() {
  const { tenant, isAdmin, isOperador, user } = useAuth();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthTab, setMonthTab] = useState<MonthTab>("current");
  const [createOpen, setCreateOpen] = useState(false);

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
  const [scope, setScope] = useState<string>("company");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [viewGoalId, setViewGoalId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState<number | string>(0);
  const [editPreco, setEditPreco] = useState<number | string>(0);
  const [editCusto, setEditCusto] = useState<number | string>(0);
  const [editScope, setEditScope] = useState<string>("company");
  const [editAssigneeId, setEditAssigneeId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const now = useMemo(() => new Date(), []);
  const tabDates = useMemo(
    () => ({
      current: shiftMonth(now, 0),
      past: shiftMonth(now, -1),
      next: shiftMonth(now, 1),
    }),
    [now]
  );
  const activeMonth = tabDates[monthTab];

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

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const data = await api<{ users: OperatorOption[] }>("/api/v1/collaborators");
        setOperators((data.users || []).filter((u) => u.role === "operador"));
      } catch {
        setOperators([]);
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    setYear(activeMonth.getFullYear());
    setMonth(activeMonth.getMonth() + 1);
  }, [activeMonth]);

  const monthlyRoots = useMemo(() => {
    const list = goals.filter((g) => {
      const t = String(g.periodType).toLowerCase();
      return t === "monthly" && !g.parentId;
    });
    if (list.length > 0) return list;
    return goals.filter((g) => !g.parentId);
  }, [goals]);

  const personalRoot = useMemo(() => {
    if (!isOperador || !user?.id) return null;
    return (
      monthlyRoots.find(
        (g) =>
          String(g.scope || "").toLowerCase() === "operator" && g.assigneeId === user.id
      ) ?? null
    );
  }, [monthlyRoots, isOperador, user?.id]);

  const companyRoot = useMemo(() => {
    return (
      monthlyRoots.find((g) => String(g.scope || "company").toLowerCase() === "company") ??
      null
    );
  }, [monthlyRoots]);

  useEffect(() => {
    if (!isOperador) {
      setViewGoalId(null);
      return;
    }
    if (personalRoot && companyRoot && personalRoot.id !== companyRoot.id) {
      setViewGoalId((prev) => prev ?? personalRoot.id);
    } else {
      setViewGoalId(null);
    }
  }, [isOperador, personalRoot, companyRoot]);

  const visibleRoots = useMemo(() => {
    const key = dateMonthKey(activeMonth);
    let roots = monthlyRoots.filter((g) => goalMonthKey(g) === key);

    if (isOperador && viewGoalId) {
      roots = roots.filter((g) => g.id === viewGoalId);
    } else if (isOperador && personalRoot) {
      roots = roots.filter(
        (g) =>
          g.id === personalRoot.id ||
          String(g.scope || "company").toLowerCase() === "company"
      );
      if (viewGoalId) roots = roots.filter((g) => g.id === viewGoalId);
    }

    return [...roots].sort(sortNewestFirst);
  }, [monthlyRoots, activeMonth, isOperador, viewGoalId, personalRoot]);

  const showGoalSelector =
    isOperador && Boolean(personalRoot && companyRoot && personalRoot.id !== companyRoot.id);

  const parentOptionsForTab = useMemo(() => {
    const key = dateMonthKey(activeMonth);
    return monthlyRoots
      .filter((g) => goalMonthKey(g) === key)
      .sort(sortNewestFirst);
  }, [monthlyRoots, activeMonth]);

  const preview = goalMetrics({
    precoVenda: Number(precoVenda) || 0,
    conversoesAlvo: Number(targetConversions) || 0,
    custoPorConversao: Number(custoPorConversao) || 0,
  });

  const resetForm = () => {
    setName("");
    setParentId(null);
    setPeriodType("monthly");
    setScope("company");
    setAssigneeId(null);
    setYear(activeMonth.getFullYear());
    setMonth(activeMonth.getMonth() + 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (scope === "operator" && !assigneeId && periodType === "monthly") {
      notifications.show({
        color: "red",
        title: "Operador obrigatório",
        message: "Selecione o operador da meta.",
      });
      return;
    }
    setSaving(true);
    try {
      await api("/api/v1/goals", {
        method: "POST",
        body: {
          name,
          periodType,
          scope: periodType === "monthly" ? scope : undefined,
          assigneeId:
            periodType === "monthly" && scope === "operator" ? assigneeId || undefined : undefined,
          year: Number(year),
          month:
            periodType === "daily" || periodType === "monthly" || periodType === "weekly"
              ? Number(month)
              : undefined,
          targetConversions: Number(targetConversions),
          precoVenda: Number(precoVenda),
          custoPorConversao: Number(custoPorConversao),
          parentId: parentId || undefined,
        },
      });
      resetForm();
      setCreateOpen(false);
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

  const openEdit = (g: Goal) => {
    setEditing(g);
    setEditName(g.name);
    setEditTarget(g.targetConversions);
    setEditPreco(Number(g.precoVenda));
    setEditCusto(Number(g.custoPorConversao));
    setEditScope(String(g.scope || "company").toLowerCase());
    setEditAssigneeId(g.assigneeId ?? null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/v1/goals/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editName,
          targetConversions: Number(editTarget),
          precoVenda: Number(editPreco),
          custoPorConversao: Number(editCusto),
          ...(editing.parentId
            ? {}
            : {
                scope: editScope,
                assigneeId: editScope === "operator" ? editAssigneeId : null,
              }),
        },
      });
      notifications.show({ color: "green", title: "Meta atualizada", message: "" });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao atualizar meta.",
      });
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (g: Goal) => setPendingDelete(g);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/goals/${pendingDelete.id}`, { method: "DELETE" });
      notifications.show({ color: "green", title: "Meta excluída", message: "" });
      setPendingDelete(null);
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao excluir meta.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const emptyCopy = {
    current: "Nenhuma meta no mês corrente.",
    past: "Nenhuma meta no mês passado.",
    next: "Nenhuma meta no mês que vem.",
  }[monthTab];

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle={
          isMobile
            ? "Metas mensais e desdobramentos"
            : "Acompanhe metas mensais e desdobramentos semanais/diários."
        }
        actions={
          isAdmin ? (
            <Button
              size={isMobile ? "sm" : "md"}
              leftSection={<Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              {isMobile ? "Nova" : "Nova meta"}
            </Button>
          ) : null
        }
      />

      {showGoalSelector ? (
        <Select
          mb="md"
          maw={isMobile ? undefined : 360}
          w={isMobile ? "100%" : undefined}
          label="Meta em acompanhamento"
          description="Padrão: sua meta pessoal"
          size={isMobile ? "sm" : "md"}
          data={[
            {
              value: personalRoot!.id,
              label: `Minha meta · ${personalRoot!.name}`,
            },
            {
              value: companyRoot!.id,
              label: `Empresa · ${companyRoot!.name}`,
            },
          ]}
          value={viewGoalId}
          onChange={setViewGoalId}
        />
      ) : null}

      <Tabs
        value={monthTab}
        onChange={(v) => setMonthTab((v as MonthTab) || "current")}
        color="orbix"
        mb="lg"
      >
        <Tabs.List grow={!!isMobile}>
          <Tabs.Tab value="current">{isMobile ? "Corrente" : "Mês corrente"}</Tabs.Tab>
          <Tabs.Tab value="past">{isMobile ? "Passado" : "Mês passado"}</Tabs.Tab>
          <Tabs.Tab value="next">{isMobile ? "Próximo" : "Mês que vem"}</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Text size="sm" c={colors.textMuted} mb="md">
        Exibindo metas de{" "}
        <Text span fw={600} c={colors.textSecondary}>
          {monthLabel(activeMonth)}
        </Text>
        {" · "}mais recentes primeiro
      </Text>

      {loading ? (
        <Center mih={240}>
          <Loader color="orbix" />
        </Center>
      ) : visibleRoots.length === 0 ? (
        <EmptyState
          title={emptyCopy}
          description={
            isAdmin
              ? "Crie uma meta mensal para este período pelo botão Nova meta."
              : "Ainda não há metas visíveis para você neste período."
          }
          icon={Target}
        />
      ) : (
        <Accordion
          variant="separated"
          radius="md"
          multiple
          chevronPosition="left"
          styles={accordionStyles(!!isMobile)}
        >
          {visibleRoots.map((goal) => (
            <GoalAccordionItem
              key={goal.id}
              goal={goal}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={requestDelete}
              compact={!!isMobile}
            />
          ))}
        </Accordion>
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`Nova meta · ${monthLabel(activeMonth)}`}
        centered
        size="lg"
        fullScreen={!!isMobile}
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Nome da meta"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              size={isMobile ? "sm" : "md"}
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
              size={isMobile ? "sm" : "md"}
            />
            {periodType !== "monthly" ? (
              <Select
                label="Meta pai (mensal)"
                clearable
                data={parentOptionsForTab.map((g) => ({
                  value: g.id,
                  label: `${g.name} (${scopeLabel(g)})`,
                }))}
                value={parentId}
                onChange={setParentId}
                size={isMobile ? "sm" : "md"}
              />
            ) : (
              <>
                <Select
                  label="Responsável"
                  data={[
                    { value: "company", label: "Empresa (visível para todos)" },
                    { value: "operator", label: "Operador específico" },
                  ]}
                  value={scope}
                  onChange={(v) => {
                    setScope(v || "company");
                    if (v !== "operator") setAssigneeId(null);
                  }}
                  size={isMobile ? "sm" : "md"}
                />
                {scope === "operator" ? (
                  <Select
                    label="Operador"
                    required
                    searchable
                    data={operators.map((o) => ({ value: o.id, label: o.name }))}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Selecione o operador"
                    size={isMobile ? "sm" : "md"}
                  />
                ) : null}
              </>
            )}
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <NumberInput
                label="Ano"
                value={year}
                onChange={setYear}
                required
                size={isMobile ? "sm" : "md"}
              />
              <NumberInput
                label="Mês"
                min={1}
                max={12}
                value={month}
                onChange={setMonth}
                required
                size={isMobile ? "sm" : "md"}
              />
            </SimpleGrid>
            <NumberInput
              label="Conversões alvo"
              min={1}
              value={targetConversions}
              onChange={setTargetConversions}
              required
              size={isMobile ? "sm" : "md"}
            />
            <NumberInput
              label="Preço de venda (R$)"
              min={0}
              decimalScale={2}
              value={precoVenda}
              onChange={setPrecoVenda}
              required
              size={isMobile ? "sm" : "md"}
            />
            <NumberInput
              label="Custo por conversão (R$)"
              min={0}
              decimalScale={2}
              value={custoPorConversao}
              onChange={setCustoPorConversao}
              required
              size={isMobile ? "sm" : "md"}
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
            <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} mt="xs" wrap="wrap">
              <Button variant="default" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" leftSection={<Plus size={16} />} loading={saving}>
                Criar meta
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Excluir meta"
        message={`Excluir a meta "${pendingDelete?.name ?? ""}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar meta"
        centered
        fullScreen={!!isMobile}
      >
        <Stack gap="sm">
          <TextInput
            label="Nome"
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            size={isMobile ? "sm" : "md"}
          />
          {!editing?.parentId ? (
            <>
              <Select
                label="Responsável"
                data={[
                  { value: "company", label: "Empresa (visível para todos)" },
                  { value: "operator", label: "Operador específico" },
                ]}
                value={editScope}
                onChange={(v) => {
                  setEditScope(v || "company");
                  if (v !== "operator") setEditAssigneeId(null);
                }}
                size={isMobile ? "sm" : "md"}
              />
              {editScope === "operator" ? (
                <Select
                  label="Operador"
                  searchable
                  data={operators.map((o) => ({ value: o.id, label: o.name }))}
                  value={editAssigneeId}
                  onChange={setEditAssigneeId}
                  size={isMobile ? "sm" : "md"}
                />
              ) : null}
            </>
          ) : null}
          <NumberInput
            label="Conversões alvo"
            min={1}
            value={editTarget}
            onChange={setEditTarget}
            size={isMobile ? "sm" : "md"}
          />
          <NumberInput
            label="Preço de venda (R$)"
            min={0}
            decimalScale={2}
            value={editPreco}
            onChange={setEditPreco}
            size={isMobile ? "sm" : "md"}
          />
          <NumberInput
            label="Custo por conversão (R$)"
            min={0}
            decimalScale={2}
            value={editCusto}
            onChange={setEditCusto}
            size={isMobile ? "sm" : "md"}
          />
          <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} mt="sm" wrap="wrap">
            <Button variant="default" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void saveEdit()}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
