"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function RedefinirSenhaPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      notifications.show({
        color: "red",
        title: "Senhas diferentes",
        message: "Confirme a mesma senha nos dois campos.",
      });
      return;
    }
    setLoading(true);
    try {
      await api("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token: params.token, password },
      });
      notifications.show({
        color: "green",
        title: "Senha atualizada",
        message: "Faça login com a nova senha.",
      });
      router.replace("/login");
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Token inválido ou expirado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: colors.background,
      }}
    >
      <Paper w="100%" maw={420} p="xl" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2}>Redefinir senha</Title>
            <Text size="sm" c={colors.textSecondary} mt={4}>
              Escolha uma nova senha para sua conta.
            </Text>
          </div>
          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <PasswordInput
                label="Nova senha"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <PasswordInput
                label="Confirmar senha"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
              />
              <Button type="submit" loading={loading} fullWidth>
                Salvar senha
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </div>
  );
}
