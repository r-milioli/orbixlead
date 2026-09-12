import { z } from "zod";

/**
 * DATA-01: política de senha para NOVAS senhas (criação/redefinição/troca).
 * - mínimo de 10 caracteres
 * - pelo menos uma letra e um número
 *
 * Não se aplica ao campo de senha do login (que apenas verifica a existente).
 */
export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter no mínimo 10 caracteres")
  .max(128, "A senha é muito longa")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "A senha deve conter pelo menos uma letra e um número",
  });
