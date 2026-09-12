import session, { type SessionData } from "express-session";
import { prisma } from "./prisma";

/**
 * SEC-08: invalida (apaga) todas as sessões de um usuário, opcionalmente
 * preservando a sessão atual (`exceptSid`). Usado ao trocar/redefinir senha.
 *
 * As sessões são gravadas como JSON contendo `userId`; filtramos por `contains`.
 * O `userId` é um identificador opaco (cuid), então o match é seguro.
 */
export async function destroyUserSessions(userId: string, exceptSid?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      data: { contains: `"userId":"${userId}"` },
      ...(exceptSid ? { sid: { not: exceptSid } } : {}),
    },
  });
  return result.count;
}

export class PrismaSessionStore extends session.Store {
  get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    prisma.session
      .findUnique({ where: { sid } })
      .then(async (row) => {
        if (!row) return callback(null, null);
        if (row.expiresAt.getTime() <= Date.now()) {
          await prisma.session.delete({ where: { sid } }).catch(() => undefined);
          return callback(null, null);
        }
        const data = JSON.parse(row.data) as SessionData;
        return callback(null, data);
      })
      .catch((err) => callback(err));
  }

  set(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const data = JSON.stringify(sessionData);
    prisma.session
      .upsert({
        where: { sid },
        create: { sid, data, expiresAt },
        update: { data, expiresAt },
      })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    prisma.session
      .delete({ where: { sid } })
      .catch(() => undefined)
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  touch(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    prisma.session
      .update({
        where: { sid },
        data: { expiresAt },
      })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }
}
