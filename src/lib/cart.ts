import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Selection } from "@/lib/catalog";

export type CartLine = { key: string; productId: string; selection: Selection; qty: number };

export type CartState = {
  lines: CartLine[];
  add: (productId: string, selection: Selection) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  /** Retire les lignes qui ne sont plus valables (produit supprimé, épuisé, variante disparue). */
  prune: (isValid: (line: CartLine) => boolean) => void;
};

export const MAX_LINE_QTY = 99;

/** Une même ligne = même produit + mêmes choix de variantes (quel que soit l'ordre des clés). */
export function lineKey(productId: string, selection: Selection): string {
  const entries = Object.entries(selection).sort(([a], [b]) => a.localeCompare(b));
  return `${productId}|${JSON.stringify(entries)}`;
}

/** Panier d'une boutique, conservé sur l'appareil (localStorage), une clé par boutique. */
export function createCartStore(slug: string) {
  return createStore<CartState>()(
    persist(
      (set) => ({
        lines: [],
        add: (productId, selection) =>
          set((state) => {
            const key = lineKey(productId, selection);
            const existing = state.lines.find((line) => line.key === key);
            if (existing) {
              return {
                lines: state.lines.map((line) =>
                  line.key === key ? { ...line, qty: Math.min(MAX_LINE_QTY, line.qty + 1) } : line,
                ),
              };
            }
            return { lines: [...state.lines, { key, productId, selection, qty: 1 }] };
          }),
        setQty: (key, qty) =>
          set((state) => ({
            lines:
              qty <= 0
                ? state.lines.filter((line) => line.key !== key)
                : state.lines.map((line) => (line.key === key ? { ...line, qty: Math.min(MAX_LINE_QTY, qty) } : line)),
          })),
        clear: () => set({ lines: [] }),
        prune: (isValid) =>
          set((state) => {
            const kept = state.lines.filter(isValid);
            return kept.length === state.lines.length ? state : { lines: kept };
          }),
      }),
      {
        name: `wappshop-cart-${slug}`,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ lines: state.lines }),
        // La lecture du panier se fait après l'affichage (évite tout décalage avec le HTML du serveur).
        skipHydration: true,
      },
    ),
  );
}
