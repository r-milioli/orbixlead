"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
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
import { MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Goal } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

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

function GoalCard({
  goal,
  isAdmin,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  isAdmin: boolean;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
}) {
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
      <Group justify="space-between" mb="sm" wrap="nowrap" align="flex-start">
        <div>
          <Title order={5}>{goal.name}</Title>
          <Group gap={6} mt={4}>
            <Badge size="sm" variant="light" color="gray">
              {String(goal.periodType).toLowerCase() === "monthly"
                ? "Mensal"
                : String(goal.periodType).toLowerCase() === "weekly"
                  ? "Semanal"
                  : "Diária"}
            </Badge>
            <Badge size="sm" variant="light" color="orbix">
              {scopeLabel(goal)}
            </Badge>
          </Group>
        </div>
        {isAdmin ? (
          <Menu withinPortal position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Ações da meta">
                <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Pencil size={14} />}
                onClick={() => onEdit(goal)}
              >
                Editar
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={() => onDelete(goal)}
              >
                Excluir
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
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
            <GoalCard
              key={child.id}
              goal={child}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      ) : null}
    </Card>
  );
}

type OperatorOption = { id: string; name: string; role: string };

export default function MetasPage() {
  const { tenant, isAdmin, isOperador, user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);
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
    if (isOperador && viewGoalId) {
      return monthlyRoots.filter((g) => g.id === viewGoalId);
    }
    if (isOperador && personalRoot) {
      return [personalRoot];
    }
    return monthlyRoots;
  }, [isOperador, viewGoalId, monthlyRoots, personalRoot]);

  const showGoalSelector =
    isOperador && Boolean(personalRoot && companyRoot && personalRoot.id !== companyRoot.id);

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

  return (
    <>
      <PageHeader title="Metas" subtitle="Metas mensais com desdobramento semanal e diário" />

      {showGoalSelector ? (
        <Select
          mb="lg"
          maw={360}
          label="Meta em acompanhamento"
          description="Padrão: sua meta pessoal"
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

      <SimpleGrid cols={{ base: 1, lg: isAdmin ? 2 : 1 }} spacing="lg" mb="xl">
        {isAdmin ? (
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
                    data={monthlyRoots.map((g) => ({
                      value: g.id,
                      label: `${g.name} (${scopeLabel(g)})`,
                    }))}
                    value={parentId}
                    onChange={setParentId}
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
                      />
                    ) : null}
                  </>
                )}
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
        ) : null}

        <div>
          {loading ? (
            <Center mih={240}>
              <Loader color="orbix" />
            </Center>
          ) : visibleRoots.length === 0 ? (
            <EmptyState
              title="Nenhuma meta"
              description={
                isAdmin
                  ? "Crie uma meta mensal para acompanhar conversões."
                  : "Ainda não há metas visíveis para você."
              }
              icon={Target}
            />
          ) : (
            <Stack gap="md">
              {visibleRoots.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isAdmin={isAdmin}
                  onEdit={openEdit}
                  onDelete={requestDelete}
                />
              ))}
            </Stack>
          )}
        </div>
      </SimpleGrid>

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
      >
        <Stack gap="sm">
          <TextInput
            label="Nome"
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
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
              />
              {editScope === "operator" ? (
                <Select
                  label="Operador"
                  searchable
                  data={operators.map((o) => ({ value: o.id, label: o.name }))}
                  value={editAssigneeId}
                  onChange={setEditAssigneeId}
                />
              ) : null}
            </>
          ) : null}
          <NumberInput
            label="Conversões alvo"
            min={1}
            value={editTarget}
            onChange={setEditTarget}
          />
          <NumberInput
            label="Preço de venda (R$)"
            min={0}
            decimalScale={2}
            value={editPreco}
            onChange={setEditPreco}
          />
          <NumberInput
            label="Custo por conversão (R$)"
            min={0}
            decimalScale={2}
            value={editCusto}
            onChange={setEditCusto}
          />
          <Group justify="flex-end" mt="sm">
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
