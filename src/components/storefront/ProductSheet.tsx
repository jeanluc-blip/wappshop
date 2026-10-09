"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PhotoGallery } from "@/components/storefront/PhotoGallery";
import { PriceLabel } from "@/components/storefront/PriceLabel";
import { ProductBadge } from "@/components/storefront/ProductBadge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { groupVariants, unitPrice, type Product, type Selection } from "@/lib/catalog";
import { copyText } from "@/lib/clipboard";
import { formatPrice } from "@/lib/format";

type ProductSheetBodyProps = {
  product: Product;
  /** Adresse de la boutique : sert à construire le lien direct vers le produit. */
  shopSlug: string;
  /** « detail » : fiche produit avec galerie ; « variants » : seulement le choix de variantes. */
  mode: "detail" | "variants";
  onAdd: (selection: Selection) => void;
};

/** Contenu de la fiche produit / du choix de variantes (remonté à chaque produit : le choix repart de zéro). */
export function ProductSheetBody({ product, shopSlug, mode, onAdd }: ProductSheetBodyProps) {
  const [selection, setSelection] = useState<Selection>({});
  const groups = groupVariants(product.variants);
  const missing = groups.filter((group) => !selection[group.name]).map((group) => group.name);
  const price = unitPrice(product, selection);

  async function copyProductLink() {
    const link = `${window.location.origin}/${shopSlug}/${product.id}`;
    if (await copyText(link)) {
      toast.success("Lien du produit copié");
    } else {
      window.prompt("Copiez ce lien :", link);
    }
  }

  return (
    <div>
      {mode === "detail" && (
        <div className="mb-3">
          <PhotoGallery
            images={product.images}
            alt={product.name}
            ratio="wide"
            thumbnails
            priority
            sizes="(min-width: 640px) 576px, 100vw"
            overlay={<ProductBadge product={product} />}
          />
        </div>
      )}

      <p className="text-lg font-bold">{product.name}</p>
      <p className="mb-2">
        <PriceLabel price={price} oldPrice={product.oldPrice} promo={product.badge === "promo"} />
      </p>
      {mode === "detail" && product.description && <p className="mb-3 whitespace-pre-line text-[15px] text-muted">{product.description}</p>}

      {groups.map((group) => (
        <fieldset key={group.name} className="mb-3">
          <legend className="mb-1 text-sm text-muted">{group.name}</legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <Chip
                key={option.value}
                pressed={selection[group.name] === option.value}
                onClick={() => setSelection((current) => ({ ...current, [group.name]: option.value }))}
              >
                {option.value}
                {option.supplement > 0 ? ` (+${formatPrice(option.supplement)})` : ""}
              </Chip>
            ))}
          </div>
        </fieldset>
      ))}

      {product.soldOut ? (
        <Button type="button" variant="outline" size="full" disabled>
          Épuisé
        </Button>
      ) : (
        <>
          <Button type="button" size="full" disabled={missing.length > 0} onClick={() => onAdd(selection)}>
            Ajouter au panier · {formatPrice(price)}
          </Button>
          {missing.length > 0 && <p className="mt-2 text-center text-sm text-muted">Choisissez : {missing.join(", ")}</p>}
        </>
      )}
      {mode === "detail" && (
        <Button type="button" variant="ghost" size="full" className="mt-2" onClick={copyProductLink}>
          Copier le lien du produit
        </Button>
      )}
    </div>
  );
}
