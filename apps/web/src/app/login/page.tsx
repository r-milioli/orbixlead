"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, Button, Center, Loader, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { AuthShell } from "@/components/common/AuthShell";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { colors, layout } from "@/theme/tokens";

export default function LoginPage() {
  const { login, loading, needsSetup, user } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery(`(max-width: ${layout.mobileBreakpoint}px)`, false, {
    getInitialValueInEffect: true,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (needsSetup) {
      router.replace("/setup");
      return;
    }
    if (user) {
      if (user.role === "super_admin") {
        router.replace("/super-admin/tenants");
      } else if (user.role === "operador") {
        router.replace("/captura");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [loading, needsSetup, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  if (loading || needsSetup || user) {
    return (
      <Center mih="100vh" bg={colors.background}>
        <Loader color="orbix" />
      </Center>
    );
  }

  const fieldSize = isMobile ? "sm" : "md";

  return (
    <AuthShell subtitle={forgotMode ? "Recuperar acesso" : "Entre na sua conta"}>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="voce@empresa.com"
            size={fieldSize}
            autoComplete="email"
          />
          {!forgotMode ? (
            <PasswordInput
              label="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder="Sua senha"
              size={fieldSize}
              autoComplete="current-password"
            />
          ) : null}
          <Button type="submit" fullWidth loading={submitting} size={fieldSize}>
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
        style={{ alignSelf: "flex-start" }}
      >
        {forgotMode ? "Voltar ao login" : "Esqueci minha senha"}
      </Anchor>
    </AuthShell>
  );
}
