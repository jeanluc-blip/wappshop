import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// Espace administrateur : réservé aux adresses email listées dans la variable ADMIN_EMAILS (séparées par des virgules).
// L'email d'un compte est vérifié à la connexion (code envoyé par email ou compte Google) : il ne peut pas être usurpé.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes((email as string).toLowerCase());
}

/** Administrateur connecté, ou null. */
export async function getAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && isAdminEmail(user.email) ? user : null;
}

/** Pages admin : non connecté -> connexion ; connecté mais pas administrateur -> page introuvable (on ne révèle pas que l'espace existe). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) notFound();
  return user;
}
