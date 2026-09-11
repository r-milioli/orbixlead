"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme/tokens";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, needsSetup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(needsSetup ? "/setup" : "/login");
    }
  }, [loading, user, needsSetup, router]);

  if (loading || !user) {
    return (
      <Center mih="100vh" bg={colors.background}>
        <Loader color="orbix" />
      </Center>
    );
  }

  return <AppShell>{children}</AppShell>;
}
