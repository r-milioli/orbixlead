"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { useAuth } from "@/lib/auth";

export default function AppHomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "super_admin") {
      router.replace("/super-admin/tenants");
    } else if (user.role === "operador") {
      router.replace("/captura");
    } else {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <Center mih={240}>
      <Loader color="orbix" />
    </Center>
  );
}
