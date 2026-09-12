import fs from "fs";

/**
 * Suporte ao padrão "_FILE" para Docker Secrets (CONF-01).
 *
 * Para cada variável sensível, se existir `<NOME>_FILE` apontando para um arquivo
 * (ex.: /run/secrets/session_secret), o conteúdo do arquivo é carregado em
 * `process.env[<NOME>]`. Isso permite injetar segredos via Docker Secrets sem
 * colocá-los em texto puro no docker-stack.yml.
 *
 * Deve ser chamada ANTES de qualquer código que leia esses segredos
 * (PrismaClient, express-session, etc.). É idempotente.
 */

const SECRET_ENV_NAMES = [
  "SESSION_SECRET",
  "INTERNAL_API_KEY",
  "DATABASE_URL",
  "SMTP_PASS",
  "SUPER_ADMIN_PASSWORD",
];

let loaded = false;

export function loadSecretsFromFiles(): void {
  if (loaded) return;
  loaded = true;

  for (const name of SECRET_ENV_NAMES) {
    const filePath = process.env[`${name}_FILE`];
    if (!filePath) continue;
    // Só carrega do arquivo se a variável direta ainda não estiver definida.
    if (process.env[name]) continue;
    try {
      const value = fs.readFileSync(filePath, "utf8").trim();
      if (value) {
        process.env[name] = value;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[secrets] Falha ao ler ${name}_FILE: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
