import { Router } from "express";
import { z } from "zod";
import { goalMetrics } from "@orbixlead/shared";
import { GoalPeriodType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN));

const periodFromApi: Record<string, GoalPeriodType> = {
  monthly: GoalPeriodType.MONTHLY,
  weekly: GoalPeriodType.WEEKLY,
  daily: GoalPeriodType.DAILY,
};

const periodToApi: Record<GoalPeriodType, string> = {
  MONTHLY: "monthly",
  WEEKLY: "weekly",
  DAILY: "daily",
};

function serializeGoal(g: {
  id: string;
  name: string;
  periodType: GoalPeriodType;
  parentId: string | null;
  year: number;
  month: number | null;
  week: number | null;
  day: number | null;
  targetConversions: number;
  precoVenda: { toString(): string };
  custoPorConversao: { toString(): string };
  createdAt: Date;
  children?: Array<{
    id: string;
    name: string;
    periodType: GoalPeriodType;
    parentId: string | null;
    year: number;
    month: number | null;
    week: number | null;
    day: number | null;
    targetConversions: number;
    precoVenda: { toString(): string };
    custoPorConversao: { toString(): string };
    createdAt: Date;
    children?: unknown[];
  }>;
}): Record<string, unknown> {
  const precoVenda = Number(g.precoVenda);
  const custoPorConversao = Number(g.custoPorConversao);
  const metrics = goalMetrics({
    precoVenda,
    conversoesAlvo: g.targetConversions,
    custoPorConversao,
  });

  return {
    id: g.id,
    name: g.name,
    periodType: periodToApi[g.periodType],
    parentId: g.parentId,
    year: g.year,
    month: g.month,
    week: g.week,
    day: g.day,
    targetConversions: g.targetConversions,
    precoVenda,
    custoPorConversao,
    metrics,
    createdAt: g.createdAt.toISOString(),
    children: Array.isArray(g.children) ? g.children.map((c) => serializeGoal(c as typeof g)) : undefined,
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tree = req.query.tree === "1" || req.query.tree === "true";

    if (tree) {
      const roots = await prisma.goal.findMany({
        where: { tenantId: req.user!.tenantId!, parentId: null },
        include: {
          children: {
            include: { children: true },
            orderBy: [{ week: "asc" }, { day: "asc" }],
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
      return res.json({ goals: roots.map(serializeGoal) });
    }

    const goals = await prisma.goal.findMany({
      where: { tenantId: req.user!.tenantId! },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ goals: goals.map(serializeGoal) });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        periodType: z.enum(["monthly", "weekly", "daily"]),
        parentId: z.string().optional(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12).optional(),
        week: z.number().int().min(1).max(53).optional(),
        day: z.number().int().min(1).max(31).optional(),
        targetConversions: z.number().int().positive(),
        precoVenda: z.number().positive(),
        custoPorConversao: z.number().nonnegative(),
      })
      .parse(req.body);

    if (body.parentId) {
      const parent = await prisma.goal.findFirst({
        where: { id: body.parentId, tenantId: req.user!.tenantId! },
      });
      if (!parent) return res.status(400).json({ error: "Meta pai inválida" });
    }

    const goal = await prisma.goal.create({
      data: {
        tenantId: req.user!.tenantId!,
        name: body.name,
        periodType: periodFromApi[body.periodType],
        parentId: body.parentId,
        year: body.year,
        month: body.month,
        week: body.week,
        day: body.day,
        targetConversions: body.targetConversions,
        precoVenda: body.precoVenda,
        custoPorConversao: body.custoPorConversao,
      },
    });

    return res.status(201).json({ goal: serializeGoal(goal) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
      include: { children: true },
    });
    if (!goal) return res.status(404).json({ error: "Meta não encontrada" });
    return res.json({ goal: serializeGoal(goal) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        targetConversions: z.number().int().positive().optional(),
        precoVenda: z.number().positive().optional(),
        custoPorConversao: z.number().nonnegative().optional(),
        month: z.number().int().min(1).max(12).optional(),
        week: z.number().int().min(1).max(53).optional(),
        day: z.number().int().min(1).max(31).optional(),
      })
      .parse(req.body);

    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!existing) return res.status(404).json({ error: "Meta não encontrada" });

    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: body,
    });
    return res.json({ goal: serializeGoal(goal) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!existing) return res.status(404).json({ error: "Meta não encontrada" });
    await prisma.goal.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  })
);

export default router;
