/**
 * Extrai a mensagem real de um erro desconhecido. Erros do Supabase/PostgREST
 * às vezes são objetos simples (não `instanceof Error`) — sem isso, a UI
 * mostrava só um fallback genérico e escondia a causa.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  const msg = (e as { message?: unknown } | null)?.message;
  return typeof msg === 'string' && msg.length > 0 ? msg : fallback;
}
