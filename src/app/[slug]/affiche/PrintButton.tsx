"use client";

import { Button } from "@/components/ui/button";

/** Lance l'impression du navigateur (l'affiche est la seule chose imprimée : le bouton se masque à l'impression). */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Imprimer l&apos;affiche
    </Button>
  );
}
