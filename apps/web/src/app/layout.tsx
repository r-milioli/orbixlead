import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/pt-br";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "./globals.css";
import { theme } from "@/theme/mantine";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Orbixlead",
    template: "%s · Orbixlead",
  },
  description: "CRM de captura e gestão de leads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body style={{ fontFamily: "Inter, system-ui, sans-serif" }} suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <DatesProvider settings={{ locale: "pt-br", firstDayOfWeek: 0 }}>
            <Notifications position="top-right" zIndex={4000} />
            <AuthProvider>{children}</AuthProvider>
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
