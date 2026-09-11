import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERADOR));

function serialize(n: {
  id: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "all";
    const takeRaw = Number(req.query.take);
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100;

    const where = {
      userId: req.user!.id,
      ...(status === "unread"
        ? { readAt: null }
        : status === "read"
          ? { readAt: { not: null } }
          : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, readAt: null },
      }),
    ]);

    return res.json({
      notifications: notifications.map(serialize),
      unreadCount,
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
      notification: serialize(updated),
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
