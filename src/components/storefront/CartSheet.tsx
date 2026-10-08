"use client";

import { QuantityStepper } from "@/components/storefront/QuantityStepper";
import { Button } from "@/components/ui/button";
import { describeSelection, type Product, type Selection } from "@/lib/catalog";
import { CHECKOUT_ENABLED } from "@/lib/features";
import { formatPrice } from "@/lib/format";
import { questionMessage, waLink } from "@/lib/whatsapp";

export type CartView = { key: string; product: Product; selection: Selection; qty: number; unit: number };

type CartSheetProps = {
  lines: CartView[];
  total: number;
  shopName: string;
  whatsapp: string;
  onSetQty: (key: string, qty: number) => void;
  onClear: () => void;
};

export function CartSheetBody({ lines, total, shopName, whatsapp, onSetQty, onClear }: CartSheetProps) {
  if (lines.length === 0) return <p className="py-6 text-center text-muted">Votre panier est vide.</p>;

  return (
    <div>
      <ul>
        {lines.map((line) => {
          const options = describeSelection(line.product, line.selection);
          return (
            <li key={line.key} className="mb-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{line.product.name}</p>
                <p className="text-sm text-muted">
                  {options && `${options} · `}
                  {formatPrice(line.unit)}
                </p>
                <p className="text-sm font-semibold">{formatPrice(line.unit * line.qty)}</p>
              </div>
              <QuantityStepper
                className="w-28 shrink-0"
                quantity={line.qty}
                label={line.product.name}
                onDecrement={() => onSetQty(line.key, line.qty - 1)}
                onIncrement={() => onSetQty(line.key, line.qty + 1)}
              />
            </li>
          );
        })}
      </ul>

      <div className="mb-4 mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="font-bold">Sous-total</span>
        <b>{formatPrice(total)}</b>
      </div>

      {CHECKOUT_ENABLED ? null : (
        <div role="note" className="mb-3 rounded-xl bg-surface p-3 text-sm">
          La commande en ligne arrive très bientôt. En attendant, vous pouvez écrire directement au vendeur sur WhatsApp.
        </div>
      )}
      {!CHECKOUT_ENABLED && (
        <Button asChild size="full">
          <a href={waLink(whatsapp, questionMessage(shopName))} target="_blank" rel="noopener noreferrer">
            Écrire au vendeur sur WhatsApp
          </a>
        </Button>
      )}
      <Button type="button" variant="ghost" size="full" className="mt-2" onClick={onClear}>
        Vider le panier
      </Button>
    </div>
  );
}
