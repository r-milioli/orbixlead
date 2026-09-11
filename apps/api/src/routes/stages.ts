import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

function serializeStage(s: {
  id: string;
  slug: string;
  label: string;
  position: number;
  archivedAt: Date | null;
}) {
  return {
    id: s.id,
    slug: s.slug,
    label: s.label,
    position: s.position,
    archivedAt: s.archivedAt?.toISOString() ?? null,
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const includeArchived = req.query.includeArchived === "1";
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: req.user!.tenantId!,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { position: "asc" },
    });
    return res.json({
      stages: stages.map(serializeStage),
    });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const tenantId = req.user!.tenantId!;

    const maxPos = await prisma.pipelineStage.aggregate({
      where: { tenantId, archivedAt: null },
      _max: { position: true },
    });

    const baseSlug = body.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    let slug = baseSlug || "stage";
    let attempt = 0;
    while (
      await prisma.pipelineStage.findFirst({
        where: { tenantId, slug },
      })
    ) {
      attempt += 1;
      slug = `${baseSlug || "stage"}_${attempt}`;
    }

    const stage = await prisma.pipelineStage.create({
      data: {
        tenantId,
        label: body.label.trim(),
        slug,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    return res.status(201).json({
      stage: serializeStage(stage),
    });
  })
);

router.patch(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        label: z.string().min(1).max(80).optional(),
        archived: z.boolean().optional(),
        moveToStageId: z.string().optional(),
      })
      .refine((data) => data.label !== undefined || data.archived !== undefined, {
        message: "Informe label e/ou archived",
      })
      .parse(req.body);

    const tenantId = req.user!.tenantId!;
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!stage) return res.status(404).json({ error: "Estágio não encontrado" });

    if (body.label !== undefined && body.archived === undefined) {
      const updated = await prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { label: body.label.trim() },
      });
      return res.json({ stage: serializeStage(updated) });
    }

    if (body.archived === false) {
      if (!stage.archivedAt) {
        return res.json({ stage: serializeStage(stage) });
      }
      const maxPos = await prisma.pipelineStage.aggregate({
        where: { tenantId, archivedAt: null },
        _max: { position: true },
      });
      const updated = await prisma.pipelineStage.update({
        where: { id: stage.id },
        data: {
          archivedAt: null,
          ...(body.label ? { label: body.label.trim() } : {}),
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
      return res.json({ stage: serializeStage(updated) });
    }

    if (body.archived === true) {
      if (stage.archivedAt) {
        return res.json({ stage: serializeStage(stage) });
      }
      if (stage.slug === "new") {
        return res.status(400).json({
          error: "O estágio inicial (Novos) não pode ser arquivado.",
        });
      }

      const activeCount = await prisma.pipelineStage.count({
        where: { tenantId, archivedAt: null },
      });
      if (activeCount <= 1) {
        return res.status(400).json({
          error: "É necessário manter ao menos um estágio ativo no pipeline.",
        });
      }

      const leadCount = await prisma.lead.count({
        where: { tenantId, stageId: stage.id, softDeletedAt: null },
      });

      if (leadCount > 0) {
        if (!body.moveToStageId) {
          return res.status(400).json({
            error: "Este estágio possui leads. Informe moveToStageId para movê-los.",
            leadCount,
          });
        }
        const target = await prisma.pipelineStage.findFirst({
          where: {
            id: body.moveToStageId,
            tenantId,
            archivedAt: null,
          },
        });
        if (!target || target.id === stage.id) {
          return res.status(400).json({ error: "Estágio de destino inválido" });
        }

        await prisma.$transaction([
          prisma.lead.updateMany({
            where: { tenantId, stageId: stage.id, softDeletedAt: null },
            data: { stageId: target.id },
          }),
          prisma.pipelineStage.update({
            where: { id: stage.id },
            data: {
              archivedAt: new Date(),
              ...(body.label ? { label: body.label.trim() } : {}),
            },
          }),
        ]);
      } else {
        await prisma.pipelineStage.update({
          where: { id: stage.id },
          data: {
            archivedAt: new Date(),
            ...(body.label ? { label: body.label.trim() } : {}),
          },
        });
      }

      const updated = await prisma.pipelineStage.findUniqueOrThrow({
        where: { id: stage.id },
      });
      return res.json({ stage: serializeStage(updated) });
    }

    return res.status(400).json({ error: "Nada a atualizar" });
  })
);

router.put(
  "/reorder",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        orderedIds: z.array(z.string()).min(1),
      })
      .parse(req.body);

    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId: req.user!.tenantId!, archivedAt: null },
    });
    const ids = new Set(stages.map((s) => s.id));
    if (body.orderedIds.length !== stages.length || body.orderedIds.some((id) => !ids.has(id))) {
      return res.status(400).json({ error: "Lista de estágios inválida" });
    }

    await prisma.$transaction(
      body.orderedIds.map((id, position) =>
        prisma.pipelineStage.update({ where: { id }, data: { position } })
      )
    );

    const updated = await prisma.pipelineStage.findMany({
      where: { tenantId: req.user!.tenantId!, archivedAt: null },
      orderBy: { position: "asc" },
    });

    return res.json({
      stages: updated.map(serializeStage),
    });
  })
);

export default router;
