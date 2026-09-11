import { Router } from "express";
import { z } from "zod";
import { goalMetrics } from "@orbixlead/shared";
import { GoalPeriodType, GoalScope, LeadClosedReason, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

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

const scopeToApi: Record<GoalScope, string> = {
  COMPANY: "company",
  OPERATOR: "operator",
};

function visibilityWhere(req: AuthedRequest): Prisma.GoalWhereInput {
  const tenantId = req.user!.tenantId!;
  if (req.user!.role === Role.ADMIN) {
    return { tenantId };
  }
  return {
    tenantId,
    OR: [
      { scope: GoalScope.COMPANY },
      { scope: GoalScope.OPERATOR, assigneeId: req.user!.id },
    ],
  };
}

type GoalRow = {
  id: string;
  name: string;
  periodType: GoalPeriodType;
  scope: GoalScope;
  assigneeId: string | null;
  parentId: string | null;
  year: number;
  month: number | null;
  week: number | null;
  day: number | null;
  targetConversions: number;
  precoVenda: { toString(): string };
  custoPorConversao: { toString(): string };
  createdAt: Date;
  assignee?: { id: string; name: string; email: string } | null;
  children?: GoalRow[];
};

function serializeGoal(g: GoalRow): Record<string, unknown> {
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
    scope: scopeToApi[g.scope],
    assigneeId: g.assigneeId,
    assignee: g.assignee
      ? { id: g.assignee.id, name: g.assignee.name, email: g.assignee.email }
      : null,
    parentId: g.parentId,
    year: g.year,
    month: g.month,
    week: g.week,
    day: g.day,
    targetConversions: g.targetConversions,
    precoVenda,
    custoPorConversao,
    metrics,
    convertedCount: undefined as number | undefined,
    createdAt: g.createdAt.toISOString(),
    children: Array.isArray(g.children) ? g.children.map((c) => serializeGoal(c)) : undefined,
  };
}

function goalPeriodBounds(g: {
  periodType: GoalPeriodType;
  year: number;
  month: number | null;
  week: number | null;
  day: number | null;
}) {
  if (g.periodType === GoalPeriodType.DAILY && g.month && g.day) {
    const start = new Date(g.year, g.month - 1, g.day);
    const end = new Date(g.year, g.month - 1, g.day + 1);
    return { start, end };
  }
  if (g.periodType === GoalPeriodType.WEEKLY && g.month) {
    const start = new Date(g.year, g.month - 1, 1);
    const end = new Date(g.year, g.month, 1);
    return { start, end };
  }
  if (g.month) {
    const start = new Date(g.year, g.month - 1, 1);
    const end = new Date(g.year, g.month, 1);
    return { start, end };
  }
  return { start: new Date(g.year, 0, 1), end: new Date(g.year + 1, 0, 1) };
}

async function attachConvertedCount(
  tenantId: string,
  serialized: Record<string, unknown>,
  raw: GoalRow
): Promise<Record<string, unknown>> {
  const { start, end } = goalPeriodBounds(raw);
  const convertedCount = await prisma.lead.count({
    where: {
      tenantId,
      softDeletedAt: null,
      closedReason: LeadClosedReason.CONVERTED,
      closedAt: { gte: start, lt: end },
      ...(raw.scope === GoalScope.OPERATOR && raw.assigneeId
        ? { assigneeId: raw.assigneeId }
        : {}),
    },
  });

  let children: Record<string, unknown>[] | undefined;
  if (raw.children?.length) {
    children = await Promise.all(
      raw.children.map((child, idx) =>
        attachConvertedCount(
          tenantId,
          (serialized.children as Record<string, unknown>[])[idx],
          child
        )
      )
    );
  }

  return { ...serialized, convertedCount, ...(children ? { children } : {}) };
}

