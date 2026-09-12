import nodemailer from "nodemailer";
import { logger } from "./logger";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "Orbixlead <noreply@orbixlead.local>";

const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);
const isProd = process.env.NODE_ENV === "production";

// OBS-01: em produção, SMTP é obrigatório. Sem ele, os fluxos de reset/convite
// dependeriam de logar o link (vazamento de token). Alertamos de forma explícita.
if (isProd && !hasSmtp) {
  logger.error("smtp_not_configured_in_production", {
    message:
      "SMTP ausente em produção: e-mails de reset/convite NÃO serão enviados e links não são logados. Configure SMTP_HOST/SMTP_USER/SMTP_PASS.",
  });
}

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
    // OBS-01: NUNCA logar o corpo do e-mail (contém links/tokens de reset/convite)
    // fora de desenvolvimento. Em dev, logamos o texto para facilitar o fluxo local.
    if (isProd) {
      logger.error("email_skipped_no_smtp", {
        to: payload.to,
        subject: payload.subject,
        note: "SMTP não configurado — e-mail NÃO enviado (link omitido do log).",
      });
    } else {
      logger.info("email_skipped_no_smtp", {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
    }
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
