import { Router } from "express";
import { creditUiState, KNOWN_PIPELINE_SLUGS } from "@orbixlead/shared";
import { GoalPeriodType, GoalScope, LeadClosedReason, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/metrics",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.user!.tenantId!;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const goalId = typeof req.query.goalId === "string" ? req.query.goalId.trim() : "";

    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId, slug: { in: [...KNOWN_PIPELINE_SLUGS] } },
      orderBy: { position: "asc" },
    });

    const funnel = await Promise.all(
      stages.map(async (stage) => {
        const count = await prisma.lead.count({
          where: { tenantId, stageId: stage.id, softDeletedAt: null },
        });
        return {
          slug: stage.slug,
          label: stage.label,
          count,
        };
      })
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const convertedStage = stages.find((s) => s.slug === "converted");
    const newStage = stages.find((s) => s.slug === "new");

    const [
      convertedThisMonth,
      importedThisMonth,
      leadsLast7Days,
      convertedLast7Days,
      importedToday,
      advancedToday,
      monthlyGoalsRaw,
    ] = await Promise.all([
      convertedStage
        ? prisma.lead.count({
            where: {
              tenantId,
              stageId: convertedStage.id,
              softDeletedAt: null,
              updatedAt: { gte: monthStart },
            },
          })
        : Promise.resolve(0),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: weekStart },
        },
      }),
      convertedStage
        ? prisma.lead.count({
            where: {
              tenantId,
              stageId: convertedStage.id,
              softDeletedAt: null,
              updatedAt: { gte: weekStart },
            },
          })
        : Promise.resolve(0),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: dayStart },
        },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          updatedAt: { gte: dayStart },
          ...(newStage ? { NOT: { stageId: newStage.id } } : {}),
        },
      }),
      prisma.goal.findMany({
        where: {
          tenantId,
          periodType: GoalPeriodType.MONTHLY,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          parentId: null,
          ...(req.user!.role === Role.OPERADOR
            ? {
                OR: [
                  { scope: GoalScope.COMPANY },
                  { scope: GoalScope.OPERATOR, assigneeId: req.user!.id },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const monthlyGoals = monthlyGoalsRaw;
    let monthlyGoal =
      (goalId ? monthlyGoals.find((g) => g.id === goalId) : undefined) ?? null;
    if (!monthlyGoal) {
      if (req.user!.role === Role.OPERADOR) {
        monthlyGoal =
          monthlyGoals.find(
            (g) => g.scope === GoalScope.OPERATOR && g.assigneeId === req.user!.id
          ) ??
          monthlyGoals.find((g) => g.scope === GoalScope.COMPANY) ??
          monthlyGoals[0] ??
          null;
      } else {
        monthlyGoal =
          monthlyGoals.find((g) => g.scope === GoalScope.COMPANY) ?? monthlyGoals[0] ?? null;
      }
    }

    const avgLeadCost = tenant.avgLeadCost ? Number(tenant.avgLeadCost) : 0;
    const costPerConversion =
      convertedThisMonth > 0 ? (importedThisMonth * avgLeadCost) / convertedThisMonth : null;
    const conversionRate =
      leadsLast7Days > 0 ? convertedLast7Days / leadsLast7Days : 0;

    const goalConversions =
      monthlyGoal?.scope === GoalScope.OPERATOR && monthlyGoal.assigneeId
        ? await prisma.lead.count({
            where: {
              tenantId,
              softDeletedAt: null,
              closedReason: LeadClosedReason.CONVERTED,
              closedAt: { gte: monthStart },
              assigneeId: monthlyGoal.assigneeId,
            },
          })
        : convertedThisMonth;

    const bySegment = convertedStage
      ? await prisma.lead.groupBy({
          by: ["segment"],
          where: {
            tenantId,
            softDeletedAt: null,
            stageId: convertedStage.id,
            updatedAt: { gte: monthStart },
          },
          _count: { _all: true },
        })
      : [];

    const upcomingSchedules = await prisma.schedule.count({
      where: {
        tenantId,
        scheduledAt: { gte: now },
      },
    });

    const recentJobs = await prisma.scrapingJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    // Prospection last 30 days: daily imported vs converted
    const thirtyStart = new Date(dayStart);
    thirtyStart.setDate(thirtyStart.getDate() - 29);
    const [importedDaily, convertedDaily] = await Promise.all([
      prisma.lead.findMany({
        where: { tenantId, softDeletedAt: null, createdAt: { gte: thirtyStart } },
        select: { createdAt: true },
      }),
      convertedStage
        ? prisma.lead.findMany({
            where: {
              tenantId,
              softDeletedAt: null,
              stageId: convertedStage.id,
              updatedAt: { gte: thirtyStart },
            },
            select: { updatedAt: true },
          })
        : Promise.resolve([] as { updatedAt: Date }[]),
    ]);

    const prospection30d: { day: string; imported: number; converted: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyStart);
      d.setDate(thirtyStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = String(d.getDate()).padStart(2, "0");
      const imported = importedDaily.filter((l) => l.createdAt.toISOString().slice(0, 10) === key)
        .length;
      const converted = convertedDaily.filter((l) => l.updatedAt.toISOString().slice(0, 10) === key)
        .length;
      if (i % 5 === 0 || i === 29) {
        prospection30d.push({ day: label, imported, converted });
      }
    }

    const goalTarget = monthlyGoal?.targetConversions ?? 0;
    const goalProgress = goalTarget > 0 ? Math.min(1, goalConversions / goalTarget) : 0;

    return res.json({
      metrics: {
        credits: {
          remaining: tenant.creditRemaining,
          cap: tenant.creditCap,
          unlimited: tenant.unlimited,
          cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
          state: tenant.unlimited
            ? "normal"
            : creditUiState(tenant.creditRemaining, tenant.creditCap),
        },
        funnel,
        kpis: {
          conversionRate,
          costPerConversion,
          leadsLast7Days,
          convertedLast7Days,
          importedToday,
          advancedToday,
        },
        period: {
          importedLeads: importedThisMonth,
          conversions: convertedThisMonth,
          avgLeadCost,
          costPerConversion,
        },
        goal: monthlyGoal
          ? {
              id: monthlyGoal.id,
              name: monthlyGoal.name,
              target: goalTarget,
              current: goalConversions,
              progress: goalProgress,
              scope: monthlyGoal.scope === GoalScope.COMPANY ? "company" : "operator",
              assigneeId: monthlyGoal.assigneeId,
            }
          : null,
        availableGoals: monthlyGoals.map((g) => ({
          id: g.id,
          name: g.name,
          scope: g.scope === GoalScope.COMPANY ? "company" : "operator",
          assigneeId: g.assigneeId,
        })),
        prospection30d,
        conversionsBySegment: bySegment.map((row) => ({
          segment: row.segment ?? "sem_segmento",
          count: row._count._all,
        })),
        upcomingSchedules,
        recentJobs: recentJobs.map((j) => ({
          id: j.id,
          city: j.city,
          segment: j.segment,
          status: j.status.toLowerCase(),
          quantity: j.quantity,
          newCount: j.newCount,
          createdAt: j.createdAt.toISOString(),
        })),
      },
    });
  })
);

export default router;
