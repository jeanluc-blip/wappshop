"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

// Erreur imprévue sur une page : message en français, jamais de détail technique affiché.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <Logo size={64} className="mb-4" />
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-muted">Ce n&apos;est pas de votre faute. Réessayez dans un instant.</p>
      <Button type="button" className="mt-6" onClick={reset}>
        Réessayer
      </Button>
      <Button asChild variant="ghost" className="mt-2">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
