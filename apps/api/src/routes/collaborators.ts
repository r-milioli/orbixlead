import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendMail, webUrl } from "../lib/mailer";
import { asyncHandler, roleFromApi, serializeUser } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const users = await prisma.user.findMany({
      where: { tenantId: req.user!.tenantId! },
      orderBy: { createdAt: "asc" },
    });
    const invites = await prisma.invite.findMany({
      where: { tenantId: req.user!.tenantId!, acceptedAt: null },
      orderBy: { expiresAt: "desc" },
    });
    return res.json({
      users: users.map(serializeUser),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role === Role.ADMIN ? "admin" : "operador",
        expiresAt: i.expiresAt.toISOString(),
        acceptedAt: i.acceptedAt?.toISOString() ?? null,
      })),
    });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        canCapture: z.boolean().optional(),
      })
      .parse(req.body);

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId! },
    });
    if (!target) return res.status(404).json({ error: "Colaborador não encontrado" });

    if (body.canCapture !== undefined && target.role !== Role.OPERADOR) {
      return res.status(400).json({ error: "Permissão de captura só se aplica a operadores" });
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(body.canCapture !== undefined ? { canCapture: body.canCapture } : {}),
      },
    });

    return res.json({ user: serializeUser(user) });
  })
);

router.post(
  "/invite",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "operador"]),
      })
      .parse(req.body);

    const role = roleFromApi[body.role];
    if (!role || role === Role.SUPER_ADMIN) {
      return res.status(400).json({ error: "Papel inválido" });
    }

    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.tenantId === req.user!.tenantId) {
      return res.status(400).json({ error: "Usuário já faz parte do tenant" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        email,
        role,
        token,
        tenantId: req.user!.tenantId!,
        invitedById: req.user!.id,
        expiresAt,
      },
    });

    const link = webUrl(`/convite/${token}`);
    await sendMail({
      to: email,
      subject: "Convite Orbixlead",
      text: `Você foi convidado para o Orbixlead como ${body.role}.\nAceite em:\n${link}`,
    });

    return res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: body.role,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  })
);

export default router;
