import { Router } from "express";
import { creditUiState, goalMetrics } from "@orbixlead/shared";
import { GoalPeriodType, GoalScope, LeadClosedReason, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

const COMPANY_VIEW = "__company__";

function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function goalProgress(current: number, target: number) {
  return target > 0 ? Math.min(1, current / target) : 0;
}

function parsePeriod(query: AuthedRequest["query"], now: Date) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  let year = Number(query.year);
  let month = Number(query.month);
  if (!Number.isInteger(year) || year < 2020 || year > currentYear + 1) {
    year = currentYear;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = currentMonth;
  }
  // Não permite mês futuro
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    year = currentYear;
    month = currentMonth;
  }
  return { year, month, isCurrentMonth: year === currentYear && month === currentMonth };
}

router.get(
  "/metrics",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.user!.tenantId!;
    const role = req.user!.role;
    const userId = req.user!.id;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const goalId = typeof req.query.goalId === "string" ? req.query.goalId.trim() : "";

    const now = new Date();
    const { year, month, isCurrentMonth } = parsePeriod(req.query, now);

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // "Hoje" / últimos 7 dias: no mês corrente usa o dia real; em mês passado usa o fim do mês.
    const refDay = isCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(year, month, 0);
    const dayStart = new Date(refDay.getFullYear(), refDay.getMonth(), refDay.getDate());
    const dayEnd = new Date(refDay.getFullYear(), refDay.getMonth(), refDay.getDate() + 1);
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    if (weekStart < monthStart) {
      weekStart.setTime(monthStart.getTime());
    }

    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { position: "asc" },
    });

    const monthlyGoalsRaw = await prisma.goal.findMany({
      where: {
        tenantId,
        periodType: GoalPeriodType.MONTHLY,
        year,
        month,
        parentId: null,
        ...(role === Role.OPERADOR
          ? {
              OR: [
                { scope: GoalScope.COMPANY },
                { scope: GoalScope.OPERATOR, assigneeId: userId },
              ],
            }
          : {}),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const wantsCompanyView = goalId === COMPANY_VIEW || goalId === "";
    const requestedGoal =
      !wantsCompanyView && goalId
        ? monthlyGoalsRaw.find((g) => g.id === goalId)
        : undefined;

    let selectedGoal = requestedGoal ?? null;
    let forceCompanyView = goalId === COMPANY_VIEW;

    if (!selectedGoal && !forceCompanyView && goalId === "") {
      if (role === Role.OPERADOR) {
        selectedGoal =
          monthlyGoalsRaw.find(
            (g) => g.scope === GoalScope.OPERATOR && g.assigneeId === userId
          ) ??
          monthlyGoalsRaw.find((g) => g.scope === GoalScope.COMPANY) ??
          null;
        if (!selectedGoal) forceCompanyView = true;
      } else {
        selectedGoal =
          monthlyGoalsRaw.find((g) => g.scope === GoalScope.COMPANY) ?? null;
        if (!selectedGoal) forceCompanyView = true;
      }
    }

    const metricAssigneeId =
      !forceCompanyView &&
      selectedGoal?.scope === GoalScope.OPERATOR &&
      selectedGoal.assigneeId
        ? selectedGoal.assigneeId
        : null;

    const leadScope = metricAssigneeId ? { assigneeId: metricAssigneeId } : {};

    const funnel = await Promise.all(
      stages.map(async (stage) => {
        const count = await prisma.lead.count({
          where: {
            tenantId,
            stageId: stage.id,
            softDeletedAt: null,
            ...leadScope,
          },
        });
        return {
          slug: stage.slug,
          label: stage.label,
          count,
        };
      })
    );

    const convertedWhere = (from: Date, to: Date) => ({
      tenantId,
      softDeletedAt: null,
      closedReason: LeadClosedReason.CONVERTED,
      closedAt: { gte: from, lt: to },
      ...leadScope,
    });

    const [
      convertedThisMonth,
      importedThisMonth,
      leadsLast7Days,
      convertedLast7Days,
      importedToday,
      convertedToday,
      captureJobsToday,
      captureJobsMonth,
    ] = await Promise.all([
      prisma.lead.count({ where: convertedWhere(monthStart, monthEnd) }),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: monthStart, lt: monthEnd },
          ...leadScope,
        },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: weekStart, lt: dayEnd },
          ...leadScope,
        },
      }),
      prisma.lead.count({ where: convertedWhere(weekStart, dayEnd) }),
      prisma.lead.count({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: dayStart, lt: dayEnd },
          ...leadScope,
        },
      }),
      prisma.lead.count({ where: convertedWhere(dayStart, dayEnd) }),
      prisma.scrapingJob.findMany({
        where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
        select: { newCount: true },
      }),
      prisma.scrapingJob.findMany({
        where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
        select: { newCount: true },
      }),
    ]);

    const capturesToday = captureJobsToday.length;
    const leadsFoundToday = captureJobsToday.reduce((sum, j) => sum + (j.newCount ?? 0), 0);
    const capturesMonth = captureJobsMonth.length;
    const leadsFoundMonth = captureJobsMonth.reduce((sum, j) => sum + (j.newCount ?? 0), 0);

    const avgLeadCost = tenant.avgLeadCost ? Number(tenant.avgLeadCost) : 0;
    const costPerConversion =
      convertedThisMonth > 0 ? (importedThisMonth * avgLeadCost) / convertedThisMonth : null;
    const conversionRate7d =
      leadsLast7Days > 0 ? convertedLast7Days / leadsLast7Days : 0;
    const conversionRateMonth =
      importedThisMonth > 0 ? convertedThisMonth / importedThisMonth : 0;

    const goalsWithProgress = await Promise.all(
      monthlyGoalsRaw.map(async (g) => {
        const current = await prisma.lead.count({
          where: {
            tenantId,
            softDeletedAt: null,
            closedReason: LeadClosedReason.CONVERTED,
            closedAt: { gte: monthStart, lt: monthEnd },
            ...(g.scope === GoalScope.OPERATOR && g.assigneeId
              ? { assigneeId: g.assigneeId }
              : {}),
          },
        });
        const target = g.targetConversions;
        const remaining = Math.max(0, target - current);
        const precoVenda = Number(g.precoVenda);
        const custoPorConversao = Number(g.custoPorConversao);
        const predicted = goalMetrics({
          precoVenda,
          conversoesAlvo: target,
          custoPorConversao,
        });
        const realized = goalMetrics({
          precoVenda,
          conversoesAlvo: current,
          custoPorConversao,
        });
        const remainingRevenue = precoVenda * remaining;
        return {
          id: g.id,
          name: g.name,
          target,
          current,
          remaining,
          progress: goalProgress(current, target),
          precoVenda,
          custoPorConversao,
          predicted,
          realized,
          remainingRevenue,
          scope: g.scope === GoalScope.COMPANY ? ("company" as const) : ("operator" as const),
          assigneeId: g.assigneeId,
          assignee: g.assignee
            ? { id: g.assignee.id, name: g.assignee.name, email: g.assignee.email }
            : null,
        };
      })
    );

    const companyGoals = goalsWithProgress.filter((g) => g.scope === "company");
    const operatorGoals = goalsWithProgress.filter((g) => g.scope === "operator");

    const selectedProgress =
      !forceCompanyView && selectedGoal
        ? goalsWithProgress.find((g) => g.id === selectedGoal.id) ?? null
        : companyGoals[0] ?? null;

    const bySegment = await prisma.lead.groupBy({
      by: ["segment"],
      where: {
        tenantId,
        softDeletedAt: null,
        closedReason: LeadClosedReason.CONVERTED,
        closedAt: { gte: monthStart, lt: monthEnd },
        ...leadScope,
      },
      _count: { _all: true },
    });

    const upcomingSchedules = await prisma.schedule.count({
      where: {
        tenantId,
        scheduledAt: { gte: now },
        ...(metricAssigneeId ? { lead: { assigneeId: metricAssigneeId } } : {}),
      },
    });

    const recentJobs = await prisma.scrapingJob.findMany({
      where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    // Prospecção do mês selecionado (amostragem a cada ~5 dias)
    const daysInMonth = new Date(year, month, 0).getDate();
    const [importedDaily, convertedDaily] = await Promise.all([
      prisma.lead.findMany({
        where: {
          tenantId,
          softDeletedAt: null,
          createdAt: { gte: monthStart, lt: monthEnd },
          ...leadScope,
        },
        select: { createdAt: true },
      }),
      prisma.lead.findMany({
        where: {
          tenantId,
          softDeletedAt: null,
          closedReason: LeadClosedReason.CONVERTED,
          closedAt: { gte: monthStart, lt: monthEnd },
          ...leadScope,
        },
        select: { closedAt: true },
      }),
    ]);

    const prospection30d: { day: string; imported: number; converted: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const key = localDayKey(d);
      const label = String(day).padStart(2, "0");
      const imported = importedDaily.filter((l) => localDayKey(l.createdAt) === key).length;
      const converted = convertedDaily.filter(
        (l) => l.closedAt && localDayKey(l.closedAt) === key
      ).length;
      if (day === 1 || day % 5 === 0 || day === daysInMonth) {
        prospection30d.push({ day: label, imported, converted });
      }
    }

    const selectedGoalId =
      forceCompanyView || !selectedGoal
        ? COMPANY_VIEW
        : selectedGoal.id;

    return res.json({
      metrics: {
        filter: {
          year,
          month,
          isCurrentMonth,
          label: monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        },
        credits: {
          remaining: tenant.creditRemaining,
          cap: tenant.creditCap,
          unlimited: tenant.unlimited,
          cycleEndsAt: tenant.cycleEndsAt?.toISOString() ?? null,
          state: tenant.unlimited
            ? "normal"
            : creditUiState(tenant.creditRemaining, tenant.creditCap),
        },
        scope: metricAssigneeId ? "operator" : "company",
        selectedGoalId,
        funnel,
        kpis: {
          conversionRate: isCurrentMonth ? conversionRate7d : conversionRateMonth,
          conversionRateMonth,
          costPerConversion,
          leadsLast7Days,
          convertedLast7Days,
          importedToday,
          convertedToday,
          capturesToday,
          leadsFoundToday,
          capturesMonth,
          leadsFoundMonth,
        },
        period: {
          importedLeads: importedThisMonth,
          conversions: convertedThisMonth,
          avgLeadCost,
          costPerConversion,
        },
        goal: selectedProgress
          ? {
              id: selectedProgress.id,
              name: selectedProgress.name,
              target: selectedProgress.target,
              current: selectedProgress.current,
              progress: selectedProgress.progress,
              scope: selectedProgress.scope,
              assigneeId: selectedProgress.assigneeId,
              assignee: selectedProgress.assignee,
            }
          : null,
        availableGoals: goalsWithProgress.map((g) => ({
          id: g.id,
          name: g.name,
          scope: g.scope,
          assigneeId: g.assigneeId,
          assignee: g.assignee,
          target: g.target,
          current: g.current,
          progress: g.progress,
        })),
        companyGoals,
        operatorGoals,
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
