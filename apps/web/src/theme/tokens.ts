/** Design System tokens — Orbixlead CRM */

export const colors = {
  primary: "#15AABF",
  primaryHover: "#1098AD",
  primaryDark: "#0C8599",
  primaryLight: "#E3FAFC",

  background: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceSecondary: "#F1F3F5",
  surfaceHover: "#F8F9FA",

  textPrimary: "#212529",
  textSecondary: "#495057",
  textMuted: "#868E96",
  textDisabled: "#ADB5BD",

  border: "#DEE2E6",
  borderLight: "#E9ECEF",
  borderFocus: "#15AABF",

  success: "#2F9E44",
  successBg: "#EBFBEE",
  warning: "#F08C00",
  warningBg: "#FFF4E6",
  danger: "#E03131",
  dangerBg: "#FFF5F5",
  info: "#15AABF",
  infoBg: "#E3FAFC",
} as const;

export const radius = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
} as const;

export const shadows = {
  xs: "0 1px 2px rgba(0,0,0,.04)",
  sm: "0 2px 6px rgba(0,0,0,.06)",
  md: "0 8px 24px rgba(0,0,0,.08)",
  lg: "0 16px 40px rgba(0,0,0,.12)",
} as const;

export const layout = {
  sidebarExpanded: 248,
  sidebarCollapsed: 72,
  topbarHeight: 64,
} as const;

export const ICON_STROKE = 1.5;
export const ICON_SIZE = 18;

export const temperatureColors = {
  frio: { color: "#1971C2", bg: "#E7F5FF" },
  morno: { color: "#E67700", bg: "#FFF3BF" },
  quente: { color: "#C92A2A", bg: "#FFE3E3" },
} as const;
