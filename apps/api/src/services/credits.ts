import { CreditLedgerType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function grantPackage(params: {
  tenantId: string;
  amount: number;
  createdById?: string;
  note?: string;
}) {
  const cycleEndsAt = new Date();
  cycleEndsAt.setDate(cycleEndsAt.getDate() + 30);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: params.tenantId },
      data: {
        creditCap: params.amount,
        creditRemaining: params.amount,
        cycleEndsAt,
      },
    });

    await tx.creditLedger.create({
      data: {
        tenantId: params.tenantId,
        type: CreditLedgerType.GRANT,
        amount: params.amount,
        balanceAfter: params.amount,
        createdById: params.createdById,
        note: params.note ?? `Pacote ${params.amount}`,
      },
    });

    return tenant;
  });
}

export async function reserve(params: {
  tenantId: string;
  amount: number;
  jobId?: string;
  createdById?: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });

    if (!tenant.unlimited) {
      if (tenant.creditRemaining < params.amount) {
        throw Object.assign(new Error("Créditos insuficientes"), { status: 400 });
      }
    }

    const updated = tenant.unlimited
      ? tenant
      : await tx.tenant.update({
          where: { id: params.tenantId },
          data: { creditRemaining: { decrement: params.amount } },
        });

    await tx.creditLedger.create({
      data: {
        tenantId: params.tenantId,
        type: CreditLedgerType.RESERVE,
        amount: params.amount,
        balanceAfter: tenant.unlimited ? null : updated.creditRemaining,
        jobId: params.jobId,
        createdById: params.createdById,
        note: params.note,
      },
    });

    return updated;
  });
}

export async function settle(params: {
  tenantId: string;
  amount: number;
  jobId?: string;
  createdById?: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });

    await tx.creditLedger.create({
      data: {
        tenantId: params.tenantId,
        type: CreditLedgerType.SETTLE,
        amount: params.amount,
        balanceAfter: tenant.unlimited ? null : tenant.creditRemaining,
        jobId: params.jobId,
        createdById: params.createdById,
        note: params.note,
      },
    });

    return tenant;
  });
}

export async function releaseReservation(params: {
  tenantId: string;
  amount: number;
  jobId?: string;
  createdById?: string;
  note?: string;
}) {
  if (params.amount <= 0) {
    return prisma.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });
  }

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });

    const updated = tenant.unlimited
      ? tenant
      : await tx.tenant.update({
          where: { id: params.tenantId },
          data: { creditRemaining: { increment: params.amount } },
        });

    await tx.creditLedger.create({
      data: {
        tenantId: params.tenantId,
        type: CreditLedgerType.RELEASE,
        amount: params.amount,
        balanceAfter: tenant.unlimited ? null : updated.creditRemaining,
        jobId: params.jobId,
        createdById: params.createdById,
        note: params.note,
      },
    });

    return updated;
  });
}

export async function adjustCredits(params: {
  tenantId: string;
  amount: number;
  createdById?: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: params.tenantId },
      data: { creditRemaining: { increment: params.amount } },
    });

    await tx.creditLedger.create({
      data: {
        tenantId: params.tenantId,
        type: CreditLedgerType.ADJUST,
        amount: params.amount,
        balanceAfter: tenant.creditRemaining,
        createdById: params.createdById,
        note: params.note,
      },
    });

    return tenant;
  });
}

export type { Prisma };
