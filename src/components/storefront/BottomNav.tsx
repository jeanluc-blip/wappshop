"use client";

import { House, Info, LayoutGrid, ShoppingCart } from "lucide-react";

type BottomNavProps = {
  cartCount: number;
  showCategories: boolean;
  onHome: () => void;
  onCategories: () => void;
  onCart: () => void;
  onAbout: () => void;
};

function Tab({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <li className="flex-1">
      <button type="button" onClick={onClick} className="flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-xs text-muted">
        {children}
        <span>{label}</span>
      </button>
    </li>
  );
}

/** Barre du bas de la boutique : Accueil, Catégories, Panier (avec le nombre d'articles), À propos. */
export function BottomNav({ cartCount, showCategories, onHome, onCategories, onCart, onAbout }: BottomNavProps) {
  return (
    <nav aria-label="Navigation de la boutique" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="mx-auto flex max-w-xl">
        <Tab label="Accueil" onClick={onHome}>
          <House size={22} aria-hidden="true" />
        </Tab>
        {showCategories && (
          <Tab label="Catégories" onClick={onCategories}>
            <LayoutGrid size={22} aria-hidden="true" />
          </Tab>
        )}
        <Tab label="Panier" onClick={onCart}>
          <span className="relative">
            <ShoppingCart size={22} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-on-brand">
                <span aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span>
                <span className="sr-only">{cartCount} article{cartCount > 1 ? "s" : ""} dans le panier</span>
              </span>
            )}
          </span>
        </Tab>
        <Tab label="À propos" onClick={onAbout}>
          <Info size={22} aria-hidden="true" />
        </Tab>
      </ul>
    </nav>
  );
}
