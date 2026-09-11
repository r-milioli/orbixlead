"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthShell } from "@/components/common/AuthShell";
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
    </AuthShell>
  );
}
