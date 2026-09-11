import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERADOR));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req: AuthedRequest, res) => {
    const n = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!n) return res.status(404).json({ error: "Notificação não encontrada" });

    const updated = await prisma.notification.update({
      where: { id: n.id },
      data: { readAt: n.readAt ?? new Date() },
    });
    return res.json({
      notification: {
        id: updated.id,
        title: updated.title,
        body: updated.body,
        readAt: updated.readAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    return res.json({ ok: true });
  })
);

export default router;
