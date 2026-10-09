import { z } from "zod";

// Types et règles de commande partagés par le navigateur (formulaire du panier),
// le serveur (/api/orders) et l'espace vendeur (onglet Commandes).

export const ORDER_STATUSES = ["new", "confirmed", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  delivered: "Livrée",
};

export type Fulfillment = "delivery" | "pickup";

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  delivery: "Livraison",
  pickup: "Retrait en boutique",
};

export const MAX_ORDER_LINES = 50;
export const MAX_LINE_QTY = 99;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Instantané d'un article au moment de la commande (la commande reste lisible si le produit change ensuite). */
export type OrderItem = {
  productId: string;
  name: string;
  variants: { name: string; value: string }[];
  qty: number;
  unitPrice: number;
  subtotal: number;
};

/**
 * Ce que le navigateur envoie. Aucun prix, aucun total : le serveur recalcule tout à partir de la base.
 * (Tout champ en trop, comme un faux total, est simplement ignoré.)
 */
export const orderRequestSchema = z.object({
  slug: z.string().min(3).max(40),
  sessionId: z
    .string()
    .regex(/^[A-Za-z0-9-]{16,64}$/)
    .optional(),
  customerName: z.string().trim().min(2, "Saisissez votre nom").max(80, "80 caractères maximum"),
  fulfillment: z.enum(["delivery", "pickup"], { error: "Choisissez livraison ou retrait" }),
  zoneId: z.string().regex(UUID_PATTERN).optional(),
  address: z.string().trim().max(200, "200 caractères maximum").optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().regex(UUID_PATTERN),
        selection: z.record(z.string().max(60), z.string().max(60)),
        qty: z.number().int().min(1).max(MAX_LINE_QTY),
      }),
    )
    .min(1, "Votre panier est vide")
    .max(MAX_ORDER_LINES, `${MAX_ORDER_LINES} articles maximum par commande`),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

/** Réponse du serveur : les montants affichés au client sont ceux que le serveur a calculés. */
export type OrderResponse = {
  orderNumber: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  message: string;
  whatsappUrl: string;
};
