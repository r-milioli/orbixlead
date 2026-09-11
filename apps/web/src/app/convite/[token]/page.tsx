"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
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
            <Title order={2} c={colors.textPrimary}>
              Aceitar convite
            </Title>
            <Text size="sm" c={colors.textSecondary} mt={4}>
              Defina seu nome e senha para acessar o Orbixlead.
            </Text>
          </div>
          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <TextInput
                label="Nome"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <PasswordInput
                label="Senha"
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
                Ativar conta
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </div>
  );
}
