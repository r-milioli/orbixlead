"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Center,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { applyTemplate } from "@orbixlead/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { api, ApiError } from "@/lib/api";
import type { MessageTemplate } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors } from "@/theme/tokens";

export default function MensagensPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MessageTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/v1/templates");
      setTemplates(unwrapList<MessageTemplate>(data, "templates"));
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao carregar templates.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setBody("Olá {nome}, tudo bem? Vi a empresa {empresa} e gostaria de conversar.");
    setOpened(true);
  };

  const openEdit = (tpl: MessageTemplate) => {
    setEditing(tpl);
    setName(tpl.name);
    setBody(tpl.body);
    setOpened(true);
  };

  const insertVar = (token: string) => {
    setBody((prev) => `${prev}${token}`);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/v1/templates/${editing.id}`, {
          method: "PATCH",
          body: { name, body },
        });
      } else {
        await api("/api/v1/templates", {
          method: "POST",
          body: { name, body },
        });
      }
      setOpened(false);
      await load();
      notifications.show({
        color: "green",
        title: editing ? "Template atualizado" : "Template criado",
        message: "",
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

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/v1/templates/${pendingDelete.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== pendingDelete.id));
      setPendingDelete(null);
      notifications.show({
        color: "green",
        title: "Template excluído",
        message: "O modelo de mensagem foi removido.",
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Falha ao excluir.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const preview = applyTemplate(body, {
    nome: "João",
    empresa: "Empresa XPTO",
  });

  return (
    <>
      <PageHeader
        title="Mensagens"
        subtitle="Templates para WhatsApp com variáveis {nome} e {empresa}"
        actions={
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            Novo template
          </Button>
        }
      />

      {loading ? (
        <Center mih={240}>
          <Loader color="orbix" />
        </Center>
      ) : templates.length === 0 ? (
        <EmptyState
          title="Nenhum template"
          description="Crie mensagens reutilizáveis para abordar leads."
          action={
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              Novo template
            </Button>
          }
        />
      ) : (
        <Stack gap="sm">
          {templates.map((tpl) => (
            <Card key={tpl.id} padding="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Title order={5} mb={6}>
                    {tpl.name}
                  </Title>
                  <Text size="sm" c={colors.textSecondary} lineClamp={3}>
                    {tpl.body}
                  </Text>
                </div>
                <Group gap={6}>
                  <Button
                    variant="subtle"
                    leftSection={<Pencil size={14} />}
                    onClick={() => openEdit(tpl)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => setPendingDelete(tpl)}
                  >
                    Excluir
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? "Editar template" : "Novo template"}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput
              label="Nome do template"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Textarea
              label="Mensagem"
              required
              minRows={6}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
            <Group gap="xs">
              <Text size="sm" c={colors.textMuted}>
                Variáveis:
              </Text>
              <Button size="compact-xs" variant="light" onClick={() => insertVar("{nome}")}>
                {"{nome}"}
              </Button>
              <Button size="compact-xs" variant="light" onClick={() => insertVar("{empresa}")}>
                {"{empresa}"}
              </Button>
            </Group>
            <Card withBorder shadow="none" padding="sm" bg={colors.surfaceSecondary}>
              <Text size="xs" fw={600} mb={6} c={colors.textMuted}>
                Preview
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {preview}
              </Text>
            </Card>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title="Excluir template"
        message={`Tem certeza que deseja excluir o template "${pendingDelete?.name ?? ""}"? Esta ação não pode ser desfeita.`}
      />
    </>
  );
}
