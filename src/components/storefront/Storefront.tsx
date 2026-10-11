"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { Logo } from "@/components/brand/Logo";
import { BottomNav } from "@/components/storefront/BottomNav";
import { ShopBanner } from "@/components/storefront/ShopBanner";
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
  type Review,
  type Selection,
  type ShopPublic,
  type Zone,
} from "@/lib/catalog";
import { createCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { questionMessage, waLink } from "@/lib/whatsapp";

type StorefrontProps = {
  shop: ShopPublic;
  categories: Category[];
  products: Product[];
  zones: Zone[];
  reviews: Review[];
  deliveredCount: number;
  qrSvg: string;
  /** Adresse publique de la boutique (sans « / » final), base des liens de produits. */
  baseUrl: string;
  /** Produit à ouvrir dès l'arrivée (lien partagé d'un produit). */
  initialProductId?: string;
};

type SheetState =
  | null
  | { type: "product"; id: string; mode: "detail" | "variants" }
  | { type: "cart" }
  | { type: "about" }
  | { type: "categories" }
  | { type: "legal" };

export function Storefront({ shop, categories, products, zones, reviews, deliveredCount, qrSvg, baseUrl, initialProductId }: StorefrontProps) {
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

  const popular = useMemo(() => products.filter((product) => product.featured).slice(0, 12), [products]);
  const showPopular = popular.length > 0 && categoryId === "all" && !deferredQuery.trim();
  const showBanner = Boolean(shop.bannerTitle || shop.bannerUrl);

  function goToProducts() {
    document.getElementById("produits")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
  // Preuve de confiance : uniquement des données réelles, jamais de valeur inventée.
  const average = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  const trust = [
    average !== null ? `★ ${average.toFixed(1).replace(".", ",")} (${reviews.length} avis)` : null,
    deliveredCount > 0 ? `${deliveredCount} commande${deliveredCount > 1 ? "s" : ""} livrée${deliveredCount > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const fabBottom = hasCartBar ? "calc(140px + env(safe-area-inset-bottom, 0px))" : "calc(76px + env(safe-area-inset-bottom, 0px))";

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
          {trust && <p className="truncate text-sm text-muted">{trust}</p>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setSheet({ type: "about" })}>
          À propos
        </Button>
      </header>

      <div className="mx-auto max-w-5xl px-4">
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
        {showBanner && <ShopBanner shopName={shop.name} title={shop.bannerTitle} imageUrl={shop.bannerUrl} onDiscover={goToProducts} />}
      </div>

      {chips.length > 0 && <CategoryBar categories={chips} active={categoryId} onSelect={setCategoryId} />}

      <main className="mx-auto max-w-5xl px-4 pb-48 pt-4">
        {showPopular && (
          <section aria-labelledby="popular-title" className="mb-6">
            <h2 id="popular-title" className="mb-3 text-lg font-bold">
              Produits populaires
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {popular.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantities.get(product.id) ?? 0}
                  priority={index < 2 && !showBanner}
                  onOpen={openDetail}
                  onAdd={addProduct}
                  onDecrement={decrementProduct}
                  className="w-[46%] shrink-0 snap-start sm:w-56"
                />
              ))}
            </ul>
          </section>
        )}

        <div id="produits" className="scroll-mt-20" />
        {showPopular && <h2 className="mb-3 text-lg font-bold">Tous les produits</h2>}

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
                priority={index < 2 && !showBanner && !showPopular}
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
        <div className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-xl">
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
            mode={sheet.mode}
            link={`${baseUrl}/${sheetProduct.id}`}
            onAdd={(selection) => addWithSelection(sheetProduct, selection)}
          />
        )}
      </Sheet>

      <BottomNav
        cartCount={cartCount}
        showCategories={chips.length > 0}
        onHome={() => {
          setCategoryId("all");
          setQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onCategories={() => setSheet({ type: "categories" })}
        onCart={() => setSheet({ type: "cart" })}
        onAbout={() => setSheet({ type: "about" })}
      />

      <Sheet open={sheet?.type === "categories"} onClose={closeSheet} title="Catégories">
        <ul>
          {[{ id: "all", name: "Toutes les catégories" }, ...chips].map((category) => (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={categoryId === category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  setSheet(null);
                  setTimeout(goToProducts, 50);
                }}
                className={`flex min-h-12 w-full cursor-pointer items-center rounded-xl px-3 text-left text-base ${categoryId === category.id ? "bg-surface font-bold" : ""}`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={sheet?.type === "cart"} onClose={closeSheet} title="Mon panier">
        <CartSheetBody
          lines={cartLines}
          total={cartTotal}
          shop={shop}
          zones={zones}
          onSetQty={(key, qty) => store.getState().setQty(key, qty)}
          onClear={() => store.getState().clear()}
          onClose={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet?.type === "about"} onClose={closeSheet} title={`À propos de ${shop.name}`}>
        <AboutSheetBody shop={shop} zones={zones} qrSvg={qrSvg} reviews={reviews} />
      </Sheet>

      <Sheet open={sheet?.type === "legal"} onClose={closeSheet} title="Mentions légales">
        <LegalSheetBody shop={shop} />
      </Sheet>
    </div>
  );
}
