// Endurecimiento de auth (spec 14): mensaje de error genérico para no filtrar
// el texto crudo de Supabase (enumeración de usuarios, detalles internos) a la UI.

export const GENERIC_AUTH_ERROR =
  "No pudimos completar la operación. Revisa los datos e inténtalo de nuevo.";

/**
 * Loguea `error` completo con `console.error` (para no perder el detalle en
 * el log del servidor/consola) y siempre devuelve `GENERIC_AUTH_ERROR`.
 */
export function getAuthErrorMessage(error: unknown): string {
  console.error(error);
  return GENERIC_AUTH_ERROR;
}
