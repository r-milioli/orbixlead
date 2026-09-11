"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
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
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

export default function ConfiguracoesPage() {
  const { user, refresh, setTenant, tenant } = useAuth();
  const [tab, setTab] = useState<string | null>("perfil");

  const [name, setName] = useState("");
  const [avgLeadCost, setAvgLeadCost] = useState<number | string>(2.5);
  const [emailNotifyInvite, setEmailNotifyInvite] = useState(true);
  const [emailNotifyCapture, setEmailNotifyCapture] = useState(true);
  const [emailNotifyCredits, setEmailNotifyCredits] = useState(true);

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
        if (tenant) {
          setTenant({
            ...tenant,
            avgLeadCost: s.avgLeadCost ?? tenant.avgLeadCost,
          });
        }
      } catch {
        /* use defaults */
      }
    })();
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
    if (tab === "colaboradores") void loadCollaborators();
  }, [tab]);

  const saveProfile = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/settings", {
        method: "PATCH",
        body: {
          name: name.trim(),
          avgLeadCost: Number(avgLeadCost),
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
        subtitle="Gerencie seu perfil e preferências da conta."
        actions={
          tab === "perfil" ? (
            <Button loading={saving} onClick={() => void saveProfile()}>
              Salvar alterações
            </Button>
          ) : tab === "notificacoes" ? (
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
            <Tabs.Tab value="colaboradores">Colaboradores</Tabs.Tab>
            <Tabs.Tab value="notificacoes">Notificações</Tabs.Tab>
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
                <NumberInput
                  label="Custo médio do lead (R$)"
                  description="Usado no dashboard e nas metas"
                  decimalScale={2}
                  fixedDecimalScale
                  min={0}
                  value={avgLeadCost}
                  onChange={setAvgLeadCost}
                />
              </SimpleGrid>

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
            </form>
          </Tabs.Panel>

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
                    onChange={(e) => setEmailNotifyInvite(e.currentTarget.checked)}
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
                    onChange={(e) => setEmailNotifyCapture(e.currentTarget.checked)}
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
                    onChange={(e) => setEmailNotifyCredits(e.currentTarget.checked)}
                  />
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </>
  );
}
