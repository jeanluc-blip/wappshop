"use client";

import { memo } from "react";
import { PhotoGallery } from "@/components/storefront/PhotoGallery";
import { PriceLabel } from "@/components/storefront/PriceLabel";
import { ProductBadge } from "@/components/storefront/ProductBadge";
import { QuantityStepper } from "@/components/storefront/QuantityStepper";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/catalog";

type ProductCardProps = {
  product: Product;
  quantity: number;
  priority: boolean;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  onDecrement: (product: Product) => void;
};

/** Carte produit : galerie swipeable, nom, prix, et bouton « Ajouter au panier » (jamais un simple « + »). */
export const ProductCard = memo(function ProductCard({ product, quantity, priority, onOpen, onAdd, onDecrement }: ProductCardProps) {
  return (
    <li className="flex flex-col gap-1.5">
      {/* Un clic sur la photo ouvre la fiche (le doigt qui fait défiler ne déclenche pas de clic). */}
      <div onClick={() => onOpen(product)} className="cursor-pointer">
        <PhotoGallery
          images={product.images}
          alt={product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          overlay={<ProductBadge product={product} />}
        />
      </div>
      <button type="button" onClick={() => onOpen(product)} className="cursor-pointer text-left font-semibold leading-tight">
        {product.name}
      </button>
      <p className="text-[15px]">
        <PriceLabel price={product.price} oldPrice={product.oldPrice} promo={product.badge === "promo"} />
      </p>
      {product.soldOut ? (
        <Button type="button" variant="outline" size="full" disabled>
          Épuisé
        </Button>
      ) : quantity > 0 ? (
        <QuantityStepper
          quantity={quantity}
          label={product.name}
          onDecrement={() => onDecrement(product)}
          onIncrement={() => onAdd(product)}
        />
      ) : (
        <Button type="button" size="full" onClick={() => onAdd(product)}>
          Ajouter au panier
        </Button>
      )}
    </li>
  );
});
