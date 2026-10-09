import { formatPrice } from "@/lib/format";

/** Numéro WhatsApp : uniquement les chiffres (retire +, espaces, tirets, parenthèses). */
export function waNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Lien WhatsApp réel (<a href>) avec texte pré-rempli, toujours encodé. */
export function waLink(number: string, text: string): string {
  return `https://wa.me/${waNumber(number)}?text=${encodeURIComponent(text)}`;
}

/** Message du bouton flottant « Poser une question » : texte brut, sans emoji. */
export function questionMessage(shopName: string): string {
  return `Bonjour, j'ai une question sur vos produits (${shopName}).`;
}

type OrderMessageInput = {
  shopName: string;
  orderNumber: number;
  customerName: string;
  fulfillment: "delivery" | "pickup";
  zoneName: string | null;
  address: string | null;
  items: { name: string; variants: { name: string; value: string }[]; qty: number; subtotal: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string | null;
};

/** Prix pour un message : espaces normaux (les espaces insécables s'affichent mal dans certains messages). */
function plainPrice(amount: number): string {
  return formatPrice(amount).replace(/\u00a0|\u202f/g, " ");
}

/** Message de commande envoyé au vendeur : texte brut, sans emoji (seul * pour le gras WhatsApp). */
export function buildOrderMessage(order: OrderMessageInput): string {
  const lines: string[] = [];
  lines.push(`*Nouvelle commande - ${order.shopName}*`);
  lines.push(`Commande n° ${order.orderNumber}`);
  lines.push(`Client : ${order.customerName}`);
  if (order.fulfillment === "delivery") {
    lines.push(`Livraison : ${[order.zoneName, order.address].filter(Boolean).join(" - ")}`);
  } else {
    lines.push(`Retrait en boutique${order.address ? ` : ${order.address}` : ""}`);
  }
  lines.push("");
  order.items.forEach((item, index) => {
    const options = item.variants.map((variant) => `${variant.name} : ${variant.value}`).join(", ");
    lines.push(`${index + 1}. ${item.name}${options ? ` (${options})` : ""} x${item.qty} - ${plainPrice(item.subtotal)}`);
  });
  lines.push("");
  lines.push(`Sous-total : ${plainPrice(order.subtotal)}`);
  if (order.deliveryFee > 0) lines.push(`Frais de livraison : ${plainPrice(order.deliveryFee)}`);
  lines.push(`*Total : ${plainPrice(order.total)}*`);
  if (order.paymentMethod) lines.push(`Paiement : ${order.paymentMethod}`);
  lines.push("");
  lines.push("Merci de confirmer la disponibilité et les modalités.");
  return lines.join("\n");
}

/** Message que le vendeur envoie au client pour demander un avis (texte brut, sans emoji). */
export function reviewRequestMessage(customerName: string | null, shopName: string, orderNumber: number, link: string): string {
  const hello = customerName ? `Bonjour ${customerName},` : "Bonjour,";
  return `${hello} merci pour votre commande n° ${orderNumber} chez ${shopName}. Votre avis nous aide beaucoup : vous pouvez le donner en une minute ici : ${link}`;
}
