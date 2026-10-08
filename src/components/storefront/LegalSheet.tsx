import type { ShopPublic } from "@/lib/catalog";

// Modèle de mentions légales : à faire relire par un juriste du pays avant le lancement (voir LANCEMENT.md).
export function LegalSheetBody({ shop }: { shop: ShopPublic }) {
  return (
    <div className="space-y-3 text-[15px] text-muted">
      <p>
        <b className="text-foreground">Éditeur de la boutique :</b> {shop.name}. Les commandes sont finalisées
        directement avec le vendeur par WhatsApp. WappShop fournit uniquement l&apos;outil de catalogue et ne vend pas les
        produits.
      </p>
      <p>
        <b className="text-foreground">Prix, livraison et paiement :</b> ils sont fixés par le vendeur. Le paiement et la
        livraison se règlent entre le vendeur et vous ; aucun paiement n&apos;est effectué sur ce site.
      </p>
      <p>
        <b className="text-foreground">Données personnelles :</b> votre panier reste sur votre appareil. Les visites de la
        boutique sont comptées de façon anonyme, sans cookie de suivi et sans donnée personnelle. Lorsque vous enverrez une
        commande, votre nom, votre adresse de livraison et le contenu de la commande seront transmis au vendeur pour la
        traiter. Vous pouvez lui demander de les supprimer.
      </p>
      <p>
        <b className="text-foreground">Contact :</b> écrivez au vendeur via le bouton WhatsApp « Poser une question ».
      </p>
    </div>
  );
}
