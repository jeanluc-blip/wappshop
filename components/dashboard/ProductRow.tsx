"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { ShareSheetBody } from "@/components/share/ShareSheetBody";
import { Sheet } from "@/components/storefront/Sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyText } from "@/lib/clipboard";
import { formatPrice } from "@/lib/format";
import { setProductFeatured, setProductSoldOut } from "@/app/(dashboard)/dashboard/products/actions";

export type ProductItem = {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  badge: "none" | "new" | "promo";
  soldOut: boolean;
  featured: boolean;
  categoryName: string | null;
  imageUrl: string | null;
  photoCount: number;
};

type ShopInfo = { name: string; slug: string; logoUrl: string | null };

/** `shopLink` : adresse publique de la boutique ; le lien du produit est `{shopLink}/{id du produit}`. */
export function ProductRow({ product, shopLink, shop }: { product: ProductItem; shopLink: string; shop: ShopInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function toggleFeatured() {
    setBusy(true);
    try {
      const result = await setProductFeatured(product.id, !product.featured);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(product.featured ? "Produit retiré de la vedette" : "Produit mis en vedette");
      router.refresh();
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSoldOut() {
    setBusy(true);
    try {
      const result = await setProductSoldOut(product.id, !product.soldOut);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(product.soldOut ? "Produit remis en vente" : "Produit marqué comme épuisé");
      router.refresh();
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function copyProductLink() {
    const link = `${shopLink}/${product.id}`;
    if (await copyText(link)) {
      toast.success("Lien du produit copié");
    } else {
      window.prompt("Copiez ce lien :", link);
    }
  }

  return (
    <li>
      <Card className="mb-2">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-muted">
                <ShoppingBag size={24} aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{product.name}</p>
            <p className="text-sm text-muted">
              {product.badge === "promo" && product.oldPrice ? <s className="mr-1">{formatPrice(product.oldPrice)}</s> : null}
              {formatPrice(product.price)}
            </p>
            <p className="truncate text-sm text-muted">
              {product.categoryName ?? "Sans catégorie"} · {product.photoCount} photo{product.photoCount > 1 ? "s" : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {product.badge === "new" && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">Nouveau</span>}
              {product.badge === "promo" && <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-semibold text-[#991b1b]">Promo</span>}
              {product.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-semibold text-[#92400e]">
                  <Star size={12} aria-hidden="true" className="fill-current" />
                  Vedette
                </span>
              )}
              {product.soldOut && <span className="rounded-full bg-border px-2 py-0.5 text-xs font-semibold">Épuisé</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/dashboard/products/${product.id}`}>Modifier</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={toggleSoldOut}>
            {product.soldOut ? "Remettre en vente" : "Marquer épuisé"}
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={toggleFeatured}>
            {product.featured ? "Retirer de la vedette" : "Mettre en vedette"}
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={() => setShareOpen(true)}>
            Partager
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" onClick={copyProductLink}>
          Copier le lien du produit
        </Button>
      </Card>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Partager ce produit">
        {shareOpen && (
          <ShareSheetBody
            shopName={shop.name}
            shopSlug={shop.slug}
            shopLogoUrl={shop.logoUrl}
            product={{ id: product.id, name: product.name, price: product.price, oldPrice: product.oldPrice, badge: product.badge, images: product.imageUrl ? [product.imageUrl] : [] }}
          />
        )}
      </Sheet>
    </li>
  );
}
