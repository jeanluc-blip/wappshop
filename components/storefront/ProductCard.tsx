"use client";

import { memo } from "react";
import { ShoppingCart } from "lucide-react";
import { PhotoGallery } from "@/components/storefront/PhotoGallery";
import { PriceLabel } from "@/components/storefront/PriceLabel";
import { ProductBadge } from "@/components/storefront/ProductBadge";
import { QuantityStepper } from "@/components/storefront/QuantityStepper";
import type { Product } from "@/lib/catalog";

type ProductCardProps = {
  product: Product;
  quantity: number;
  priority: boolean;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  onDecrement: (product: Product) => void;
  className?: string;
};

/** Carte produit : galerie swipeable, nom, prix et petit bouton rond panier (la quantité apparaît une fois ajouté). */
export const ProductCard = memo(function ProductCard({ product, quantity, priority, onOpen, onAdd, onDecrement, className = "" }: ProductCardProps) {
  return (
    <li className={`flex flex-col gap-1.5 ${className}`}>
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
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[15px]">
          <PriceLabel price={product.price} oldPrice={product.oldPrice} promo={product.badge === "promo"} />
        </p>
        {!product.soldOut && quantity === 0 && (
          <button
            type="button"
            onClick={() => onAdd(product)}
            aria-label={`Ajouter ${product.name} au panier`}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-on-brand hover:bg-brand-hover"
          >
            <ShoppingCart size={20} aria-hidden="true" />
          </button>
        )}
        {product.soldOut && <span className="shrink-0 rounded-full bg-border px-3 py-1 text-xs font-semibold">Épuisé</span>}
      </div>
      {!product.soldOut && quantity > 0 && (
        <QuantityStepper
          quantity={quantity}
          label={product.name}
          onDecrement={() => onDecrement(product)}
          onIncrement={() => onAdd(product)}
        />
      )}
    </li>
  );
});
