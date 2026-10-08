"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { setProductSoldOut } from "@/app/(dashboard)/dashboard/products/actions";

export type ProductItem = {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  badge: "none" | "new" | "promo";
  soldOut: boolean;
  categoryName: string | null;
  imageUrl: string | null;
  photoCount: number;
};

export function ProductRow({ product }: { product: ProductItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
      </Card>
    </li>
  );
}
