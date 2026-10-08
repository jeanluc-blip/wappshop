/** Résultat standard des actions serveur : un message d'erreur en français, jamais d'exception brute. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; field?: string };

export const GENERIC_ERROR = "Une erreur est survenue. Vérifiez votre connexion et réessayez.";

export function fail(error: string, field?: string): { ok: false; error: string; field?: string } {
  return { ok: false, error, field };
}
