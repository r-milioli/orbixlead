"use client";

import { useEffect, useState } from "react";
import { Box, Stack, Text } from "@mantine/core";
import { Search } from "lucide-react";
import { colors, ICON_STROKE, radius, shadows } from "@/theme/tokens";

const PHASES = [
  {
    label: "Buscando no mapa",
    hint: "Estamos varrendo a região com cuidado para evitar bloqueios e trazer leads válidos.",
  },
  {
    label: "Analisando estabelecimentos",
    hint: "Conferindo nomes, endereços e sinais de contato antes de registrar cada lead.",
  },
  {
    label: "Validando contatos",
    hint: "Filtrando duplicados e números incompletos para não gastar crédito à toa.",
  },
  {
    label: "Organizando resultados",
    hint: "Quase lá — montando a lista para você revisar e enviar ao CRM.",
  },
] as const;

const PIN_POSITIONS = [
  { left: "22%", top: "28%", delay: "0.2s" },
  { left: "68%", top: "24%", delay: "1.1s" },
  { left: "48%", top: "58%", delay: "1.9s" },
  { left: "78%", top: "62%", delay: "2.7s" },
  { left: "30%", top: "72%", delay: "3.4s" },
] as const;

export function CaptureWaitingAnimation() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = PHASES[phaseIndex % PHASES.length];

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIndex((i) => i + 1);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <Stack align="center" gap="md" py="sm" aria-live="polite">
      <Box
        className="capture-wait-radar"
        aria-hidden
        style={{
          position: "relative",
          width: "min(240px, 72vw)",
          height: "min(240px, 72vw)",
          borderRadius: radius.xl,
          border: `1px solid ${colors.borderLight}`,
          background: colors.surfaceSecondary,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        <Box className="capture-wait-sweep" />
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box className="capture-wait-ring" />
          <Box className="capture-wait-ring" style={{ animationDelay: "0.9s" }} />
          <Box className="capture-wait-ring" style={{ animationDelay: "1.8s" }} />
          <Box
            style={{
              position: "relative",
              zIndex: 2,
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: colors.surface,
              border: `2px solid ${colors.primary}`,
              display: "grid",
              placeItems: "center",
              boxShadow: shadows.sm,
              color: colors.primaryDark,
            }}
          >
            <Search size={22} strokeWidth={ICON_STROKE} />
          </Box>
        </Box>
        {PIN_POSITIONS.map((pin, i) => (
          <Box
            key={i}
            className="capture-wait-pin"
            style={{ left: pin.left, top: pin.top, animationDelay: pin.delay }}
          />
        ))}
      </Box>

      <Stack gap={6} maw={360} ta="center">
        <Text fw={700} size="sm" className="capture-wait-dots">
          {phase.label}
        </Text>
        <Text size="sm" c={colors.textMuted} lh={1.45}>
          {phase.hint}
        </Text>
      </Stack>

      <Box
        className="capture-wait-progress"
        role="progressbar"
        aria-label="Progresso da captura"
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: "min(360px, 100%)",
          height: 6,
          background: colors.borderLight,
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <Box className="capture-wait-progress-bar" />
      </Box>
    </Stack>
  );
}
