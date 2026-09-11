"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Center, Loader, PasswordInput, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthShell } from "@/components/common/AuthShell";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function SetupPage() {
  const { setup, loading, needsSetup, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(user.role === "super_admin" ? "/super-admin/tenants" : "/dashboard");
      return;
    }
    if (!needsSetup) {
      router.replace("/login");
    }
  }, [loading, needsSetup, user, router]);

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
    setSubmitting(true);
    try {
      await setup({ name, email, password });
      notifications.show({
        color: "orbix",
        title: "Super admin criado",
        message: "Sua conta de plataforma está pronta.",
      });
      router.replace("/super-admin/tenants");
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro",
        message:
          err instanceof ApiError ? err.message : "Não foi possível criar o super admin.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !needsSetup || user) {
    return (
      <Center mih="100vh" bg={colors.background}>
        <Loader color="orbix" />
      </Center>
    );
  }

  return (
    <AuthShell subtitle="Primeiro acesso — crie o super admin da plataforma.">
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Seu nome"
          />
          <TextInput
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="admin@suaempresa.com"
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
          <Button type="submit" fullWidth loading={submitting}>
            Criar super admin
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
