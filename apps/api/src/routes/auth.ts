import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendMail, webUrl } from "../lib/mailer";
import { asyncHandler, serializeUser } from "../lib/serialize";
import { AuthedRequest, mePayload, requireAuth } from "../middleware/auth";
import {
  createFirstSuperAdmin,
  hasSuperAdmin,
  SuperAdminSetupError,
} from "../lib/bootstrap-super-admin";
import { loginLimiter, sensitiveAuthLimiter } from "../middleware/rate-limit";
import { destroyUserSessions } from "../lib/session-store";
import { passwordSchema } from "../lib/validators";

const router = Router();

/**
 * SEC-06: regenera o ID de sessão antes de autenticar (mitiga session fixation)
 * e grava o userId na nova sessão.
 */
async function establishSession(req: AuthedRequest, userId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = userId;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

router.get(
  "/setup-status",
  asyncHandler(async (_req, res) => {
    return res.json({ needsSetup: !(await hasSuperAdmin()) });
  })
);

router.post(
  "/setup",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        password: passwordSchema,
      })
      .parse(req.body);

    try {
      const user = await createFirstSuperAdmin(body);
      await establishSession(req, user.id);
      return res.status(201).json({ user: serializeUser(user) });
    } catch (err) {
      if (err instanceof SuperAdminSetupError) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  })
);

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user?.passwordHash) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    await establishSession(req, user.id);
    return res.json({ user: serializeUser(user) });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.clearCookie("orbixlead.sid");
    return res.json({ ok: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    return res.json(await mePayload(req));
  })
);

router.post(
  "/forgot-password",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    // Always return ok to avoid email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      const link = webUrl(`/redefinir-senha/${token}`);
      await sendMail({
        to: user.email,
        subject: "Redefinir senha — Orbixlead",
        text: `Use este link para redefinir sua senha (válido por 1h):\n${link}`,
      });
    }

    // SEC-11: pequeno jitter para reduzir enumeração por timing (usuário existe vs não).
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.floor(Math.random() * 150)));

    return res.json({ ok: true });
  })
);

router.post(
  "/reset-password",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(10),
        password: passwordSchema,
      })
      .parse(req.body);

    const reset = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // SEC-08: após redefinir a senha, invalida todas as sessões ativas do usuário.
    await destroyUserSessions(reset.userId);

    return res.json({ ok: true });
  })
);

router.post(
  "/accept-invite",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(10),
        name: z.string().min(2),
        password: passwordSchema,
      })
      .parse(req.body);

    const invite = await prisma.invite.findUnique({ where: { token: body.token } });
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Convite inválido ou expirado" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const existing = await prisma.user.findUnique({ where: { email: invite.email.toLowerCase() } });

    const user = await prisma.$transaction(async (tx) => {
      let createdOrUpdated;
      if (existing) {
        createdOrUpdated = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            passwordHash,
            role: invite.role,
            tenantId: invite.tenantId,
          },
        });
      } else {
        createdOrUpdated = await tx.user.create({
          data: {
            email: invite.email.toLowerCase(),
            name: body.name,
            passwordHash,
            role: invite.role,
            tenantId: invite.tenantId,
          },
        });
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      const admins = await tx.user.findMany({
        where: { tenantId: invite.tenantId, role: Role.ADMIN },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: "Convite aceito",
            body: `${body.name} (${invite.email}) aceitou o convite.`,
          })),
        });
      }

      return createdOrUpdated;
    });

    await establishSession(req, user.id);
    return res.json({ user: serializeUser(user) });
  })
);

export default router;
