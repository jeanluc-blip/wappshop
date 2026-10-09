"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MessageCircle, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { Logo } from "@/components/brand/Logo";
import { AboutSheetBody } from "@/components/storefront/AboutSheet";
import { CartSheetBody, type CartView } from "@/components/storefront/CartSheet";
import { CategoryBar } from "@/components/storefront/CategoryBar";
import { LegalSheetBody } from "@/components/storefront/LegalSheet";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductSheetBody } from "@/components/storefront/ProductSheet";
import { Sheet } from "@/components/storefront/Sheet";
import { VisitBeacon } from "@/components/storefront/VisitBeacon";
import { Button } from "@/components/ui/button";
import {
  isCompleteSelection,
  normalizeText,
  unitPrice,
  type Category,
  type Product,
  type Selection,
  type ShopPublic,
  type Zone,
} from "@/lib/catalog";
import { createCartStore } from "@/lib/cart";
import type { Trust } from "@/lib/storefront";
import { formatPrice } from "@/lib/format";
import { questionMessage, waLink } from "@/lib/whatsapp";

type StorefrontProps = {
  shop: ShopPublic;
  categories: Category[];
  products: Product[];
  zones: Zone[];
  qrSvg: string;
  trust: Trust;
  /** Lien direct vers un produit : sa fiche s'ouvre dès l'arrivée sur la boutique. */
  initialProductId?: string;
};

type SheetState =
  | null
  | { type: "product"; id: string; mode: "detail" | "variants" }
  | { type: "cart" }
  | { type: "about" }
  | { type: "legal" };

