"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  PasswordInput,
  Title,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { CREDIT_PACKAGES } from "@orbixlead/shared";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { TenantAdmin } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors } from "@/theme/tokens";

export default function SuperAdminTenantsPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/v1/admin/tenants");
      setTenants(unwrapList<TenantAdmin>(data, "tenants"));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao listar tenants.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSuperAdmin) void load();
  }, [authLoading, isSuperAdmin]);

  const createTenant = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/admin/tenants", {
        method: "POST",
        body: { name, adminEmail, adminName, adminPassword },
      });
      setOpened(false);
      setName("");
      setAdminEmail("");
      setAdminName("");
      setAdminPassword("");
      notifications.show({ color: "green", title: "Tenant criado", message: "" });
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao criar tenant.",
      });
    } finally {
      setSaving(false);
    }
  };

  const grant = async (tenantId: string, pkg: number) => {
    try {
      await api(`/api/v1/admin/tenants/${tenantId}/credits`, {
        method: "POST",
        body: { amount: pkg },
      });
      notifications.show({
        color: "green",
        title: "Créditos liberados",
        message: `Pacote de ${pkg.toLocaleString("pt-BR")} leads.`,
      });
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao liberar créditos.",
      });
    }
  };

  const toggleUnlimited = async (tenant: TenantAdmin) => {
    try {
      await api(`/api/v1/admin/tenants/${tenant.id}/unlimited`, {
        method: "PATCH",
        body: { unlimited: !tenant.unlimited },
      });
      await load();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao alterar modo livre.",
      });
    }
  };

  if (authLoading) {
    return (
      <Center mih={240}>
        <Loader color="orbix" />
      </Center>
    );
  }

  if (!isSuperAdmin) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Apenas super admin pode gerenciar tenants."
        icon={Building2}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Criar contas, liberar pacotes e modo ilimitado"
        actions={
          <Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>
            Novo tenant
          </Button>
        }
      />

      {loading ? (
        <Center mih={240}>
          <Loader color="orbix" />
        </Center>
      ) : tenants.length === 0 ? (
        <EmptyState
          title="Nenhum tenant"
          description="Crie o primeiro tenant da plataforma."
          icon={Building2}
          action={
            <Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>
              Novo tenant
            </Button>
          }
        />
      ) : (
        <Card padding={0} withBorder>
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Créditos</Table.Th>
                  <Table.Th>Modo livre</Table.Th>
                  <Table.Th>Pacotes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tenants.map((t) => (
                  <Table.Tr key={t.id}>
                    <Table.Td>
                      <Text fw={600}>{t.name}</Text>
                      <Text size="xs" c={colors.textMuted}>
                        {t.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {t.unlimited ? (
                        <Badge color="orbix" variant="light">
                          Ilimitado
                        </Badge>
                      ) : (
                        <Text size="sm" fw={600}>
                          {t.creditRemaining.toLocaleString("pt-BR")} /{" "}
                          {t.creditCap.toLocaleString("pt-BR")}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={t.unlimited}
                        onChange={() => void toggleUnlimited(t)}
                        label={t.unlimited ? "Ativo" : "Off"}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        {CREDIT_PACKAGES.map((pkg) => (
                          <Button
                            key={pkg}
                            size="compact-sm"
                            variant="light"
                            onClick={() => void grant(t.id, pkg)}
                          >
                            {pkg.toLocaleString("pt-BR")}
                          </Button>
                        ))}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title="Novo tenant">
        <form onSubmit={createTenant}>
          <Stack gap="md">
            <TextInput
              label="Nome do tenant"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label="Nome do admin"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.currentTarget.value)}
            />
            <TextInput
              label="E-mail do admin"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Senha inicial do admin"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Criar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
