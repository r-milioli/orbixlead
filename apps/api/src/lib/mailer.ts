import nodemailer from "nodemailer";
import { logger } from "./logger";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "Orbixlead <noreply@orbixlead.local>";

const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
  : null;

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!transporter) {
    logger.info("email_skipped_no_smtp", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? `<pre>${payload.text}</pre>`,
    });
  } catch (err) {
    logger.error("email_failed", {
      to: payload.to,
      subject: payload.subject,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export function webUrl(path: string): string {
  const origin = process.env.WEB_ORIGIN || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
