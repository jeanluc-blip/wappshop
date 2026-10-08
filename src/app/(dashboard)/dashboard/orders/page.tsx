import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Commandes" };

// Phase 5 : l'onglet Commandes (liste, statuts) arrive avec le panier et la commande WhatsApp.
export default async function OrdersPage() {
  await requireShop();
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Commandes</h1>
      <Card>
        <p className="font-semibold">Bientôt disponible</p>
        <p className="mt-1 text-sm text-muted">
          Accès anticipé : préparez votre boutique, les commandes arrivent bientôt. Vous verrez ici les commandes de vos
          clients et pourrez suivre leur statut (nouvelle, confirmée, livrée).
        </p>
      </Card>
    </>
  );
}
