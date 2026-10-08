import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Statistiques" };

// Phase 6 : visiteurs, commandes envoyées et livrées, conversion, avis.
export default async function StatsPage() {
  await requireShop();
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Statistiques</h1>
      <Card>
        <p className="font-semibold">Bientôt disponible</p>
        <p className="mt-1 text-sm text-muted">
          Vous verrez ici le nombre de visiteurs de votre boutique, vos commandes et vos avis clients. Les visites sont
          déjà comptées de façon anonyme dès l&apos;ouverture de votre boutique.
        </p>
      </Card>
    </>
  );
}