async function resolveScopeAssignee(
  tenantId: string,
  scope: "company" | "operator",
  assigneeId: string | undefined
): Promise<{ scope: GoalScope; assigneeId: string | null } | { error: string }> {
  if (scope === "company") {
    return { scope: GoalScope.COMPANY, assigneeId: null };
  }
  if (!assigneeId) {
    return { error: "Selecione o operador responsável pela meta" };
  }
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, tenantId, role: Role.OPERADOR },
  });
  if (!assignee) {
    return { error: "Operador inválido" };
  }
  return { scope: GoalScope.OPERATOR, assigneeId: assignee.id };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tree = req.query.tree === "1" || req.query.tree === "true";
    const where = visibilityWhere(req);

    if (tree) {
      const roots = await prisma.goal.findMany({
        where: { ...where, parentId: null },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          children: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              children: {
                include: { assignee: { select: { id: true, name: true, email: true } } },
              },
            },
            orderBy: [{ week: "asc" }, { day: "asc" }],
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
      const goals = await Promise.all(
        roots.map((g) => attachConvertedCount(req.user!.tenantId!, serializeGoal(g as GoalRow), g as GoalRow))
      );
      return res.json({ goals });
    }

    const goalsRaw = await prisma.goal.findMany({
      where,
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    const goals = await Promise.all(
      goalsRaw.map((g) =>
        attachConvertedCount(req.user!.tenantId!, serializeGoal(g as GoalRow), g as GoalRow)
      )
    );
    return res.json({ goals });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        periodType: z.enum(["monthly", "weekly", "daily"]),
        scope: z.enum(["company", "operator"]).default("company"),
        assigneeId: z.string().optional(),
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

    const tenantId = req.user!.tenantId!;
    let scopeResolved = await resolveScopeAssignee(tenantId, body.scope, body.assigneeId);
    if ("error" in scopeResolved) {
      return res.status(400).json({ error: scopeResolved.error });
    }

    if (body.parentId) {
      const parent = await prisma.goal.findFirst({
        where: { id: body.parentId, tenantId },
      });
      if (!parent) return res.status(400).json({ error: "Meta pai inválida" });
      // Filhas herdam o escopo da meta pai
      scopeResolved = {
        scope: parent.scope,
        assigneeId: parent.assigneeId,
      };
    }

    const goal = await prisma.goal.create({
      data: {
        tenantId,
        name: body.name,
        periodType: periodFromApi[body.periodType],
        scope: scopeResolved.scope,
        assigneeId: scopeResolved.assigneeId,
        parentId: body.parentId,
        year: body.year,
        month: body.month,
        week: body.week,
        day: body.day,
        targetConversions: body.targetConversions,
        precoVenda: body.precoVenda,
        custoPorConversao: body.custoPorConversao,
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return res.status(201).json({ goal: serializeGoal(goal as GoalRow) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, ...visibilityWhere(req) },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        children: {
          include: { assignee: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!goal) return res.status(404).json({ error: "Meta não encontrada" });
    return res.json({ goal: serializeGoal(goal as GoalRow) });
  })
);

router.patch(
  "/:id",
  requireRole(Role.ADMIN),
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
        scope: z.enum(["company", "operator"]).optional(),
        assigneeId: z.string().nullable().optional(),
      })
      .parse(req.body);

    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!existing) return res.status(404).json({ error: "Meta não encontrada" });

    const data: Prisma.GoalUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.targetConversions !== undefined) data.targetConversions = body.targetConversions;
    if (body.precoVenda !== undefined) data.precoVenda = body.precoVenda;
    if (body.custoPorConversao !== undefined) data.custoPorConversao = body.custoPorConversao;
    if (body.month !== undefined) data.month = body.month;
    if (body.week !== undefined) data.week = body.week;
    if (body.day !== undefined) data.day = body.day;

    if (body.scope !== undefined || body.assigneeId !== undefined) {
      const nextScope = body.scope ?? (existing.scope === GoalScope.OPERATOR ? "operator" : "company");
      const nextAssignee =
        body.assigneeId === undefined
          ? existing.assigneeId ?? undefined
          : body.assigneeId ?? undefined;
      const resolved = await resolveScopeAssignee(
        req.user!.tenantId!,
        nextScope,
        nextAssignee
      );
      if ("error" in resolved) {
        return res.status(400).json({ error: resolved.error });
      }
      data.scope = resolved.scope;
      data.assignee = resolved.assigneeId
        ? { connect: { id: resolved.assigneeId } }
        : { disconnect: true };
    }

    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data,
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    return res.json({ goal: serializeGoal(goal as GoalRow) });
  })
);

router.delete(
  "/:id",
  requireRole(Role.ADMIN),
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
