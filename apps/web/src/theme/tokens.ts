/** Design System tokens — Orbixlead CRM
 * Valores concretos ficam em globals.css (--orbix-*).
 * Aqui exportamos referências CSS para light/dark funcionarem juntos.
 */

export const colors = {
  primary: "var(--orbix-primary)",
  primaryHover: "var(--orbix-primary-hover)",
  primaryDark: "var(--orbix-primary-dark)",
  primaryLight: "var(--orbix-primary-light)",

  background: "var(--orbix-bg)",
  surface: "var(--orbix-surface)",
  surfaceSecondary: "var(--orbix-surface-secondary)",
  surfaceHover: "var(--orbix-surface-hover)",

  textPrimary: "var(--orbix-text)",
  textSecondary: "var(--orbix-text-secondary)",
  textMuted: "var(--orbix-text-muted)",
  textDisabled: "var(--orbix-text-disabled)",

  border: "var(--orbix-border)",
  borderLight: "var(--orbix-border-light)",
  borderFocus: "var(--orbix-primary)",

  success: "var(--orbix-success)",
  successBg: "var(--orbix-success-bg)",
  warning: "var(--orbix-warning)",
  warningBg: "var(--orbix-warning-bg)",
  danger: "var(--orbix-danger)",
  dangerBg: "var(--orbix-danger-bg)",
  info: "var(--orbix-primary)",
  infoBg: "var(--orbix-primary-light)",
} as const;

/** Valores literais (útil quando CSS var não cabe, ex.: canvas/charts) */
export const colorValues = {
  light: {
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
    success: "#2F9E44",
    successBg: "#EBFBEE",
    warning: "#F08C00",
    warningBg: "#FFF4E6",
    danger: "#E03131",
    dangerBg: "#FFF5F5",
  },
  dark: {
    primary: "#15AABF",
    primaryHover: "#3BC9DB",
    primaryDark: "#66D9E8",
    primaryLight: "rgba(21, 170, 191, 0.16)",
    background: "#141517",
    surface: "#1A1B1E",
    surfaceSecondary: "#25262B",
    surfaceHover: "#2C2E33",
    textPrimary: "#F8F9FA",
    textSecondary: "#C1C2C5",
    textMuted: "#909296",
    textDisabled: "#5C5F66",
    border: "#373A40",
    borderLight: "#2C2E33",
    success: "#51CF66",
    successBg: "rgba(47, 158, 68, 0.18)",
    warning: "#FFA94D",
    warningBg: "rgba(240, 140, 0, 0.18)",
    danger: "#FF6B6B",
    dangerBg: "rgba(224, 49, 49, 0.18)",
  },
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
