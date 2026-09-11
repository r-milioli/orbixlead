"use client";

import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { colors } from "@/theme/tokens";

type ConfirmModalProps = {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
};

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title = "Confirmar exclusão",
  message,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  loading = false,
  danger = true,
}: ConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={loading ? () => undefined : onClose}
      title={title}
      centered
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.45 }}
    >
      <Stack gap="lg">
        <Text size="sm" c={colors.textSecondary} style={{ lineHeight: 1.5 }}>
          {message}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            color={danger ? "red" : "orbix"}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
