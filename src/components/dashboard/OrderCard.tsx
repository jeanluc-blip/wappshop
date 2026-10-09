"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/app/(dashboard)/dashboard/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { copyText } from "@/lib/clipboard";
import { formatPrice } from "@/lib/format";
import { FULFILLMENT_LABELS, ORDER_STATUSES, STATUS_LABELS, type Fulfillment, type OrderItem, type OrderStatus } from "@/lib/orders";

export type OrderView = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string | null;
  fulfillment: Fulfillment | null;
  zone: string | null;
  address: string | null;
  paymentMethod: string | null;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  /** Texte prêt à envoyer au client pour demander un avis (commande livrée sans avis). */
  reviewRequest: string | null;
  /** Note donnée par le client, s'il y en a une. */
  rating: number | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Porto-Novo" });

export function OrderCard({ order }: { order: OrderView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: OrderStatus) {
    if (status === order.status || busy) return;
    setBusy(true);
    try {
      const result = await updateOrderStatus(order.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Commande passée à « ${STATUS_LABELS[status]} »`);
      router.refresh();
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReviewRequest() {
    if (!order.reviewRequest) return;
    if (await copyText(order.reviewRequest)) {
      toast.success("Message copié : collez-le dans WhatsApp");
    } else {
      window.prompt("Copiez ce message :", order.reviewRequest);
    }
  }

  const subtotal = order.total - order.deliveryFee;

  return (
    <li>
      <Card className="mb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold">
              Commande n° {order.orderNumber}
              {order.status === "new" && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">Nouvelle</span>}
            </p>
            <p className="truncate text-sm text-muted">
              {order.customerName ?? "Client"} · {dateFormat.format(new Date(order.createdAt))}
            </p>
          </div>
          <b className="shrink-0">{formatPrice(order.total)}</b>
        </div>

        <ul className="my-3 space-y-1 border-y border-border py-3 text-[15px]">
          {order.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex justify-between gap-3">
              <span className="min-w-0">
                {item.qty} x {item.name}
                {item.variants.length > 0 && <span className="text-muted"> ({item.variants.map((variant) => variant.value).join(", ")})</span>}
              </span>
              <span className="shrink-0">{formatPrice(item.subtotal)}</span>
            </li>
          ))}
          {order.deliveryFee > 0 && (
            <li className="flex justify-between gap-3 text-muted">
              <span>Livraison</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </li>
          )}
        </ul>

        <dl className="space-y-0.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">Réception :</dt>
            <dd>{order.fulfillment ? FULFILLMENT_LABELS[order.fulfillment] : "Non précisée"}</dd>
          </div>
          {order.fulfillment === "delivery" && order.zone && (
            <div className="flex gap-2">
              <dt className="text-muted">Zone :</dt>
              <dd>{order.zone}</dd>
            </div>
          )}
          {order.address && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">{order.fulfillment === "pickup" ? "Retrait :" : "Adresse :"}</dt>
              <dd className="min-w-0 break-words">{order.address}</dd>
            </div>
          )}
          {order.paymentMethod && (
            <div className="flex gap-2">
              <dt className="text-muted">Paiement :</dt>
              <dd>{order.paymentMethod}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted">Sous-total :</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
        </dl>

        <fieldset className="mt-3" disabled={busy}>
          <legend className="mb-1 text-sm text-muted">Statut</legend>
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((status) => (
              <Chip key={status} pressed={order.status === status} onClick={() => changeStatus(status)}>
                {STATUS_LABELS[status]}
              </Chip>
            ))}
          </div>
        </fieldset>

        {order.status === "delivered" && order.rating !== null && (
          <p className="mt-3 flex items-center gap-1 text-sm">
            <Star size={16} aria-hidden="true" className="fill-[#f59e0b] text-[#f59e0b]" />
            Avis du client : {order.rating} sur 5
          </p>
        )}
        {order.status === "delivered" && order.rating === null && order.reviewRequest && (
          <Button type="button" variant="outline" size="full" className="mt-3" onClick={copyReviewRequest}>
            Copier la demande d&apos;avis
          </Button>
        )}
      </Card>
    </li>
  );
}
