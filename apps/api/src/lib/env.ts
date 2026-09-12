import { logger } from "./logger";

/**
 * Validação de variáveis de ambiente sensíveis.
 *
 * Em produção (NODE_ENV=production) o processo FALHA o boot se um segredo
 * obrigatório estiver ausente, curto demais ou igual a um valor default/placeholder
 * conhecido. Isso evita subir a aplicação com segredo previsível (SEC-02 / CONF-01).
 *
 * Em desenvolvimento apenas emite avisos, para não travar o fluxo local.
 */

const MIN_SECRET_LENGTH = 32;

/** Valores default/placeholder que NUNCA podem ir para produção. */
const FORBIDDEN_SECRET_VALUES = new Set(
  [
    "dev-orbixlead-session-secret-change-me",
    "change-me-orbixlead-dev-secret-min-32-chars",
    "altere-para-um-segredo-aleatorio-com-no-minimo-32-chars",
    "orbixlead-internal-dev-key",
    "altere-esta-chave-interna",
    "ALTERE_A_SENHA",
  ].map((v) => v.toLowerCase())
);

type SecretRule = {
  name: string;
  /** Comprimento mínimo exigido (default: MIN_SECRET_LENGTH). */
  minLength?: number;
};

const REQUIRED_SECRETS: SecretRule[] = [
  { name: "SESSION_SECRET" },
  { name: "INTERNAL_API_KEY", minLength: 16 },
  { name: "DATABASE_URL", minLength: 1 },
];

function validateSecret(rule: SecretRule): string[] {
  const errors: string[] = [];
  const raw = process.env[rule.name];
  const value = (raw ?? "").trim();
  const minLength = rule.minLength ?? MIN_SECRET_LENGTH;

  if (!value) {
    errors.push(`${rule.name} não definido`);
    return errors;
  }
  if (value.length < minLength) {
    errors.push(`${rule.name} muito curto (mínimo ${minLength} caracteres)`);
  }
  if (FORBIDDEN_SECRET_VALUES.has(value.toLowerCase())) {
    errors.push(`${rule.name} está usando um valor default/placeholder — gere um segredo forte`);
  }
  // Placeholders genéricos (ex.: DATABASE_URL contendo ALTERE_A_SENHA).
  if (/altere|change-me|change_me|placeholder|troque/i.test(value)) {
    errors.push(`${rule.name} contém placeholder ("altere/change-me") — substitua por valor real`);
  }
  return errors;
}

/**
 * Executa a validação. Em produção, encerra o processo se houver erros.
 * Deve ser chamada logo no início do boot da API.
 */
export function assertProductionSecrets(): void {
  const isProd = process.env.NODE_ENV === "production";
  const errors = REQUIRED_SECRETS.flatMap(validateSecret);

  if (errors.length === 0) {
    return;
  }

  if (isProd) {
    logger.error("env_validation_failed", { errors });
    // eslint-disable-next-line no-console
    console.error(
      `\n[FATAL] Configuração de segredos inválida para produção:\n` +
        errors.map((e) => `  - ${e}`).join("\n") +
        `\n\nGere segredos fortes (ex.: \`openssl rand -hex 32\`) e defina as variáveis antes de subir.\n`
    );
    process.exit(1);
  }

  logger.warn("env_validation_warnings", {
    note: "Segredos fracos/ausentes são tolerados apenas fora de produção",
    errors,
  });
}
