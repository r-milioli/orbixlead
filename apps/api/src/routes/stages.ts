import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId: req.user!.tenantId! },
      orderBy: { position: "asc" },
    });
    return res.json({
      stages: stages.map((s) => ({
        id: s.id,
        slug: s.slug,
        label: s.label,
        position: s.position,
      })),
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
      where: { tenantId },
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
      stage: {
        id: stage.id,
        slug: stage.slug,
        label: stage.label,
        position: stage.position,
      },
    });
  })
);

router.patch(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!stage) return res.status(404).json({ error: "Estágio não encontrado" });

    const updated = await prisma.pipelineStage.update({
      where: { id: stage.id },
      data: { label: body.label },
    });
    return res.json({
      stage: {
        id: updated.id,
        slug: updated.slug,
        label: updated.label,
        position: updated.position,
      },
    });
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
      where: { tenantId: req.user!.tenantId! },
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
      where: { tenantId: req.user!.tenantId! },
      orderBy: { position: "asc" },
    });

    return res.json({
      stages: updated.map((s) => ({
        id: s.id,
        slug: s.slug,
        label: s.label,
        position: s.position,
      })),
    });
  })
);

export default router;
