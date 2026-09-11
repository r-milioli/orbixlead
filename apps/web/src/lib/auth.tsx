"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "@orbixlead/shared";
import { api, ApiError } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  emailNotifyInvite?: boolean;
  emailNotifyCapture?: boolean;
  emailNotifyCredits?: boolean;
};

export type TenantCredits = {
  id: string;
  name: string;
  unlimited: boolean;
  creditCap: number;
  creditRemaining: number;
  cycleEndsAt: string | null;
  avgLeadCost?: number | string | null;
};

export type MeResponse = {
  user: AuthUser;
  tenant: TenantCredits | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  tenant: TenantCredits | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<MeResponse>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOperador: boolean;
  canAccess: (roles: Role[]) => boolean;
  setTenant: (tenant: TenantCredits | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(role: string): Role {
  const map: Record<string, Role> = {
    super_admin: "super_admin",
    SUPER_ADMIN: "super_admin",
    admin: "admin",
    ADMIN: "admin",
    operador: "operador",
    OPERADOR: "operador",
  };
  return map[role] ?? (role.toLowerCase() as Role);
}

function normalizeMe(data: MeResponse): MeResponse {
  return {
    user: {
      ...data.user,
      role: normalizeRole(data.user.role),
    },
    tenant: data.tenant
      ? {
          ...data.tenant,
          unlimited: Boolean(data.tenant.unlimited),
          creditCap: Number(data.tenant.creditCap ?? 0),
          creditRemaining: Number(data.tenant.creditRemaining ?? 0),
        }
      : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<TenantCredits | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = normalizeMe(await api<MeResponse>("/api/v1/auth/me"));
      setUser(data.user);
      setTenant(data.tenant);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
        setTenant(null);
      } else {
        setUser(null);
        setTenant(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await api("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const data = normalizeMe(await api<MeResponse>("/api/v1/auth/me"));
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setTenant(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role;
    return {
      user,
      tenant,
      loading,
      refresh,
      login,
      logout,
      isSuperAdmin: role === "super_admin",
      isAdmin: role === "admin",
      isOperador: role === "operador",
      canAccess: (roles) => (role ? roles.includes(role) : false),
      setTenant,
    };
  }, [user, tenant, loading, refresh, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
