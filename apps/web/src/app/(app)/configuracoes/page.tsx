"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
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
import { notifications } from "@mantine/notifications";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/lib/auth";
import { api, apiBlob, ApiError } from "@/lib/api";
import { colors, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

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

  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
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
            ? "Gerencie seu perfil e preferências da conta."
            : "Atualize seu nome e senha de acesso."
        }
        actions={
          tab === "perfil" ? (
            <Button loading={saving} onClick={() => void saveProfile()}>
              Salvar alterações
            </Button>
          ) : tab === "notificacoes" && isAdmin ? (
            <Button loading={saving} onClick={() => void saveNotifications()}>
              Salvar alterações
            </Button>
          ) : undefined
        }
      />

      <Card padding="lg">
        <Tabs value={tab} onChange={setTab} color="orbix">
          <Tabs.List mb="lg">
            <Tabs.Tab value="perfil">Meu perfil</Tabs.Tab>
            {isAdmin ? <Tabs.Tab value="colaboradores">Colaboradores</Tabs.Tab> : null}
            {isAdmin ? <Tabs.Tab value="notificacoes">Notificações</Tabs.Tab> : null}
          </Tabs.List>

          <Tabs.Panel value="perfil">
            <form onSubmit={(e) => void saveProfile(e)}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  required
                />
                <TextInput label="E-mail" value={user?.email || ""} disabled />
                <TextInput label="Papel" value={roleLabel} disabled />
                <TextInput label="Empresa" value={tenant?.name || ""} disabled />
                {isAdmin ? (
                  <NumberInput
                    label="Custo médio do lead (R$)"
                    description="Usado no dashboard e nas metas"
                    decimalScale={2}
                    fixedDecimalScale
                    min={0}
                    value={avgLeadCost}
                    onChange={setAvgLeadCost}
                  />
                ) : null}
              </SimpleGrid>

              {isAdmin ? (
                <Stack gap="sm" mt="xl">
                  <Title order={4}>Exportação LGPD</Title>
                  <Text size="sm" c={colors.textSecondary}>
                    Baixe um CSV com os leads do tenant. Soft-delete individual está disponível na
                    página do lead.
                  </Text>
                  <Button
                    leftSection={<Download size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                    loading={exporting}
                    onClick={() => void exportCsv()}
                    w="fit-content"
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
            />
          </Tabs.Panel>

          {isAdmin ? (
            <Tabs.Panel value="colaboradores">
              <Stack gap="lg">
                <form onSubmit={invite}>
                  <Title order={4} mb={4}>
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
                    />
                    <Group align="flex-end">
                      <Button type="submit" loading={inviting}>
                        Enviar convite
                      </Button>
                    </Group>
                  </SimpleGrid>
                </form>

                <div>
                  <Title order={4} mb="md">
                    Equipe
                  </Title>
                  {loadingCollabs ? (
                    <Text size="sm" c={colors.textMuted}>
                      Carregando...
                    </Text>
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
                          {invites.map((i) => (
                            <Table.Tr key={i.id}>
                              <Table.Td>
                                <Text size="sm" c={colors.textMuted}>
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{i.email}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="gray">
                                  {i.role === "admin" ? "Admin" : "Operador"}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c={colors.textMuted}>
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="orbix">
                                  Convite pendente
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
            </Tabs.Panel>
          ) : null}

          {isAdmin ? (
            <Tabs.Panel value="notificacoes">
              <form onSubmit={(e) => void saveNotifications(e)}>
                <Title order={4} mb={4}>
                  Notificações por e-mail
                </Title>
                <Text size="sm" c={colors.textSecondary} mb="lg">
                  Controle quais eventos deseja receber.
                </Text>
                <Stack gap={0}>
                  <Group
                    justify="space-between"
                    py="md"
                    style={{ borderBottom: `1px solid ${colors.borderLight}` }}
                  >
                    <div>
                      <Text size="sm" fw={600}>
                        Convite de colaborador
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Quando um convite for aceito
                      </Text>
                    </div>
                    <Switch
                      checked={emailNotifyInvite}
                      onChange={() => setEmailNotifyInvite((v) => !v)}
                    />
                  </Group>
                  <Group
                    justify="space-between"
                    py="md"
                    style={{ borderBottom: `1px solid ${colors.borderLight}` }}
                  >
                    <div>
                      <Text size="sm" fw={600}>
                        Captura concluída
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Ao finalizar uma busca de leads
                      </Text>
                    </div>
                    <Switch
                      checked={emailNotifyCapture}
                      onChange={() => setEmailNotifyCapture((v) => !v)}
                    />
                  </Group>
                  <Group justify="space-between" py="md">
                    <div>
                      <Text size="sm" fw={600}>
                        Alertas de créditos
                      </Text>
                      <Text size="xs" c={colors.textMuted}>
                        Quando o saldo estiver baixo ou esgotado
                      </Text>
                    </div>
                    <Switch
                      checked={emailNotifyCredits}
                      onChange={() => setEmailNotifyCredits((v) => !v)}
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
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingPassword: boolean;
  setCurrentPassword: (v: string) => void;
  setNewPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
  onSubmit: (e?: FormEvent) => void | Promise<void>;
}) {
  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Stack gap="sm" mt="xl" pt="xl" style={{ borderTop: `1px solid ${colors.borderLight}` }}>
        <Title order={4}>Alterar senha</Title>
        <Text size="sm" c={colors.textSecondary}>
          Informe a senha atual e escolha uma nova com no mínimo 8 caracteres.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <PasswordInput
            label="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            required
          />
          <div />
          <PasswordInput
            label="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            required
          />
        </SimpleGrid>
        <Button type="submit" loading={savingPassword} w="fit-content" mt="sm">
          Atualizar senha
        </Button>
      </Stack>
    </form>
  );
}
