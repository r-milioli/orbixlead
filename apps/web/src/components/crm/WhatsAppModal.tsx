"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  Group,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { applyTemplate, buildWhatsAppUrl } from "@orbixlead/shared";
import { api } from "@/lib/api";
import type { MessageTemplate } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { colors, layout } from "@/theme/tokens";

type Props = {
  opened: boolean;
  onClose: () => void;
  phoneE164: string;
  companyName: string;
  contactName?: string;
};

export function WhatsAppModal({
  opened,
  onClose,
  phoneE164,
  companyName,
  contactName,
}: Props) {
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    api("/api/v1/templates")
      .then((data) => {
        const list = unwrapList<MessageTemplate>(data, "templates");
        setTemplates(list);
        if (list[0]) {
          setTemplateId(list[0].id);
          setMessage(
            applyTemplate(list[0].body, {
              nome: contactName || companyName,
              empresa: companyName,
            })
          );
        } else {
          setTemplateId(null);
          setMessage(`Olá! Vi a empresa ${companyName} e gostaria de conversar.`);
        }
      })
      .catch(() => {
        setTemplates([]);
        setMessage(`Olá! Vi a empresa ${companyName} e gostaria de conversar.`);
      })
      .finally(() => setLoading(false));
  }, [opened, companyName, contactName]);

  const onSelectTemplate = (id: string | null) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setMessage(
        applyTemplate(tpl.body, {
          nome: contactName || companyName,
          empresa: companyName,
        })
      );
    }
  };

  const openWhatsApp = () => {
    const url = buildWhatsAppUrl(phoneE164, message);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Enviar WhatsApp"
      size="md"
      centered
      fullScreen={!!isMobile}
    >
      <Stack gap="md">
        <Select
          label="Template"
          placeholder={loading ? "Carregando..." : "Selecione um template"}
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={templateId}
          onChange={onSelectTemplate}
          clearable
        />
        <Textarea
          label="Mensagem"
          minRows={isMobile ? 6 : 5}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
        />
        <Text size="xs" c={colors.textMuted}>
          Variáveis: {"{nome}"} {"{empresa}"}
        </Text>
        <Group justify={isMobile ? "stretch" : "flex-end"} grow={!!isMobile} wrap="wrap">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={openWhatsApp} disabled={!phoneE164 || !message.trim()}>
            Abrir WhatsApp
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
