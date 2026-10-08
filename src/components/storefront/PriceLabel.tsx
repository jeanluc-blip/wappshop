import { formatPrice } from "@/lib/format";

/** Prix affiché ; en promo, l'ancien prix apparaît barré (seulement s'il est bien supérieur). */
export function PriceLabel({ price, oldPrice, promo }: { price: number; oldPrice: number | null; promo: boolean }) {
  const showOld = promo && oldPrice !== null && oldPrice > price;
  return (
    <span>
      {showOld && (
        <>
          <s className="mr-1.5 text-muted">
            <span className="sr-only">Ancien prix : </span>
            {formatPrice(oldPrice)}
          </s>
          <span className="sr-only">Nouveau prix : </span>
        </>
      )}
      <span className={showOld ? "font-semibold text-[#b91c1c]" : "text-muted"}>{formatPrice(price)}</span>
    </span>
  );
}
