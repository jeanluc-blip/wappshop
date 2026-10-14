import { CURRENCY, formatPrice } from "@/lib/format";
import { isHttpsUrl } from "@/lib/validators";
import type { ShopPublic, Zone } from "@/lib/catalog";

type AboutSheetProps = { shop: ShopPublic; zones: Zone[]; qrSvg: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-sm font-bold">{title}</h3>
      <div className="text-[15px] text-muted">{children}</div>
    </section>
  );
}

/** Page « À propos » : présentation, horaires, livraison et frais, retrait, paiements, réseaux, QR code. */
export function AboutSheetBody({ shop, zones, qrSvg }: AboutSheetProps) {
  const social = shop.socialUrl && isHttpsUrl(shop.socialUrl) ? shop.socialUrl : null; // https uniquement
  return (
    <div>
      {shop.about && (
        <Section title="Présentation">
          <p className="whitespace-pre-line">{shop.about}</p>
        </Section>
      )}
      {shop.openingHours && (
        <Section title="Horaires">
          <p>{shop.openingHours}</p>
        </Section>
      )}
      {shop.deliveryEnabled && (
        <Section title="Livraison">
          {zones.length > 0 ? (
            <ul>
              {zones.map((zone) => (
                <li key={zone.id}>
                  {zone.name} : {zone.fee > 0 ? formatPrice(zone.fee) : "gratuit"}
                </li>
              ))}
            </ul>
          ) : (
            <p>Livraison proposée : les frais sont à confirmer avec le vendeur ({CURRENCY}).</p>
          )}
        </Section>
      )}
      {shop.pickupEnabled && (
        <Section title="Retrait en boutique">
          <p>{shop.pickupAddress || "Adresse communiquée par le vendeur."}</p>
        </Section>
      )}
      {shop.paymentMethods.length > 0 && (
        <Section title="Paiement">
          <p>{shop.paymentMethods.join(", ")}</p>
          {shop.paymentNote && <p className="mt-1">{shop.paymentNote}</p>}
        </Section>
      )}
      {social && (
        <Section title="Réseaux sociaux">
          <a href={social} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
            {social}
          </a>
        </Section>
      )}
      <div className="mt-2 text-center">
        <div
          role="img"
          aria-label={`QR code de la boutique ${shop.name}`}
          className="mx-auto inline-block h-40 w-40 rounded-xl border border-border bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-1 text-sm text-muted">Scannez pour partager cette boutique.</p>
      </div>
    </div>
  );
}
