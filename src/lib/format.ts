// Devise configurable par constante (voir CLAUDE.md, conventions de code).
export const CURRENCY = "FCFA";

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Prix affiché : « 20 000 FCFA » (espaces insécables : le montant ne se coupe pas en deux lignes). */
export function formatPrice(amount: number): string {
  return `${numberFormat.format(amount)}\u00a0${CURRENCY}`;
}
