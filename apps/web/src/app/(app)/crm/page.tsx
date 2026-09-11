"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Center,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { ArchiveRestore, Plus, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Lead, PipelineStage } from "@/lib/types";
import { normalizeTemperature } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";
import type { LeadCardMarker } from "@orbixlead/shared";

type AdvancedFilters = {
  temperatures: ("frio" | "morno" | "quente")[];
  city: string;
  segment: string;
  stageId: string | null;
  site: "all" | "with" | "without";
  accompaniedByMe: boolean;
};

const DEFAULT_FILTERS: AdvancedFilters = {
  temperatures: [],
  city: "",
  segment: "",
  stageId: null,
  site: "all",
  accompaniedByMe: false,
};

export default function CrmPage() {
  const { isAdmin, user } = useAuth();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, { open: openFilters, close: closeFilters }] = useDisclosure(false);
  const [stageModalOpen, { open: openStageModal, close: closeStageModal }] = useDisclosure(false);
  const [archivedModalOpen, { open: openArchivedModal, close: closeArchivedModal }] =
    useDisclosure(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [newStageLabel, setNewStageLabel] = useState("");
  const [creatingStage, setCreatingStage] = useState(false);
  const [archivedStages, setArchivedStages] = useState<PipelineStage[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [renameStage, setRenameStage] = useState<PipelineStage | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [archiveStage, setArchiveStage] = useState<PipelineStage | null>(null);
  const [moveToStageId, setMoveToStageId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stageData, leadData] = await Promise.all([
        api("/api/v1/stages"),
        api("/api/v1/leads"),
      ]);
      const stageList = unwrapList<PipelineStage>(stageData, "stages");
      setStages(stageList);
      setAllLeads(unwrapList<Lead>(leadData, "leads"));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar CRM.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLeads = useMemo(() => {
    const cityNeedle = appliedFilters.city.trim().toLowerCase();
    const segmentNeedle = appliedFilters.segment.trim().toLowerCase();

    return allLeads.filter((lead) => {
      if (appliedFilters.stageId && lead.stageId !== appliedFilters.stageId) return false;
      if (
        appliedFilters.temperatures.length > 0 &&
        !appliedFilters.temperatures.includes(normalizeTemperature(lead.temperature))
      ) {
        return false;
      }
      if (cityNeedle && !(lead.city || "").toLowerCase().includes(cityNeedle)) return false;
      if (segmentNeedle && !(lead.segment || "").toLowerCase().includes(segmentNeedle)) {
        return false;
      }
      if (appliedFilters.site === "with" && !(lead.hasWebsite || lead.website)) return false;
      if (appliedFilters.site === "without" && (lead.hasWebsite || lead.website)) return false;
      if (appliedFilters.accompaniedByMe) {
        if (!user?.id || lead.assigneeId !== user.id) return false;
      }
      return true;
    });
  }, [allLeads, appliedFilters, user?.id]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const s of stages) grouped[s.id] = [];
    for (const lead of filteredLeads) {
      if (!grouped[lead.stageId]) grouped[lead.stageId] = [];
      grouped[lead.stageId].push(lead);
    }
    return grouped;
  }, [stages, filteredLeads]);

  const archiveLeadTotal = archiveStage
    ? allLeads.filter((l) => l.stageId === archiveStage.id).length
    : 0;

  const onMove = async (leadId: string, stageId: string) => {
    const previous = allLeads;
    setAllLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, stageId } : lead))
    );

    try {
      await api(`/api/v1/leads/${leadId}/move`, {
        method: "PATCH",
        body: { stageId },
      });
    } catch (err) {
      setAllLeads(previous);
      notifications.show({
        color: "red",
        title: "Erro ao mover",
        message: err instanceof ApiError ? err.message : "Tente novamente.",
      });
    }
  };

  const onCardMarkerChange = async (leadId: string, cardMarker: LeadCardMarker) => {
    const previous = allLeads;
    setAllLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, cardMarker } : lead))
    );

    try {
      await api(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        body: { cardMarker },
      });
    } catch (err) {
      setAllLeads(previous);
      notifications.show({
        color: "red",
        title: "Erro ao marcar",
        message: err instanceof ApiError ? err.message : "Tente novamente.",
      });
    }
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    closeFilters();
    notifications.show({
      color: "orbix",
      title: "Filtros aplicados",
      message: "A listagem foi atualizada.",
    });
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    notifications.show({
      color: "gray",
      title: "Filtros limpos",
      message: "Os filtros foram redefinidos.",
    });
  };

  const createStage = async () => {
    if (!newStageLabel.trim()) return;
    setCreatingStage(true);
    try {
      await api("/api/v1/stages", {
        method: "POST",
        body: { label: newStageLabel.trim() },
      });
      notifications.show({
        color: "green",
        title: "Estágio criado",
        message: "O novo estágio foi adicionado ao pipeline e ao funil do dashboard.",
      });
      setNewStageLabel("");
      closeStageModal();
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao criar estágio.",
      });
    } finally {
      setCreatingStage(false);
    }
  };

  const openRename = (stage: PipelineStage) => {
    setRenameStage(stage);
    setRenameLabel(stage.label);
  };

  const saveRename = async () => {
    if (!renameStage || !renameLabel.trim()) return;
    setRenaming(true);
    try {
      await api(`/api/v1/stages/${renameStage.id}`, {
        method: "PATCH",
        body: { label: renameLabel.trim() },
      });
      notifications.show({
        color: "green",
        title: "Estágio atualizado",
        message: "O nome foi alterado no CRM e no funil do dashboard.",
      });
      setRenameStage(null);
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao renomear estágio.",
      });
    } finally {
      setRenaming(false);
    }
  };

  const openArchive = (stage: PipelineStage) => {
    setArchiveStage(stage);
    const fallback = stages.find((s) => s.id !== stage.id && s.slug === "new")
      ?? stages.find((s) => s.id !== stage.id)
      ?? null;
    setMoveToStageId(fallback?.id ?? null);
  };

  const confirmArchive = async () => {
    if (!archiveStage) return;
    const leadTotal = allLeads.filter((l) => l.stageId === archiveStage.id).length;
    if (leadTotal > 0 && !moveToStageId) {
      notifications.show({
        color: "red",
        title: "Destino obrigatório",
        message: "Escolha para onde mover os leads deste estágio.",
      });
      return;
    }

    setArchiving(true);
    try {
      await api(`/api/v1/stages/${archiveStage.id}`, {
        method: "PATCH",
        body: {
          archived: true,
          ...(leadTotal > 0 && moveToStageId ? { moveToStageId } : {}),
        },
      });
      notifications.show({
        color: "green",
        title: "Estágio arquivado",
        message: "A coluna saiu do pipeline e do funil do dashboard.",
      });
      setArchiveStage(null);
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao arquivar estágio.",
      });
    } finally {
      setArchiving(false);
    }
  };

  const loadArchivedStages = async () => {
    setLoadingArchived(true);
    try {
      const data = await api("/api/v1/stages?includeArchived=1");
      const all = unwrapList<PipelineStage>(data, "stages");
      setArchivedStages(all.filter((s) => Boolean(s.archivedAt)));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar arquivados.",
      });
    } finally {
      setLoadingArchived(false);
    }
  };

  const openArchivedStages = () => {
    openArchivedModal();
    void loadArchivedStages();
  };

  const restoreStage = async (stage: PipelineStage) => {
    setRestoringId(stage.id);
    try {
      await api(`/api/v1/stages/${stage.id}`, {
        method: "PATCH",
        body: { archived: false },
      });
      notifications.show({
        color: "green",
        title: "Estágio restaurado",
        message: `“${stage.label}” voltou ao final do pipeline e ao funil do dashboard.`,
      });
      await Promise.all([load(), loadArchivedStages()]);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao desarquivar estágio.",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const activeFilterCount =
    appliedFilters.temperatures.length +
    (appliedFilters.city ? 1 : 0) +
    (appliedFilters.segment ? 1 : 0) +
    (appliedFilters.stageId ? 1 : 0) +
    (appliedFilters.site !== "all" ? 1 : 0) +
    (appliedFilters.accompaniedByMe ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={
          isMobile
            ? "Kanban dos leads ativos. Encerrados ficam em Leads."
            : "Kanban dos leads ativos. Convertidos e perdidos encerrados ficam em Leads → Encerrados."
        }
        actions={
          <>
            <Button
              variant="default"
              size={isMobile ? "sm" : "md"}
              leftSection={<SlidersHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
              onClick={() => {
                setDraftFilters(appliedFilters);
                openFilters();
              }}
            >
              Filtros
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            {isAdmin ? (
              <>
                <Button
                  variant="default"
                  size={isMobile ? "sm" : "md"}
                  leftSection={<ArchiveRestore size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                  onClick={openArchivedStages}
                >
                  Arquivados
                </Button>
                <Button
                  size={isMobile ? "sm" : "md"}
                  leftSection={<Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                  onClick={openStageModal}
                >
                  {isMobile ? "Novo" : "Novo estágio"}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {loading ? (
        <Center mih={isMobile ? 240 : 320}>
          <Loader color="orbix" />
        </Center>
      ) : stages.length === 0 ? (
        <EmptyState
          title="Pipeline vazio"
          description="Nenhum estágio encontrado para este tenant."
          action={
            isAdmin ? (
              <Button onClick={openStageModal}>Criar estágio</Button>
            ) : (
              <Button onClick={() => void load()}>Recarregar</Button>
            )
          }
        />
      ) : filteredLeads.length === 0 && allLeads.length > 0 ? (
        <EmptyState
          title="Nenhum lead com esses filtros"
          description="Ajuste ou limpe os filtros avançados."
          action={
            <Button variant="default" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <KanbanBoard
          stages={stages}
          leadsByStage={leadsByStage}
          onMove={onMove}
          onCardMarkerChange={onCardMarkerChange}
          canManageStages={isAdmin}
          onRenameStage={openRename}
          onArchiveStage={openArchive}
        />
      )}

      <Drawer
        opened={filtersOpen}
        onClose={closeFilters}
        position="right"
        size={isMobile ? "100%" : 420}
        title="Filtros avançados"
        padding="md"
        overlayProps={{ backgroundOpacity: 0.45 }}
      >
        <Stack gap="lg">
          <div>
            <Text size="sm" fw={600} mb={8}>
              Temperatura
            </Text>
            <Group gap="md" wrap="wrap">
              {(["frio", "morno", "quente"] as const).map((temp) => (
                <Checkbox
                  key={temp}
                  label={temp === "frio" ? "Frio" : temp === "morno" ? "Morno" : "Quente"}
                  checked={draftFilters.temperatures.includes(temp)}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraftFilters((prev) => ({
                      ...prev,
                      temperatures: checked
                        ? [...prev.temperatures, temp]
                        : prev.temperatures.filter((t) => t !== temp),
                    }));
                  }}
                />
              ))}
            </Group>
          </div>

          <TextInput
            label="Cidade"
            placeholder="Buscar cidade"
            value={draftFilters.city}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, city: e.currentTarget.value }))}
          />

          <TextInput
            label="Segmento"
            placeholder="Ex.: restaurante"
            value={draftFilters.segment}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, segment: e.currentTarget.value }))
            }
          />

          <Select
            label="Estágio"
            placeholder="Todos os estágios"
            clearable
            data={stages.map((s) => ({ value: s.id, label: s.label }))}
            value={draftFilters.stageId}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, stageId: value }))}
          />

          <Select
            label="Site"
            data={[
              { value: "all", label: "Todos" },
              { value: "with", label: "Com site" },
              { value: "without", label: "Sem site" },
            ]}
            value={draftFilters.site}
            onChange={(value) =>
              setDraftFilters((prev) => ({
                ...prev,
                site: (value as AdvancedFilters["site"]) || "all",
              }))
            }
            allowDeselect={false}
          />

          <Checkbox
            label="Acompanhado por mim"
            description="Mostra apenas leads sob o seu acompanhamento"
            checked={draftFilters.accompaniedByMe}
            onChange={() => {
              setDraftFilters((prev) => ({
                ...prev,
                accompaniedByMe: !prev.accompaniedByMe,
              }));
            }}
          />

          <Group justify="space-between" mt="md" grow={!!isMobile} wrap="wrap">
            <Button variant="subtle" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <Button onClick={applyFilters}>Aplicar filtros</Button>
          </Group>
        </Stack>
      </Drawer>

      <Modal
        opened={stageModalOpen}
        onClose={closeStageModal}
        title="Novo estágio"
        centered
        fullScreen={!!isMobile}
      >
        <Stack gap="md">
          <TextInput
            label="Nome do estágio"
            placeholder="Ex.: Proposta enviada"
            value={newStageLabel}
            onChange={(e) => setNewStageLabel(e.currentTarget.value)}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void createStage();
            }}
          />
          <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} wrap="wrap">
            <Button variant="default" onClick={closeStageModal}>
              Cancelar
            </Button>
            <Button
              loading={creatingStage}
              disabled={!newStageLabel.trim()}
              onClick={() => void createStage()}
            >
              Criar estágio
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={archivedModalOpen}
        onClose={closeArchivedModal}
        title="Estágios arquivados"
        centered
        size={isMobile ? "100%" : "md"}
        fullScreen={!!isMobile}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Restaurar uma coluna traz ela de volta ao pipeline e ao funil do dashboard.
          </Text>
          {loadingArchived ? (
            <Center py="lg">
              <Loader color="orbix" size="sm" />
            </Center>
          ) : archivedStages.length === 0 ? (
            <Text size="sm">Nenhum estágio arquivado no momento.</Text>
          ) : (
            <Stack gap="sm">
              {archivedStages.map((stage) => (
                <Group key={stage.id} justify="space-between" wrap="wrap" gap="sm">
                  <div style={{ minWidth: 0, flex: "1 1 140px" }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {stage.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {stage.slug}
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    loading={restoringId === stage.id}
                    onClick={() => void restoreStage(stage)}
                    fullWidth={!!isMobile}
                  >
                    Desarquivar
                  </Button>
                </Group>
              ))}
            </Stack>
          )}
          <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile}>
            <Button variant="default" onClick={closeArchivedModal}>
              Fechar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(renameStage)}
        onClose={() => (renaming ? undefined : setRenameStage(null))}
        title="Renomear estágio"
        centered
        fullScreen={!!isMobile}
      >
        <Stack gap="md">
          <TextInput
            label="Nome do estágio"
            value={renameLabel}
            onChange={(e) => setRenameLabel(e.currentTarget.value)}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveRename();
            }}
          />
          <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} wrap="wrap">
            <Button variant="default" onClick={() => setRenameStage(null)} disabled={renaming}>
              Cancelar
            </Button>
            <Button
              loading={renaming}
              disabled={!renameLabel.trim()}
              onClick={() => void saveRename()}
            >
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(archiveStage)}
        onClose={() => (archiving ? undefined : setArchiveStage(null))}
        title="Arquivar estágio"
        centered
        fullScreen={!!isMobile}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {archiveStage
              ? `Arquivar “${archiveStage.label}” remove a coluna do pipeline e do funil do dashboard.`
              : ""}
          </Text>
          {archiveLeadTotal > 0 ? (
            <Select
              label={`Mover ${archiveLeadTotal} lead(s) para`}
              placeholder="Escolha o estágio de destino"
              data={stages
                .filter((s) => s.id !== archiveStage?.id)
                .map((s) => ({ value: s.id, label: s.label }))}
              value={moveToStageId}
              onChange={setMoveToStageId}
              allowDeselect={false}
            />
          ) : (
            <Text size="sm">Este estágio não possui leads ativos.</Text>
          )}
          <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} wrap="wrap">
            <Button variant="default" onClick={() => setArchiveStage(null)} disabled={archiving}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={archiving}
              disabled={archiveLeadTotal > 0 && !moveToStageId}
              onClick={() => void confirmArchive()}
            >
              Arquivar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
