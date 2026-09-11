"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Burger,
  Divider,
  Group,
  Indicator,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  Bell,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Target,
  Users,
  Building2,
} from "lucide-react";
import type { Role } from "@orbixlead/shared";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications-events";
import type { AppNotification } from "@/lib/types";
import { unwrapList } from "@/lib/unwrap";
import { CreditsDisplay } from "@/components/credits/CreditsDisplay";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ColorSchemeToggle } from "@/components/layout/ColorSchemeToggle";
import { colors, layout, ICON_SIZE, ICON_STROKE } from "@/theme/tokens";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  roles: Role[];
  requiresCapture?: boolean;
};

type NavGroup = {
  id: string;
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "super",
    items: [
      {
        label: "Super Admin",
        href: "/super-admin/tenants",
        icon: Building2,
        roles: ["super_admin"],
      },
    ],
  },
  {
    id: "main",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "operador"],
      },
    ],
  },
  {
    id: "prospeccao",
    label: "Prospecção",
    items: [
      {
        label: "Captura",
        href: "/captura",
        icon: Search,
        roles: ["admin", "operador"],
        requiresCapture: true,
      },
      {
        label: "Leads",
        href: "/leads",
        icon: Users,
        roles: ["admin", "operador"],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      {
        label: "Pipeline",
        href: "/crm",
        icon: KanbanSquare,
        roles: ["admin", "operador"],
      },
      {
        label: "Mensagens",
        href: "/mensagens",
        icon: MessageSquare,
        roles: ["admin"],
      },
      {
        label: "Agenda",
        href: "/agenda",
        icon: Calendar,
        roles: ["admin", "operador"],
      },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      {
        label: "Metas",
        href: "/metas",
        icon: Target,
        roles: ["admin", "operador"],
      },
      {
        label: "Notificações",
        href: "/notificacoes",
        icon: Bell,
        roles: ["admin", "operador"],
      },
    ],
  },
  {
    id: "config",
    items: [
      {
        label: "Configurações",
        href: "/configuracoes",
        icon: Settings,
        roles: ["admin", "operador"],
      },
    ],
  },
];

function LogoMark({ collapsed }: { collapsed: boolean }) {
  return <BrandLogo size={36} collapsed={collapsed} priority />;
}

function NavLinkItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <UnstyledButton
      component={Link}
      href={item.href}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: collapsed ? "10px 0" : "10px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 6,
        background: active ? colors.primaryLight : "transparent",
        color: active ? colors.primaryDark : colors.textSecondary,
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        letterSpacing: "-0.01em",
        transition: "background .12s ease, color .12s ease",
        position: "relative",
      }}
    >
      {active && !collapsed ? (
        <Box
          component="span"
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: "0 3px 3px 0",
            background: colors.primary,
          }}
        />
      ) : null}
      <Icon
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        color={active ? colors.primaryDark : colors.textSecondary}
      />
      {!collapsed ? <span>{item.label}</span> : null}
    </UnstyledButton>
  );

  if (collapsed) {
    return (
      <Tooltip label={item.label} position="right" withArrow>
        {content}
      </Tooltip>
    );
  }
  return content;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenant, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, { toggle: toggleCollapsed }] = useDisclosure(false);
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 768px)", false, {
    getInitialValueInEffect: true,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const role = user?.role;
  const canCapture = role === "admin" || user?.canCapture !== false;
  const navGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!role || !item.roles.includes(role)) return false;
        if (item.requiresCapture && !canCapture) return false;
        return true;
      }),
    })).filter((group) => group.items.length > 0);
  }, [role, canCapture]);

  useEffect(() => {
    if (pathname.startsWith("/captura") && role === "operador" && user?.canCapture === false) {
      router.replace("/dashboard");
    }
  }, [pathname, role, user?.canCapture, router]);

  const sidebarCollapsed = collapsed && !isMobile;
  const sidebarWidth = sidebarCollapsed ? layout.sidebarCollapsed : layout.sidebarExpanded;
  const unread = notifications.length;

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const data = await api<{ notifications: AppNotification[]; unreadCount?: number }>(
        "/api/v1/notifications?status=unread&take=50"
      );
      const list = unwrapList<AppNotification>(data, "notifications");
      setNotifications(list.filter((n) => !n.readAt));
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    void loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    const onChanged = () => void loadNotifications();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [user?.id]);

  const markRead = async (id: string) => {
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      await api("/api/v1/notifications/read-all", { method: "POST" });
      setNotifications([]);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <Box
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: colors.background,
        }}
      >
        <Loader color="orbix" />
      </Box>
    );
  }

  const sidebar = (
    <Box
      component="aside"
      style={{
        width: isMobile ? layout.sidebarExpanded : sidebarWidth,
        background: colors.surface,
        borderRight: `1px solid ${colors.borderLight}`,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "width .2s ease",
        overflow: "hidden",
      }}
    >
      <Box px={sidebarCollapsed ? 8 : 16} py={16}>
        {sidebarCollapsed ? (
          <Stack gap={8} align="center">
            <LogoMark collapsed />
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={toggleCollapsed}
              aria-label="Expandir menu"
              size="sm"
            >
              <ChevronsRight size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ActionIcon>
          </Stack>
        ) : (
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <LogoMark collapsed={false} />
            {!isMobile ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={toggleCollapsed}
                aria-label="Recolher menu"
                style={{ flexShrink: 0 }}
              >
                <ChevronsLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </ActionIcon>
            ) : null}
          </Group>
        )}
      </Box>

      <Divider color={colors.borderLight} />

      <ScrollArea style={{ flex: 1 }} px={sidebarCollapsed ? 8 : 12} py={12} type="scroll">
        <Stack gap={sidebarCollapsed ? 8 : 12}>
          {navGroups.map((group, index) => (
            <Box key={group.id}>
              {index > 0 ? <Divider mb={sidebarCollapsed ? 8 : 12} color={colors.borderLight} /> : null}
              {!sidebarCollapsed && group.label ? (
                <Text
                  size="xs"
                  fw={700}
                  c={colors.textMuted}
                  tt="uppercase"
                  px={12}
                  mb={6}
                  style={{ letterSpacing: "0.06em", fontSize: 11 }}
                >
                  {group.label}
                </Text>
              ) : null}
              <Stack gap={4}>
                {group.items.map((item) => (
                  <NavLinkItem
                    key={item.href}
                    item={item}
                    active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    collapsed={sidebarCollapsed}
                    onNavigate={closeMobile}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      {tenant && user?.role !== "super_admin" ? (
        <Box
          px={sidebarCollapsed ? 8 : 16}
          py={16}
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          {sidebarCollapsed ? (
            <Tooltip
              label={`${tenant.creditRemaining} / ${tenant.creditCap}`}
              position="right"
            >
              <Group justify="center">
                <Coins size={ICON_SIZE} strokeWidth={ICON_STROKE} color={colors.primary} />
              </Group>
            </Tooltip>
          ) : (
            <CreditsDisplay
              remaining={tenant.creditRemaining}
              cap={tenant.creditCap}
              unlimited={tenant.unlimited}
            />
          )}
        </Box>
      ) : null}
    </Box>
  );

  return (
    <Box style={{ display: "flex", minHeight: "100vh", background: colors.background }}>
      {isMobile ? (
        mobileOpened ? (
          <Box
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
            }}
          >
            <Box
              onClick={closeMobile}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(33,37,41,.35)",
              }}
            />
            <Box style={{ position: "relative", zIndex: 1, height: "100%" }}>{sidebar}</Box>
          </Box>
        ) : null
      ) : (
        <Box style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>{sidebar}</Box>
      )}

      <Box style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box
          component="header"
          style={{
            height: layout.topbarHeight,
            background: colors.surface,
            borderBottom: `1px solid ${colors.borderLight}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <Group gap="sm">
            {isMobile ? (
              <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
            ) : null}
            {tenant && user?.role !== "super_admin" ? (
              <CreditsDisplay
                remaining={tenant.creditRemaining}
                cap={tenant.creditCap}
                unlimited={tenant.unlimited}
                compact
              />
            ) : (
              <Text size="sm" c={colors.textMuted}>
                Plataforma
              </Text>
            )}
          </Group>

          <Group gap="sm" style={{ overflow: "visible" }}>
            <ColorSchemeToggle />
            {user?.role !== "super_admin" ? (
              <Menu width={320} position="bottom-end" withinPortal>
                <Menu.Target>
                  <Indicator
                    disabled={unread === 0}
                    label={unread > 9 ? "9+" : String(unread)}
                    size={18}
                    offset={4}
                    color="orbix"
                    inline
                    styles={{
                      indicator: {
                        fontSize: 10,
                        fontWeight: 700,
                        minWidth: 18,
                        paddingInline: unread > 9 ? 4 : 0,
                      },
                    }}
                  >
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Notificações"
                      style={{ overflow: "visible" }}
                    >
                      <Bell size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </ActionIcon>
                  </Indicator>
                </Menu.Target>
                <Menu.Dropdown>
                  <Group justify="space-between" px="sm" py={6}>
                    <Text size="sm" fw={600}>
                      Não lidas
                    </Text>
                    {unread > 0 ? (
                      <UnstyledButton onClick={() => void markAllRead()}>
                        <Text size="xs" c={colors.primary}>
                          Marcar todas
                        </Text>
                      </UnstyledButton>
                    ) : null}
                  </Group>
                  <Divider />
                  {notifLoading ? (
                    <Group justify="center" py="md">
                      <Loader size="sm" />
                    </Group>
                  ) : notifications.length === 0 ? (
                    <Text size="sm" c={colors.textMuted} p="md" ta="center">
                      Nenhuma notificação nova
                    </Text>
                  ) : (
                    <ScrollArea.Autosize mah={280}>
                      {notifications.slice(0, 12).map((n) => (
                        <Menu.Item
                          key={n.id}
                          onClick={() => void markRead(n.id)}
                          style={{ background: colors.primaryLight }}
                        >
                          <Stack gap={2}>
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm" fw={600} lineClamp={1}>
                                {n.title}
                              </Text>
                              <Badge size="xs" variant="filled" color="orbix">
                                Nova
                              </Badge>
                            </Group>
                            <Text size="xs" c={colors.textMuted} lineClamp={2}>
                              {n.body}
                            </Text>
                          </Stack>
                        </Menu.Item>
                      ))}
                    </ScrollArea.Autosize>
                  )}
                  <Divider />
                  <Menu.Item component={Link} href="/notificacoes">
                    <Text size="sm" c={colors.primary} ta="center" w="100%">
                      Ver todas as notificações
                    </Text>
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : null}

            <Menu width={220} position="bottom-end" withinPortal>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={8}>
                    <Avatar radius="xl" size={32} color="orbix">
                      {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                    </Avatar>
                    {!isMobile ? (
                      <div>
                        <Text size="sm" fw={600} lh={1.2}>
                          {user?.name}
                        </Text>
                        <Text size="xs" c={colors.textMuted} lh={1.2}>
                          {user?.role === "super_admin"
                            ? "Super Admin"
                            : user?.role === "admin"
                              ? "Admin"
                              : "Operador"}
                        </Text>
                      </div>
                    ) : null}
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.email}</Menu.Label>
                {user?.role === "admin" || user?.role === "operador" ? (
                  <Menu.Item
                    leftSection={<Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                    onClick={() => router.push("/configuracoes")}
                  >
                    Configurações
                  </Menu.Item>
                ) : null}
                <Menu.Item
                  color="red"
                  leftSection={<LogOut size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                  onClick={async () => {
                    await logout();
                    router.replace("/login");
                  }}
                >
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>

        <Box component="main" p={{ base: "md", md: "xl" }} style={{ flex: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
