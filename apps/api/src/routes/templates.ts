import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN, Role.OPERADOR));

function serializeTemplate(t: {
  id: string;
  name: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    body: t.body,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const templates = await prisma.messageTemplate.findMany({
      where: { tenantId: req.user!.tenantId! },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ templates: templates.map(serializeTemplate) });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        body: z.string().min(1),
      })
      .parse(req.body);

    const template = await prisma.messageTemplate.create({
      data: {
        tenantId: req.user!.tenantId!,
        name: body.name,
        body: body.body,
      },
    });
    return res.status(201).json({ template: serializeTemplate(template) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado" });
    return res.json({ template: serializeTemplate(template) });
  })
);

router.patch(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
      })
      .parse(req.body);

    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado" });

    const template = await prisma.messageTemplate.update({
      where: { id: existing.id },
      data: body,
    });
    return res.json({ template: serializeTemplate(template) });
  })
);

router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado" });
    await prisma.messageTemplate.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  })
);

export default router;
