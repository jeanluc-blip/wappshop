"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

// Erreur inattendue : message en français et possibilité de réessayer (jamais de détail technique affiché).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <Logo size={64} className="mb-4" />
      <h1 className="text-xl font-bold">Un problème est survenu</h1>
      <p className="mt-2 text-muted">La page n&apos;a pas pu s&apos;afficher. Vérifiez votre connexion puis réessayez.</p>
      {/* En développement uniquement : la vraie cause, pour la copier et la corriger. */}
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-left text-xs text-danger">
          {error.message}
        </pre>
      )}
      <Button type="button" className="mt-6" onClick={reset}>
        Réessayer
      </Button>
    </main>
  );
}
