"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Anchor,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (forgotMode) {
        const { api } = await import("@/lib/api");
        await api("/api/v1/auth/forgot-password", {
          method: "POST",
          body: { email },
        });
        notifications.show({
          color: "orbix",
          title: "E-mail enviado",
          message: "Se o e-mail existir, você receberá o link para redefinir a senha.",
        });
        setForgotMode(false);
        return;
      }

      const me = await login(email, password);
      if (me.user.role === "super_admin") {
        router.replace("/super-admin/tenants");
      } else if (me.user.role === "operador") {
        router.replace("/captura");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.";
      notifications.show({ color: "red", title: "Erro", message });
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
        background: `linear-gradient(180deg, ${colors.primaryLight} 0%, ${colors.background} 42%)`,
      }}
    >
      <Paper w="100%" maw={420} p="xl" withBorder radius="md" shadow="sm">
        <Stack gap="lg">
          <div>
            <Group gap={10} mb={8}>
              <Image src="/logo.png" alt="Orbixlead" width={44} height={44} priority />
              <Title order={2} c={colors.primary} style={{ letterSpacing: "-0.02em" }}>
                Orbixlead
              </Title>
            </Group>
            <Text size="sm" c={colors.textSecondary}>
              {forgotMode ? "Recuperar acesso" : "Entre na sua conta"}
            </Text>
          </div>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              <TextInput
                label="E-mail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="voce@empresa.com"
              />
              {!forgotMode ? (
                <PasswordInput
                  label="Senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="Sua senha"
                />
              ) : null}
              <Button type="submit" fullWidth loading={loading}>
                {forgotMode ? "Enviar link" : "Entrar"}
              </Button>
            </Stack>
          </form>

          <Anchor
            component="button"
            type="button"
            size="sm"
            c={colors.primary}
            onClick={() => setForgotMode((v) => !v)}
          >
            {forgotMode ? "Voltar ao login" : "Esqueci minha senha"}
          </Anchor>
        </Stack>
      </Paper>
    </div>
  );
}
