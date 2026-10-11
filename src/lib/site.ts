/**
 * Adresse publique de l'application, sans « / » final.
 * Priorité : NEXT_PUBLIC_APP_URL si elle est renseignée avec une vraie adresse. Si elle est absente, ou si elle vaut encore
 * « localhost » alors que le site tourne sur Vercel, on utilise l'adresse de production fournie automatiquement par Vercel :
 * ainsi le lien de la boutique, le QR code et les liens de partage ne pointent jamais vers une adresse inaccessible aux clients.
 */
export function getAppUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  if (configured && !(isLocal && process.env.VERCEL)) return configured;

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return configured || "http://localhost:3000";
}

/** Lien complet d'une boutique : https://wappshop.app/{slug}. */
export function shopUrl(slug: string): string {
  return `${getAppUrl()}/${slug}`;
}

/** Forme courte affichée à l'écran : wappshop.app/{slug}. */
export function shopAddress(slug: string): string {
  try {
    return `${new URL(getAppUrl()).host}/${slug}`;
  } catch {
    return `/${slug}`;
  }
}
