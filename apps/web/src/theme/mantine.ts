"use client";

import { createTheme, MantineColorsTuple } from "@mantine/core";
import { colors, radius, shadows } from "./tokens";

/** 10-shade cyan-like primary mapped around #15AABF */
const orbix: MantineColorsTuple = [
  "#E3FAFC",
  "#C5F6FA",
  "#99E9F2",
  "#66D9E8",
  "#3BC9DB",
  "#15AABF",
  "#1098AD",
  "#0C8599",
  "#0B7285",
  "#086078",
];

export const theme = createTheme({
  primaryColor: "orbix",
  primaryShade: 5,
  colors: {
    orbix,
  },
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSizes: {
    xs: "12px",
    sm: "13px",
    md: "14px",
    lg: "16px",
    xl: "18px",
  },
  lineHeights: {
    xs: "1.35",
    sm: "1.4",
    md: "1.5",
    lg: "1.55",
    xl: "1.6",
  },
  defaultRadius: "sm",
  radius: {
    xs: radius.xs,
    sm: radius.sm,
    md: radius.md,
    lg: radius.lg,
    xl: radius.xl,
  },
  shadows: {
    xs: shadows.xs,
    sm: shadows.sm,
    md: shadows.md,
    lg: shadows.lg,
    xl: shadows.lg,
  },
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: "650",
    sizes: {
      h1: { fontSize: "28px", lineHeight: "1.2", fontWeight: "700" },
      h2: { fontSize: "24px", lineHeight: "1.25", fontWeight: "700" },
      h3: { fontSize: "16px", lineHeight: "1.35", fontWeight: "700" },
      h4: { fontSize: "16px", lineHeight: "1.35", fontWeight: "700" },
    },
  },
  other: {
    colors,
    iconStroke: 1.5,
    iconSize: 18,
  },
  components: {
    Button: {
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          fontWeight: 600,
          fontSize: 14,
        },
      },
    },
    Text: {
      styles: {
        root: {
          letterSpacing: "-0.01em",
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: "sm",
        size: "sm",
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "sm",
        size: "sm",
      },
    },
    Select: {
      defaultProps: {
        radius: "sm",
        size: "sm",
      },
    },
    Textarea: {
      defaultProps: {
        radius: "sm",
        size: "sm",
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "sm",
        size: "sm",
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
        shadow: "none",
      },
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "none",
        withBorder: true,
        padding: "md",
      },
      styles: {
        root: {
          borderColor: colors.borderLight,
          background: colors.surface,
        },
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          fontWeight: 700,
          fontSize: 11,
          textTransform: "none" as const,
        },
      },
    },
    Notification: {
      defaultProps: {
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        variant: "subtle",
        color: "gray",
      },
    },
  },
});
