"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Download, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/lib/auth";
import { api, apiBlob, ApiError } from "@/lib/api";
import { colors, layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type SettingsEnvelope = {
  settings: {
    avgLeadCost?: number | string | null;
    emailPrefs?: {
      emailNotifyInvite?: boolean;
      emailNotifyCapture?: boolean;
      emailNotifyCredits?: boolean;
    };
  };
};

type CollaboratorUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  canCapture?: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

export default function ConfiguracoesPage() {
  const { user, refresh, setTenant, tenant, isAdmin } = useAuth();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const menuWidth = isMobile ? "calc(100vw - 16px)" : 200;
  const cardPad = isMobile ? "md" : "lg";
  const [tab, setTab] = useState<string | null>("perfil");

  const [name, setName] = useState("");
  const [avgLeadCost, setAvgLeadCost] = useState<number | string>(2.5);
  const [emailNotifyInvite, setEmailNotifyInvite] = useState(true);
  const [emailNotifyCapture, setEmailNotifyCapture] = useState(true);
  const [emailNotifyCredits, setEmailNotifyCredits] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [users, setUsers] = useState<CollaboratorUser[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "operador">("operador");
  const [editingInvite, setEditingInvite] = useState<InviteRow | null>(null);
  const [editInviteRole, setEditInviteRole] = useState<"admin" | "operador">("operador");
  const [pendingDeleteInvite, setPendingDeleteInvite] = useState<InviteRow | null>(null);

  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingInvite, setDeletingInvite] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingCollabs, setLoadingCollabs] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<SettingsEnvelope>("/api/v1/settings");
        const s = data.settings;
        if (s.avgLeadCost != null) setAvgLeadCost(Number(s.avgLeadCost));
        if (typeof s.emailPrefs?.emailNotifyInvite === "boolean") {
          setEmailNotifyInvite(s.emailPrefs.emailNotifyInvite);
        }
        if (typeof s.emailPrefs?.emailNotifyCapture === "boolean") {
          setEmailNotifyCapture(s.emailPrefs.emailNotifyCapture);
        }
        if (typeof s.emailPrefs?.emailNotifyCredits === "boolean") {
          setEmailNotifyCredits(s.emailPrefs.emailNotifyCredits);
        }
        if (isAdmin && tenant) {
          setTenant({
            ...tenant,
            avgLeadCost: s.avgLeadCost ?? tenant.avgLeadCost,
          });
        }
      } catch {
        /* use defaults */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const loadCollaborators = async () => {
    setLoadingCollabs(true);
    try {
      const data = await api<{ users: CollaboratorUser[]; invites: InviteRow[] }>(
        "/api/v1/collaborators"
      );
      setUsers(data.users || []);
      setInvites(data.invites || []);
    } catch {
      setUsers([]);
      setInvites([]);
    } finally {
      setLoadingCollabs(false);
    }
  };

  useEffect(() => {
    if (isAdmin && tab === "colaboradores") void loadCollaborators();
  }, [tab, isAdmin]);

  useEffect(() => {
    if (!isAdmin && (tab === "colaboradores" || tab === "notificacoes")) {
      setTab("perfil");
    }
  }, [isAdmin, tab]);

  const saveProfile = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/settings", {
        method: "PATCH",
        body: {
          name: name.trim(),
          ...(isAdmin ? { avgLeadCost: Number(avgLeadCost) } : {}),
        },
      });
      await refresh();
      notifications.show({
        color: "green",
        title: "Configurações salvas",
        message: "As alterações foram salvas com sucesso.",
      });
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

  const savePassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (newPassword.length < 8) {
      notifications.show({
        color: "red",
        title: "Senha inválida",
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      notifications.show({
        color: "red",
        title: "Senhas diferentes",
        message: "A confirmação não confere com a nova senha.",
      });
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/v1/settings/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notifications.show({
        color: "green",
        title: "Senha atualizada",
        message: "Sua senha foi alterada com sucesso.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao alterar a senha.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const saveNotifications = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/settings", {
        method: "PATCH",
        body: {
          emailNotifyInvite,
          emailNotifyCapture,
          emailNotifyCredits,
        },
      });
      await refresh();
      notifications.show({
        color: "green",
        title: "Configurações salvas",
        message: "Preferências de notificação atualizadas.",
      });
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

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api("/api/v1/collaborators/invite", {
        method: "POST",
        body: { email: inviteEmail, role: inviteRole },
      });
      setInviteEmail("");
      notifications.show({
        color: "green",
        title: "Convite enviado",
        message: "O colaborador receberá o e-mail com o link.",
      });
      await loadCollaborators();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao convidar.",
      });
    } finally {
      setInviting(false);
    }
  };

  const openEditInvite = (row: InviteRow) => {
    setEditingInvite(row);
    setEditInviteRole(row.role === "admin" ? "admin" : "operador");
  };

  const saveInviteRole = async () => {
    if (!editingInvite) return;
    setSavingInvite(true);
    try {
      const data = await api<{ invite: InviteRow }>(
        `/api/v1/collaborators/invites/${editingInvite.id}`,
        {
          method: "PATCH",
          body: { role: editInviteRole },
        }
      );
      setInvites((prev) =>
        prev.map((row) => (row.id === editingInvite.id ? { ...row, ...data.invite } : row))
      );
      setEditingInvite(null);
      notifications.show({
        color: "green",
        title: "Convite atualizado",
        message: "O papel do convite foi alterado.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao atualizar o convite.",
      });
    } finally {
      setSavingInvite(false);
    }
  };

  const resendInvite = async (row: InviteRow) => {
    setResendingId(row.id);
    try {
      const data = await api<{ invite: InviteRow }>(
        `/api/v1/collaborators/invites/${row.id}/resend`,
        { method: "POST" }
      );
      setInvites((prev) =>
        prev.map((inviteRow) =>
          inviteRow.id === row.id ? { ...inviteRow, ...data.invite } : inviteRow
        )
      );
      notifications.show({
        color: "green",
        title: "Convite reenviado",
        message: `Um novo link foi enviado para ${row.email}.`,
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao reenviar o convite.",
      });
    } finally {
      setResendingId(null);
    }
  };

  const deleteInvite = async () => {
    if (!pendingDeleteInvite) return;
    setDeletingInvite(true);
    try {
      await api(`/api/v1/collaborators/invites/${pendingDeleteInvite.id}`, {
        method: "DELETE",
      });
      setInvites((prev) => prev.filter((row) => row.id !== pendingDeleteInvite.id));
      setPendingDeleteInvite(null);
      notifications.show({
        color: "green",
        title: "Convite revogado",
        message: "O link de convite não poderá mais ser usado.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao revogar o convite.",
      });
    } finally {
      setDeletingInvite(false);
    }
  };

  const formatInviteExpiry = (iso: string) => {
    const date = new Date(iso);
    const expired = date.getTime() < Date.now();
    const label = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return { label, expired };
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await apiBlob("/api/v1/leads/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbixlead-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao exportar CSV.",
      });
    } finally {
      setExporting(false);
    }
  };

  const roleLabel =
    user?.role === "admin" ? "Administrador" : user?.role === "operador" ? "Operador" : "—";

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle={
          isAdmin
            ? isMobile
              ? "Perfil e preferências da conta"
              : "Gerencie seu perfil e preferências da conta."
            : "Atualize seu nome e senha de acesso."
        }
        actions={
          tab === "perfil" ? (
            <Button size={isMobile ? "sm" : "md"} loading={saving} onClick={() => void saveProfile()}>
              {isMobile ? "Salvar" : "Salvar alterações"}
            </Button>
          ) : tab === "notificacoes" && isAdmin ? (
            <Button
              size={isMobile ? "sm" : "md"}
              loading={saving}
              onClick={() => void saveNotifications()}
            >
              {isMobile ? "Salvar" : "Salvar alterações"}
            </Button>
          ) : undefined
        }
      />

      <Card padding={cardPad} style={{ minWidth: 0 }}>
        <Tabs value={tab} onChange={setTab} color="orbix">
          <Tabs.List mb="lg" grow={!!isMobile}>
            <Tabs.Tab value="perfil">{isMobile ? "Perfil" : "Meu perfil"}</Tabs.Tab>
            {isAdmin ? (
              <Tabs.Tab value="colaboradores">
                {isMobile ? "Equipe" : "Colaboradores"}
              </Tabs.Tab>
            ) : null}
            {isAdmin ? (
              <Tabs.Tab value="notificacoes">
                {isMobile ? "E-mails" : "Notificações"}
              </Tabs.Tab>
            ) : null}
          </Tabs.List>

          <Tabs.Panel value="perfil">
            <form onSubmit={(e) => void saveProfile(e)}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  required
                  size={isMobile ? "sm" : "md"}
                />
                <TextInput
                  label="E-mail"
                  value={user?.email || ""}
                  disabled
                  size={isMobile ? "sm" : "md"}
                />
                <TextInput
                  label="Papel"
                  value={roleLabel}
                  disabled
                  size={isMobile ? "sm" : "md"}
                />
                <TextInput
                  label="Empresa"
                  value={tenant?.name || ""}
                  disabled
                  size={isMobile ? "sm" : "md"}
                />
                {isAdmin ? (
                  <NumberInput
                    label="Custo médio do lead (R$)"
                    description="Usado no dashboard e nas metas"
                    decimalScale={2}
                    fixedDecimalScale
                    min={0}
                    value={avgLeadCost}
                    onChange={setAvgLeadCost}
                    size={isMobile ? "sm" : "md"}
                  />
                ) : null}
              </SimpleGrid>

              {isAdmin ? (
                <Stack gap="sm" mt="xl">
                  <Title order={4} style={{ fontSize: isMobile ? 16 : undefined }}>
                    Exportação LGPD
                  </Title>
                  <Text size="sm" c={colors.textSecondary}>
                    Baixe um CSV com os leads do tenant. Soft-delete individual está disponível na
                    página do lead.
                  </Text>
                  <Button
                    leftSection={<Download size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                    loading={exporting}
                    onClick={() => void exportCsv()}
                    fullWidth={!!isMobile}
                    w={isMobile ? undefined : "fit-content"}
                    variant="light"
                  >
                    Exportar CSV
                  </Button>
                </Stack>
              ) : null}
            </form>

            <DividerPasswordSection
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              savingPassword={savingPassword}
              setCurrentPassword={setCurrentPassword}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              onSubmit={savePassword}
              compact={!!isMobile}
            />
          </Tabs.Panel>

          {isAdmin ? (
            <Tabs.Panel value="colaboradores">
              <Stack gap="lg">
                <form onSubmit={invite}>
                  <Title order={4} mb={4} style={{ fontSize: isMobile ? 16 : undefined }}>
                    Convidar colaborador
                  </Title>
                  <Text size="sm" c={colors.textSecondary} mb="md">
                    Envie um link por e-mail para o colaborador definir a senha.
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <TextInput
                      label="E-mail"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.currentTarget.value)}
                      size={isMobile ? "sm" : "md"}
                    />
                    <Select
                      label="Papel"
                      data={[
                        { value: "operador", label: "Operador" },
                        { value: "admin", label: "Admin" },
                      ]}
                      value={inviteRole}
                      onChange={(value) =>
                        setInviteRole((value as "admin" | "operador") || "operador")
                      }
                      allowDeselect={false}
                      size={isMobile ? "sm" : "md"}
                    />
                    <Group align="flex-end" grow={!!isMobile}>
                      <Button type="submit" loading={inviting} fullWidth={!!isMobile}>
                        Enviar convite
                      </Button>
                    </Group>
                  </SimpleGrid>
                </form>

                <div>
                  <Title order={4} mb="md" style={{ fontSize: isMobile ? 16 : undefined }}>
                    Convites pendentes
                  </Title>
                  {loadingCollabs ? (
                    <Text size="sm" c={colors.textMuted}>
                      Carregando...
                    </Text>
                  ) : invites.length === 0 ? (
                    <Text size="sm" c={colors.textMuted}>
                      Nenhum convite pendente.
                    </Text>
                  ) : isMobile ? (
                    <Stack gap={10}>
                      {invites.map((i) => {
                        const expiry = formatInviteExpiry(i.expiresAt);
                        return (
                          <Box
                            key={i.id}
                            style={{
                              border: `1px solid ${colors.borderLight}`,
                              borderRadius: 10,
                              padding: 12,
                              minWidth: 0,
                            }}
                          >
                            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
                                  {i.email}
                                </Text>
                                <Text size="xs" c={expiry.expired ? "red" : colors.textMuted} mt={4}>
                                  {expiry.label}
                                  {expiry.expired ? " (expirado)" : ""}
                                </Text>
                              </Box>
                              <Menu
                                shadow="md"
                                width={menuWidth}
                                position="bottom-end"
                                withinPortal
                              >
                                <Menu.Target>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Ações do convite"
                                    loading={resendingId === i.id}
                                  >
                                    <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item
                                    leftSection={
                                      <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                    }
                                    onClick={() => openEditInvite(i)}
                                  >
                                    Editar papel
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={
                                      <RefreshCw size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                    }
                                    onClick={() => void resendInvite(i)}
                                  >
                                    Reenviar e-mail
                                  </Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Item
                                    color="red"
                                    leftSection={
                                      <Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                    }
                                    onClick={() => setPendingDeleteInvite(i)}
                                  >
                                    Revogar
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                            <Group gap={8} wrap="wrap">
                              <Badge variant="light" color="gray">
                                {i.role === "admin" ? "Admin" : "Operador"}
                              </Badge>
                              <Badge variant="light" color={expiry.expired ? "red" : "orbix"}>
                                {expiry.expired ? "Expirado" : "Pendente"}
                              </Badge>
                            </Group>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Table.ScrollContainer minWidth={560}>
                      <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead style={{ background: colors.background }}>
                          <Table.Tr>
                            <Table.Th>E-mail</Table.Th>
                            <Table.Th>Papel</Table.Th>
                            <Table.Th>Expira em</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th w={56} />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {invites.map((i) => {
                            const expiry = formatInviteExpiry(i.expiresAt);
                            return (
                              <Table.Tr key={i.id}>
                                <Table.Td>
                                  <Text size="sm">{i.email}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge variant="light" color="gray">
                                    {i.role === "admin" ? "Admin" : "Operador"}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" c={expiry.expired ? "red" : undefined}>
                                    {expiry.label}
                                    {expiry.expired ? " (expirado)" : ""}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    variant="light"
                                    color={expiry.expired ? "red" : "orbix"}
                                  >
                                    {expiry.expired ? "Expirado" : "Pendente"}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Menu
                                    shadow="md"
                                    width={200}
                                    position="bottom-end"
                                    withinPortal
                                  >
                                    <Menu.Target>
                                      <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        aria-label="Ações do convite"
                                        loading={resendingId === i.id}
                                      >
                                        <MoreHorizontal
                                          size={ICON_SIZE}
                                          strokeWidth={ICON_STROKE}
                                        />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Item
                                        leftSection={
                                          <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                        }
                                        onClick={() => openEditInvite(i)}
                                      >
                                        Editar papel
                                      </Menu.Item>
                                      <Menu.Item
                                        leftSection={
                                          <RefreshCw
                                            size={ICON_SIZE}
                                            strokeWidth={ICON_STROKE}
                                          />
                                        }
                                        onClick={() => void resendInvite(i)}
                                      >
                                        Reenviar e-mail
                                      </Menu.Item>
                                      <Menu.Divider />
                                      <Menu.Item
                                        color="red"
                                        leftSection={
                                          <Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                                        }
                                        onClick={() => setPendingDeleteInvite(i)}
                                      >
                                        Revogar
                                      </Menu.Item>
                                    </Menu.Dropdown>
                                  </Menu>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </div>

                <div>
                  <Title order={4} mb="md" style={{ fontSize: isMobile ? 16 : undefined }}>
                    Equipe
                  </Title>
                  {loadingCollabs ? (
                    <Text size="sm" c={colors.textMuted}>
                      Carregando...
                    </Text>
                  ) : users.length === 0 ? (
                    <Text size="sm" c={colors.textMuted}>
                      Nenhum colaborador ativo.
                    </Text>
                  ) : isMobile ? (
                    <Stack gap={10}>
                      {users.map((u) => (
                        <Box
                          key={u.id}
                          style={{
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: 10,
                            padding: 12,
                            minWidth: 0,
                          }}
                        >
                          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={8}>
                            <Box style={{ minWidth: 0, flex: 1 }}>
                              <Text size="sm" fw={600} lineClamp={1}>
                                {u.name}
                              </Text>
                              <Text size="xs" c={colors.textMuted} style={{ wordBreak: "break-all" }}>
                                {u.email}
                              </Text>
                            </Box>
                            <Badge variant="light" color="green" style={{ flexShrink: 0 }}>
                              Ativo
                            </Badge>
                          </Group>
                          <Group gap={8} mb={u.role === "operador" ? 10 : 0} wrap="wrap">
                            <Badge variant="light" color="gray">
                              {u.role === "admin" ? "Admin" : "Operador"}
                            </Badge>
                          </Group>
                          {u.role === "operador" ? (
                            <Switch
                              size="sm"
                              checked={u.canCapture !== false}
                              onChange={() => {
                                const next = !(u.canCapture !== false);
                                void (async () => {
                                  try {
                                    await api(`/api/v1/collaborators/${u.id}`, {
                                      method: "PATCH",
                                      body: { canCapture: next },
                                    });
                                    setUsers((prev) =>
                                      prev.map((row) =>
                                        row.id === u.id ? { ...row, canCapture: next } : row
                                      )
                                    );
                                    notifications.show({
                                      color: "green",
                                      title: "Permissão atualizada",
                                      message: next
                                        ? "Operador pode capturar leads."
                                        : "Captura desabilitada para o operador.",
                                    });
                                  } catch (err) {
                                    notifications.show({
                                      color: "red",
                                      title: "Erro",
                                      message:
                                        err instanceof ApiError
                                          ? err.message
                                          : "Falha ao atualizar permissão.",
                                    });
                                  }
                                })();
                              }}
                              label={u.canCapture !== false ? "Captura permitida" : "Captura bloqueada"}
                            />
                          ) : null}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Table.ScrollContainer minWidth={560}>
                      <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead style={{ background: colors.background }}>
                          <Table.Tr>
                            <Table.Th>Nome</Table.Th>
                            <Table.Th>E-mail</Table.Th>
                            <Table.Th>Papel</Table.Th>
                            <Table.Th>Captura</Table.Th>
                            <Table.Th>Status</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {users.map((u) => (
                            <Table.Tr key={u.id}>
                              <Table.Td>
                                <Text size="sm" fw={600}>
                                  {u.name}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{u.email}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="gray">
                                  {u.role === "admin" ? "Admin" : "Operador"}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {u.role === "operador" ? (
                                  <Switch
                                    size="sm"
                                    checked={u.canCapture !== false}
                                    onChange={() => {
                                      const next = !(u.canCapture !== false);
                                      void (async () => {
                                        try {
                                          await api(`/api/v1/collaborators/${u.id}`, {
                                            method: "PATCH",
                                            body: { canCapture: next },
                                          });
                                          setUsers((prev) =>
                                            prev.map((row) =>
                                              row.id === u.id ? { ...row, canCapture: next } : row
                                            )
                                          );
                                          notifications.show({
                                            color: "green",
                                            title: "Permissão atualizada",
                                            message: next
                                              ? "Operador pode capturar leads."
                                              : "Captura desabilitada para o operador.",
                                          });
                                        } catch (err) {
                                          notifications.show({
                                            color: "red",
                                            title: "Erro",
                                            message:
                                              err instanceof ApiError
                                                ? err.message
                                                : "Falha ao atualizar permissão.",
                                          });
                                        }
                                      })();
                                    }}
                                    label={u.canCapture !== false ? "Permitido" : "Bloqueado"}
                                  />
                                ) : (
                                  <Text size="sm" c={colors.textMuted}>
                                    —
                                  </Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="green">
                                  Ativo
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </div>
              </Stack>

              <Modal
                opened={Boolean(editingInvite)}
                onClose={savingInvite ? () => undefined : () => setEditingInvite(null)}
                title="Editar convite"
                centered
                radius="lg"
                fullScreen={!!isMobile}
              >
                <Stack gap="md">
                  <TextInput label="E-mail" value={editingInvite?.email || ""} disabled />
                  <Select
                    label="Papel"
                    data={[
                      { value: "operador", label: "Operador" },
                      { value: "admin", label: "Admin" },
                    ]}
                    value={editInviteRole}
                    onChange={(value) =>
                      setEditInviteRole((value as "admin" | "operador") || "operador")
                    }
                    allowDeselect={false}
                  />
                  <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} gap="sm" wrap="wrap">
                    <Button
                      variant="default"
                      onClick={() => setEditingInvite(null)}
                      disabled={savingInvite}
                    >
                      Cancelar
                    </Button>
                    <Button loading={savingInvite} onClick={() => void saveInviteRole()}>
                      Salvar
                    </Button>
                  </Group>
                </Stack>
              </Modal>

              <ConfirmModal
                opened={Boolean(pendingDeleteInvite)}
                onClose={() => setPendingDeleteInvite(null)}
                onConfirm={deleteInvite}
                title="Revogar convite"
                message={`Tem certeza que deseja revogar o convite de "${pendingDeleteInvite?.email ?? ""}"? O link enviado deixará de funcionar.`}
                confirmLabel="Revogar"
                loading={deletingInvite}
              />
            </Tabs.Panel>
          ) : null}

          {isAdmin ? (
            <Tabs.Panel value="notificacoes">
              <form onSubmit={(e) => void saveNotifications(e)}>
                <Title order={4} mb={4} style={{ fontSize: isMobile ? 16 : undefined }}>
                  Notificações por e-mail
                </Title>
                <Text size="sm" c={colors.textSecondary} mb="lg">
                  Controle quais eventos deseja receber.
                </Text>
                <Stack gap={0}>
                  <Group
                    justify="space-between"
                    py="md"
                    wrap="nowrap"
                    gap="md"
                    style={{ borderBottom: `1px solid ${colors.borderLight}` }}
                  >
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={600}>
                        Convite de colaborador
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Quando um convite for aceito
                      </Text>
                    </Box>
                    <Switch
                      checked={emailNotifyInvite}
                      onChange={() => setEmailNotifyInvite((v) => !v)}
                      style={{ flexShrink: 0 }}
                    />
                  </Group>
                  <Group
                    justify="space-between"
                    py="md"
                    wrap="nowrap"
                    gap="md"
                    style={{ borderBottom: `1px solid ${colors.borderLight}` }}
                  >
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={600}>
                        Captura concluída
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Ao finalizar uma busca de leads
                      </Text>
                    </Box>
                    <Switch
                      checked={emailNotifyCapture}
                      onChange={() => setEmailNotifyCapture((v) => !v)}
                      style={{ flexShrink: 0 }}
                    />
                  </Group>
                  <Group justify="space-between" py="md" wrap="nowrap" gap="md">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={600}>
                        Alertas de créditos
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Quando o saldo estiver baixo ou esgotado
                      </Text>
                    </Box>
                    <Switch
                      checked={emailNotifyCredits}
                      onChange={() => setEmailNotifyCredits((v) => !v)}
                      style={{ flexShrink: 0 }}
                    />
                  </Group>
                </Stack>
              </form>
            </Tabs.Panel>
          ) : null}
        </Tabs>
      </Card>
    </>
  );
}

function DividerPasswordSection({
  currentPassword,
  newPassword,
  confirmPassword,
  savingPassword,
  setCurrentPassword,
  setNewPassword,
  setConfirmPassword,
  onSubmit,
  compact = false,
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingPassword: boolean;
  setCurrentPassword: (v: string) => void;
  setNewPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
  onSubmit: (e?: FormEvent) => void | Promise<void>;
  compact?: boolean;
}) {
  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Stack gap="sm" mt="xl" pt="xl" style={{ borderTop: `1px solid ${colors.borderLight}` }}>
        <Title order={4} style={{ fontSize: compact ? 16 : undefined }}>
          Alterar senha
        </Title>
        <Text size="sm" c={colors.textSecondary}>
          Informe a senha atual e escolha uma nova com no mínimo 8 caracteres.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <PasswordInput
            label="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            required
            size={compact ? "sm" : "md"}
          />
          {!compact ? <div /> : null}
          <PasswordInput
            label="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            required
            size={compact ? "sm" : "md"}
          />
          <PasswordInput
            label="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            required
            size={compact ? "sm" : "md"}
          />
        </SimpleGrid>
        <Button
          type="submit"
          loading={savingPassword}
          fullWidth={compact}
          w={compact ? undefined : "fit-content"}
          mt="sm"
        >
          Atualizar senha
        </Button>
      </Stack>
    </form>
  );
}
