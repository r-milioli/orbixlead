import { PIPELINE_DEFAULT } from "@orbixlead/shared";
import { prisma } from "../lib/prisma";

export async function createTenantWithDefaults(params: {
  name: string;
  unlimited?: boolean;
  creditCap?: number;
  creditRemaining?: number;
  cycleEndsAt?: Date | null;
  avgLeadCost?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: params.name,
        unlimited: params.unlimited ?? false,
        creditCap: params.creditCap ?? 0,
        creditRemaining: params.creditRemaining ?? 0,
        cycleEndsAt: params.cycleEndsAt ?? null,
        avgLeadCost: params.avgLeadCost ?? null,
        pipelineStages: {
          create: PIPELINE_DEFAULT.map((s) => ({
            slug: s.slug,
            label: s.label,
            position: s.position,
          })),
        },
      },
      include: { pipelineStages: { orderBy: { position: "asc" } } },
    });

    return tenant;
  });
}
