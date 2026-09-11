"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Anchor, Button, PasswordInput, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthShell } from "@/components/common/AuthShell";
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
    <AuthShell
      subtitle="Redefinir senha — escolha uma nova senha para sua conta."
      footer={
        <Anchor component={Link} href="/login" size="sm" c={colors.primary}>
          Voltar ao login
        </Anchor>
      }
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <PasswordInput
            label="Nova senha"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="Mínimo 8 caracteres"
          />
          <PasswordInput
            label="Confirmar senha"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            placeholder="Repita a senha"
          />
          <Button type="submit" loading={loading} fullWidth>
            Salvar senha
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
