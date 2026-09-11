"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Anchor, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthShell } from "@/components/common/AuthShell";
import { api, ApiError } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function ConvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
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
      await api("/api/v1/auth/accept-invite", {
        method: "POST",
        body: {
          token: params.token,
          name,
          password,
        },
      });
      notifications.show({
        color: "green",
        title: "Convite aceito",
        message: "Sua conta foi ativada. Faça login para continuar.",
      });
      router.replace("/login");
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message: err instanceof ApiError ? err.message : "Convite inválido ou expirado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      subtitle="Aceitar convite — defina seu nome e senha para acessar."
      footer={
        <Anchor component={Link} href="/login" size="sm" c={colors.primary}>
          Já tem conta? Entrar
        </Anchor>
      }
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Seu nome"
          />
          <PasswordInput
            label="Senha"
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
            Ativar conta
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
