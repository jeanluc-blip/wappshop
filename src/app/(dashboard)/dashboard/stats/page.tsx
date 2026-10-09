import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { PERIODS, PERIOD_LABELS, parsePeriod, periodStart } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };

const MAX_EVENTS = 20_000;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Porto-Novo" });

type ReviewRow = { rating: number; comment: string | null; created_at: string };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { shop } = await requireShop();
  const period = parsePeriod((await searchParams).periode);
  const since = periodStart(period).toISOString();

  // Tout est lu avec les droits du vendeur connecté : la sécurité de la base (RLS) limite aux données de sa boutique.
  const supabase = await createClient();
  const [visits, sent, delivered, reviews] = await Promise.all([
    supabase.from("events").select("session_id").eq("shop_id", shop.id).eq("type", "visit").gte("created_at", since).limit(MAX_EVENTS),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).gte("created_at", since),
    supabase.from("orders").select("total_amount").eq("shop_id", shop.id).eq("status", "delivered").gte("created_at", since).limit(MAX_EVENTS),
    supabase.from("reviews").select("rating, comment, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(1000).returns<ReviewRow[]>(),
  ]);

  const failed = Boolean(visits.error || sent.error || delivered.error || reviews.error);

  // Visiteurs : un par session anonyme (les visites rapprochées d'une même session ne comptent qu'une fois).
  const visitors = new Set((visits.data ?? []).map((row) => row.session_id as string | null).filter(Boolean)).size;
  const ordersSent = sent.count ?? 0;
  const deliveredOrders = delivered.data ?? [];
  const deliveredCount = deliveredOrders.length;
  const revenue = deliveredOrders.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const conversion = visitors > 0 ? Math.min(100, Math.round((ordersSent / visitors) * 100)) : null;

  const allReviews = reviews.data ?? [];
  const average = allReviews.length > 0 ? allReviews.reduce((sum, review) => sum + Number(review.rating), 0) / allReviews.length : null;
  const latest = allReviews.slice(0, 5);

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Statistiques</h1>

      <nav aria-label="Période" className="mb-3 flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <Link
            key={item}
            href={`/dashboard/stats?periode=${item}`}
            aria-current={period === item ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
              period === item ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-surface",
            )}
          >
            {PERIOD_LABELS[item]}
          </Link>
        ))}
      </nav>

      {failed && (
        <p role="alert" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
          Certaines statistiques n&apos;ont pas pu être chargées. Rechargez la page.
        </p>
      )}

      <dl className="mb-3 grid grid-cols-2 gap-2">
        <Metric label="Visiteurs" value={String(visitors)} />
        <Metric label="Commandes envoyées" value={String(ordersSent)} />
        <Metric label="Commandes livrées" value={String(deliveredCount)} />
        <Metric label="Taux de conversion" value={conversion === null ? "-" : `${conversion} %`} />
        <Metric label="Chiffre d'affaires livré" value={formatPrice(revenue)} wide />
      </dl>

      <Card aria-label="Comment lire ces chiffres">
        <h2 className="text-base font-bold">Comment lire ces chiffres</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Visiteurs : visites anonymes, comptées une fois par session. Vos propres visites et les robots ne comptent pas.</li>
          <li>
            Commandes envoyées : clients qui ont cliqué sur « Valider ma commande ». WappShop ne peut pas savoir si le message WhatsApp est réellement parti : seul
            le statut que vous choisissez fait foi.
          </li>
          <li>Commandes livrées : commandes que vous avez passées au statut « Livrée ». Le chiffre d&apos;affaires ne compte que celles-ci.</li>
          <li>Conversion : commandes envoyées divisées par les visiteurs, au maximum 100 %.</li>
        </ul>
        {visitors === 0 && ordersSent === 0 && (
          <p className="mt-3 text-sm">Aucune activité sur cette période. Partagez le lien de votre boutique pour recevoir vos premières visites.</p>
        )}
      </Card>

      <Card aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="text-base font-bold">
          Avis clients
        </h2>
        {allReviews.length === 0 || average === null ? (
          <p className="mt-2 text-sm text-muted">
            Pas encore d&apos;avis. Quand une commande est livrée, copiez la demande d&apos;avis depuis l&apos;onglet Commandes et envoyez-la à votre client sur
            WhatsApp.
          </p>
        ) : (
          <>
            <p className="mt-2 flex items-center gap-1.5">
              <Star size={18} aria-hidden="true" className="fill-[#f59e0b] text-[#f59e0b]" />
              <b>{(Math.round(average * 10) / 10).toLocaleString("fr-FR")} sur 5</b>
              <span className="text-sm text-muted">
                ({allReviews.length} avis)
              </span>
            </p>
            <ul className="mt-3 space-y-3">
              {latest.map((review, index) => (
                <li key={`${review.created_at}-${index}`} className="border-t border-border pt-3 text-sm">
                  <p className="font-semibold">
                    {review.rating} sur 5 <span className="font-normal text-muted">· {dateFormat.format(new Date(review.created_at))}</span>
                  </p>
                  {review.comment && <p className="mt-1 whitespace-pre-line break-words">{review.comment}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-background p-4", wide && "col-span-2")}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
    </div>
  );
}
