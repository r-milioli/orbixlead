import session, { type SessionData } from "express-session";
import { prisma } from "./prisma";

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
