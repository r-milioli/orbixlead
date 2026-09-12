import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Invite, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendMail, webUrl } from "../lib/mailer";
import { asyncHandler, roleFromApi, serializeUser } from "../lib/serialize";
import { AuthedRequest, requireAuth, requireRole, requireTenant } from "../middleware/auth";
import { sensitiveAuthLimiter } from "../middleware/rate-limit";

const router = Router();

router.use(requireAuth, requireTenant, requireRole(Role.ADMIN));

const inviteRoleSchema = z.enum(["admin", "operador"]);

function serializeInvite(invite: Invite) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role === Role.ADMIN ? ("admin" as const) : ("operador" as const),
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  };
}

function inviteExpiryDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

async function sendInviteEmail(email: string, roleLabel: string, token: string) {
  const link = webUrl(`/convite/${token}`);
  await sendMail({
    to: email,
    subject: "Convite Orbixlead",
    text: `Você foi convidado para o Orbixlead como ${roleLabel}.\nAceite em:\n${link}`,
  });
}

async function findPendingInvite(tenantId: string, inviteId: string) {
  return prisma.invite.findFirst({
    where: { id: inviteId, tenantId, acceptedAt: null },
  });
}

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
      invites: invites.map(serializeInvite),
    });
  })
);

router.post(
  "/invite",
  sensitiveAuthLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        email: z.string().email(),
        role: inviteRoleSchema,
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

    const pending = await prisma.invite.findFirst({
      where: { tenantId: req.user!.tenantId!, email, acceptedAt: null },
    });
    if (pending) {
      return res.status(400).json({
        error: "Já existe um convite pendente para este e-mail. Reenvie ou revogue o atual.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const invite = await prisma.invite.create({
      data: {
        email,
        role,
        token,
        tenantId: req.user!.tenantId!,
        invitedById: req.user!.id,
        expiresAt: inviteExpiryDate(),
      },
    });

    await sendInviteEmail(email, body.role, token);

    return res.status(201).json({ invite: serializeInvite(invite) });
  })
);

router.patch(
  "/invites/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z
      .object({
        role: inviteRoleSchema,
      })
      .parse(req.body);

    const role = roleFromApi[body.role];
    if (!role || role === Role.SUPER_ADMIN) {
      return res.status(400).json({ error: "Papel inválido" });
    }

    const existing = await findPendingInvite(req.user!.tenantId!, req.params.id);
    if (!existing) return res.status(404).json({ error: "Convite não encontrado" });

    const invite = await prisma.invite.update({
      where: { id: existing.id },
      data: { role },
    });

    return res.json({ invite: serializeInvite(invite) });
  })
);

router.post(
  "/invites/:id/resend",
  sensitiveAuthLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await findPendingInvite(req.user!.tenantId!, req.params.id);
    if (!existing) return res.status(404).json({ error: "Convite não encontrado" });

    const token = crypto.randomBytes(32).toString("hex");
    const invite = await prisma.invite.update({
      where: { id: existing.id },
      data: {
        token,
        expiresAt: inviteExpiryDate(),
      },
    });

    const roleLabel = invite.role === Role.ADMIN ? "admin" : "operador";
    await sendInviteEmail(invite.email, roleLabel, token);

    return res.json({ invite: serializeInvite(invite) });
  })
);

router.delete(
  "/invites/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await findPendingInvite(req.user!.tenantId!, req.params.id);
    if (!existing) return res.status(404).json({ error: "Convite não encontrado" });

    await prisma.invite.delete({ where: { id: existing.id } });
    return res.status(204).send();
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

export default router;