export function Storefront({ shop, categories, products, zones, qrSvg, trust, initialProductId }: StorefrontProps) {
  const [store] = useState(() => createCartStore(shop.slug));
  const lines = useStore(store, (state) => state.lines);
  const [sheet, setSheet] = useState<SheetState>(() =>
    initialProductId && products.some((product) => product.id === initialProductId)
      ? { type: "product", id: initialProductId, mode: "detail" }
      : null,
  );
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Lecture du panier conservé sur l'appareil, puis retrait des lignes qui ne sont plus valables.
  useEffect(() => {
    let active = true;
    void Promise.resolve(store.persist.rehydrate()).then(() => {
      if (!active) return;
      store.getState().prune((line) => {
        const product = productsById.get(line.productId);
        return Boolean(product) && !product!.soldOut && isCompleteSelection(product!, line.selection);
      });
    });
    return () => {
      active = false;
    };
  }, [store, productsById]);

  const cartLines: CartView[] = useMemo(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        return product ? [{ key: line.key, product, selection: line.selection, qty: line.qty, unit: unitPrice(product, line.selection) }] : [];
      }),
    [lines, productsById],
  );
  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.unit * line.qty, 0);
  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cartLines) map.set(line.product.id, (map.get(line.product.id) ?? 0) + line.qty);
    return map;
  }, [cartLines]);

  // Catégorie sans photo : photo de son premier produit, sinon l'initiale.
  const chips = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        imageUrl: category.imageUrl ?? products.find((p) => p.categoryId === category.id && p.images[0])?.images[0] ?? null,
      })),
    [categories, products],
  );

  const visible = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    return products.filter(
      (product) => (categoryId === "all" || product.categoryId === categoryId) && (!q || normalizeText(product.name).includes(q)),
    );
  }, [products, categoryId, deferredQuery]);

  const addProduct = useCallback(
    (product: Product) => {
      if (product.soldOut) {
        toast.error("Ce produit est épuisé.");
        return;
      }
      if (product.variants.length > 0) {
        setSheet({ type: "product", id: product.id, mode: "variants" });
        return;
      }
      store.getState().add(product.id, {});
      toast.success("Ajouté au panier");
    },
    [store],
  );
  const decrementProduct = useCallback(
    (product: Product) => {
      const state = store.getState();
      const last = [...state.lines].reverse().find((line) => line.productId === product.id);
      if (last) state.setQty(last.key, last.qty - 1);
    },
    [store],
  );
  const openDetail = useCallback((product: Product) => setSheet({ type: "product", id: product.id, mode: "detail" }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  function addWithSelection(product: Product, selection: Selection) {
    store.getState().add(product.id, selection);
    toast.success("Ajouté au panier");
    setSheet(null);
  }

  const sheetProduct = sheet?.type === "product" ? productsById.get(sheet.id) : undefined;
  const hasCartBar = cartCount > 0;
  const fabBottom = hasCartBar ? "calc(76px + env(safe-area-inset-bottom, 0px))" : "calc(16px + env(safe-area-inset-bottom, 0px))";

  return (
    <div className="min-h-dvh bg-background">
      <VisitBeacon slug={shop.slug} />

      {shop.announcement && (
        <p className="bg-foreground px-4 py-2 text-center text-sm font-semibold text-background">{shop.announcement}</p>
      )}

      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {shop.logoUrl ? (
          <Image src={shop.logoUrl} alt="" width={44} height={44} sizes="44px" priority className="h-11 w-11 rounded-xl border border-border object-cover" />
        ) : (
          <Logo size={44} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{shop.name}</h1>
          <TrustLine trust={trust} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setSheet({ type: "about" })}>
          À propos
        </Button>
      </header>

      {chips.length > 0 && <CategoryBar categories={chips} active={categoryId} onSelect={setCategoryId} />}

      <main className="mx-auto max-w-5xl px-4 pb-40 pt-4">
        {products.length > 0 && (
          <div className="relative mb-4">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un produit"
              aria-label="Rechercher un produit"
              enterKeyHint="search"
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-base"
            />
          </div>
        )}

        {products.length === 0 ? (
          <p className="py-10 text-center text-muted">Cette boutique prépare son catalogue. Revenez bientôt.</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-muted" role="status">
            Aucun produit trouvé.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4" aria-label="Produits">
            {visible.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantities.get(product.id) ?? 0}
                priority={index < 2}
                onOpen={openDetail}
                onAdd={addProduct}
                onDecrement={decrementProduct}
              />
            ))}
          </ul>
        )}

        <footer className="mt-12 border-t border-border pt-6 text-center text-sm text-muted">
          <button type="button" onClick={() => setSheet({ type: "legal" })} className="min-h-11 cursor-pointer underline">
            Mentions légales
          </button>
          <p className="mt-1 flex items-center justify-center gap-1.5">
            <Logo size={18} className="rounded" />
            Propulsé par WappShop
          </p>
        </footer>
      </main>

      <a
        href={waLink(shop.whatsapp, questionMessage(shop.name))}
        target="_blank"
        rel="noopener noreferrer"
        style={{ bottom: fabBottom }}
        className="fixed right-3 z-40 flex min-h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-on-brand shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:bg-brand-hover"
      >
        <MessageCircle size={18} aria-hidden="true" />
        Poser une question
      </a>

      {hasCartBar && (
        <div className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-xl">
          <Button type="button" size="full" className="shadow-[0_4px_14px_rgba(0,0,0,0.18)]" onClick={() => setSheet({ type: "cart" })}>
            Voir mon panier ({cartCount}) · {formatPrice(cartTotal)}
          </Button>
        </div>
      )}

      <Sheet open={sheet?.type === "product" && Boolean(sheetProduct)} onClose={closeSheet} title={sheetProduct?.name ?? "Produit"} hideTitle>
        {sheet?.type === "product" && sheetProduct && (
          <ProductSheetBody
            key={`${sheetProduct.id}:${sheet.mode}`}
            product={sheetProduct}
            shopSlug={shop.slug}
            mode={sheet.mode}
            onAdd={(selection) => addWithSelection(sheetProduct, selection)}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === "cart"} onClose={closeSheet} title="Mon panier">
        <CartSheetBody
          shop={shop}
          zones={zones}
          lines={cartLines}
          subtotal={cartTotal}
          onSetQty={(key, qty) => store.getState().setQty(key, qty)}
          onClear={() => {
            store.getState().clear();
            setSheet(null);
          }}
          onOrdered={() => store.getState().clear()}
          onClose={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet?.type === "about"} onClose={closeSheet} title={`À propos de ${shop.name}`}>
        <AboutSheetBody shop={shop} zones={zones} qrSvg={qrSvg} />
      </Sheet>

      <Sheet open={sheet?.type === "legal"} onClose={closeSheet} title="Mentions légales">
        <LegalSheetBody shop={shop} />
      </Sheet>
    </div>
  );
}

/** Étoiles et nombre de commandes livrées : seulement s'il y a des données réelles. */
function TrustLine({ trust }: { trust: Trust }) {
  if (trust.reviewCount === 0 && trust.deliveredCount === 0) return null;
  const parts: string[] = [];
  if (trust.reviewCount > 0 && trust.ratingAverage !== null) {
    parts.push(`${trust.ratingAverage.toLocaleString("fr-FR")} sur 5 (${trust.reviewCount} avis)`);
  }
  if (trust.deliveredCount > 0) {
    parts.push(`${trust.deliveredCount} commande${trust.deliveredCount > 1 ? "s" : ""} livrée${trust.deliveredCount > 1 ? "s" : ""}`);
  }
  return (
    <p className="flex items-center gap-1 truncate text-sm text-muted">
      {trust.reviewCount > 0 && <Star size={14} aria-hidden="true" className="shrink-0 fill-[#f59e0b] text-[#f59e0b]" />}
      <span className="truncate">{parts.join(" · ")}</span>
    </p>
  );
}
