// Checklist de seguridad básica (spec 13): validación de complejidad de contraseña
// en el cliente, antes de enviarla a Supabase Auth (signup / reset-password).

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Devuelve `null` si `pass` cumple la regex de complejidad, o un mensaje de
 * error en español si no.
 */
export function validatePassword(pass: string): string | null {
  if (!PASSWORD_REGEX.test(pass)) {
    return "La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.";
  }
  return null;
}
