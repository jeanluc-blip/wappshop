"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { QuantityStepper } from "@/components/storefront/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { describeSelection, type Product, type Selection, type ShopPublic, type Zone } from "@/lib/catalog";
import { copyText } from "@/lib/clipboard";
import { CHECKOUT_ENABLED } from "@/lib/features";
import { formatPrice } from "@/lib/format";
import type { Fulfillment, OrderResponse } from "@/lib/orders";
import { questionMessage, waLink } from "@/lib/whatsapp";

export type CartView = { key: string; product: Product; selection: Selection; qty: number; unit: number };

type CartSheetProps = {
  shop: ShopPublic;
  zones: Zone[];
  lines: CartView[];
  subtotal: number;
  onSetQty: (key: string, qty: number) => void;
  /** « Vider le panier » : vide le panier et ferme la feuille. */
  onClear: () => void;
  /** Commande enregistrée : vide le panier sans fermer la feuille (l'écran de confirmation reste affiché). */
  onOrdered: () => void;
  onClose: () => void;
};

type FieldErrors = Partial<Record<"name" | "zone" | "address" | "payment", string>>;

const GENERIC_ERROR = "Votre commande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.";

function readSessionId(slug: string): string | undefined {
  try {
    return sessionStorage.getItem(`wappshop-visit-${slug}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function CartSheetBody({ shop, zones, lines, subtotal, onSetQty, onClear, onOrdered, onClose }: CartSheetProps) {
  const formId = useId();
  const canDeliver = shop.deliveryEnabled;
  const canPickup = shop.pickupEnabled;
  const [fulfillment, setFulfillment] = useState<Fulfillment>(canDeliver ? "delivery" : "pickup");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [payment, setPayment] = useState(shop.paymentMethods.length === 1 ? shop.paymentMethods[0] : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderResponse | null>(null);

  // Écran de confirmation : le panier est déjà vidé, mais la feuille reste ouverte avec le lien WhatsApp.
  if (confirmation) {
    return <Confirmation order={confirmation} onClose={onClose} />;
  }

  if (lines.length === 0) return <p className="py-6 text-center text-muted">Votre panier est vide.</p>;

  const zone = zones.find((item) => item.id === zoneId);
  const deliveryFee = fulfillment === "delivery" && zone ? zone.fee : 0;
  const total = subtotal + deliveryFee;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (name.trim().length < 2) found.name = "Saisissez votre nom";
    if (fulfillment === "delivery") {
      if (zones.length > 0 && !zone) found.zone = "Choisissez une zone de livraison";
      if (address.trim().length < 3) found.address = "Indiquez votre adresse ou un point de repère";
    }
    if (shop.paymentMethods.length > 0 && !payment) found.payment = "Choisissez un mode de paiement";
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    try {
      // Aucun prix ni total n'est envoyé : le serveur recalcule tout.
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: shop.slug,
          sessionId: readSessionId(shop.slug),
          customerName: name.trim(),
          fulfillment,
          zoneId: fulfillment === "delivery" && zone ? zone.id : undefined,
          address: fulfillment === "delivery" ? address.trim() : undefined,
          paymentMethod: payment || undefined,
          lines: lines.map((line) => ({ productId: line.product.id, selection: line.selection, qty: line.qty })),
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : GENERIC_ERROR;
        setFormError(message);
        return;
      }
      const order = data as OrderResponse;
      onOrdered();
      setConfirmation(order);
      // Ouverture automatique si le navigateur l'autorise ; sinon le bouton de l'écran de confirmation fait foi.
      try {
        window.open(order.whatsappUrl, "_blank", "noopener,noreferrer");
      } catch {
        // pop-up bloquée : sans conséquence
      }
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
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

      {!CHECKOUT_ENABLED ? (
        <>
          <div className="mb-4 mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="font-bold">Sous-total</span>
            <b>{formatPrice(subtotal)}</b>
          </div>
          <div role="note" className="mb-3 rounded-xl bg-surface p-3 text-sm">
            La commande en ligne arrive très bientôt. En attendant, vous pouvez écrire directement au vendeur sur WhatsApp.
          </div>
          <Button asChild size="full">
            <a href={waLink(shop.whatsapp, questionMessage(shop.name))} target="_blank" rel="noopener noreferrer">
              Écrire au vendeur sur WhatsApp
            </a>
          </Button>
        </>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          {canDeliver && canPickup && (
            <fieldset className="mb-3">
              <legend className="mb-1 text-sm text-muted">Réception</legend>
              <div className="flex flex-wrap gap-2">
                <Chip pressed={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")}>
                  Livraison
                </Chip>
                <Chip pressed={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>
                  Retrait en boutique
                </Chip>
              </div>
            </fieldset>
          )}

          {fulfillment === "delivery" ? (
            <>
              {zones.length > 0 && (
                <div className="mb-3">
                  <Label htmlFor={`${formId}-zone`}>Zone de livraison</Label>
                  <Select
                    id={`${formId}-zone`}
                    value={zoneId}
                    onChange={(event) => setZoneId(event.target.value)}
                    aria-invalid={errors.zone ? true : undefined}
                    aria-describedby={errors.zone ? `${formId}-zone-error` : undefined}
                  >
                    <option value="">Choisir une zone</option>
                    {zones.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.fee > 0 ? formatPrice(item.fee) : "gratuit"}
                      </option>
                    ))}
                  </Select>
                  <FieldError id={`${formId}-zone-error`} message={errors.zone} />
                </div>
              )}
              <div className="mb-3">
                <Label htmlFor={`${formId}-address`}>Adresse ou point de repère</Label>
                <Input
                  id={`${formId}-address`}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  autoComplete="street-address"
                  maxLength={200}
                  aria-invalid={errors.address ? true : undefined}
                  aria-describedby={errors.address ? `${formId}-address-error` : undefined}
                />
                <FieldError id={`${formId}-address-error`} message={errors.address} />
              </div>
            </>
          ) : (
            <p className="mb-3 rounded-xl bg-surface p-3 text-sm">
              Retrait en boutique{shop.pickupAddress ? ` : ${shop.pickupAddress}` : ""}
            </p>
          )}

          <div className="mb-3">
            <Label htmlFor={`${formId}-name`}>Votre nom</Label>
            <Input
              id={`${formId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${formId}-name-error` : undefined}
            />
            <FieldError id={`${formId}-name-error`} message={errors.name} />
          </div>

          {shop.paymentMethods.length > 0 && (
            <div className="mb-3">
              <Label htmlFor={`${formId}-payment`}>Paiement</Label>
              <Select
                id={`${formId}-payment`}
                value={payment}
                onChange={(event) => setPayment(event.target.value)}
                aria-invalid={errors.payment ? true : undefined}
                aria-describedby={errors.payment ? `${formId}-payment-error` : undefined}
              >
                <option value="">Choisir un mode de paiement</option>
                {shop.paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
              <FieldError id={`${formId}-payment-error`} message={errors.payment} />
              {shop.paymentNote && <p className="mt-1 text-sm text-muted">{shop.paymentNote}</p>}
            </div>
          )}

          <dl className="mb-4 space-y-1 border-t border-border pt-3 text-[15px]">
            <div className="flex justify-between">
              <dt>Sous-total</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {fulfillment === "delivery" && (
              <div className="flex justify-between">
                <dt>Livraison</dt>
                <dd>{zones.length > 0 && !zone ? "à choisir" : deliveryFee > 0 ? formatPrice(deliveryFee) : "gratuit"}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {formError && (
            <p role="alert" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" size="full" disabled={sending}>
            {sending ? "Envoi en cours..." : "Valider ma commande sur WhatsApp"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted">Le total final est confirmé par le vendeur sur WhatsApp.</p>
        </div>
      )}

      <Button type="button" variant="ghost" size="full" className="mt-2" onClick={onClear}>
        Vider le panier
      </Button>
    </form>
  );
}

function Confirmation({ order, onClose }: { order: OrderResponse; onClose: () => void }) {
  async function copyMessage() {
    if (await copyText(order.message)) {
      toast.success("Message copié");
    } else {
      window.prompt("Copiez ce message :", order.message);
    }
  }

  return (
    <div>
      <p className="text-lg font-bold">Commande n° {order.orderNumber} enregistrée</p>
      <p className="mt-1 text-[15px] text-muted">
        Dernière étape : envoyez le message au vendeur sur WhatsApp pour qu&apos;il confirme votre commande.
      </p>
      <dl className="my-4 space-y-1 rounded-xl bg-surface p-3 text-[15px]">
        <div className="flex justify-between">
          <dt>Sous-total</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        {order.deliveryFee > 0 && (
          <div className="flex justify-between">
            <dt>Livraison</dt>
            <dd>{formatPrice(order.deliveryFee)}</dd>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <dt>Total</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>
      <Button asChild size="full">
        <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
          Ouvrir WhatsApp
        </a>
      </Button>
      <Button type="button" variant="outline" size="full" className="mt-2" onClick={copyMessage}>
        Copier le message
      </Button>
      <Button type="button" variant="ghost" size="full" className="mt-2" onClick={onClose}>
        Fermer
      </Button>
    </div>
  );
}
