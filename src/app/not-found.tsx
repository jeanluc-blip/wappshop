import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

// Page 404 en français, fond blanc (remplace la page par défaut de Next.js qui passe en noir en mode sombre).
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <Logo size={64} className="mb-4" />
      <h1 className="text-xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted">Cette adresse n&apos;existe pas ou a été déplacée.</p>
      <Button asChild className="mt-6">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
