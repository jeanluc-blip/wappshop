import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadSellers, type SellerSummary } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "non-lus", label: "Messages non lus" },
  { id: "sans-produit", label: "Sans produit" },
  { id: "sans-commande", label: "Sans commande" },
  { id: "inactifs", label: "Inactifs (14 jours)" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Porto-Novo" });
const INACTIVE_DAYS = 14;

function matches(seller: SellerSummary, filter: FilterId): boolean {
  switch (filter) {
    case "non-lus":
      return seller.unreadFromSeller > 0;
    case "sans-produit":
      return seller.products === 0;
    case "sans-commande":
      return seller.orders === 0;
    case "inactifs":
      return !seller.lastSignInAt || Date.now() - new Date(seller.lastSignInAt).getTime() > INACTIVE_DAYS * 86_400_000;
    default:
      return true;
  }
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const filter = FILTERS.find((item) => item.id === params.filtre)?.id ?? "tous";
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 60);

  const data = await loadSellers();
  if (!data) {
    return (
      <p role="alert" className="py-8 text-center text-danger">
        La clé serveur SUPABASE_SECRET_KEY est absente : l&apos;espace administrateur ne peut pas lire les vendeurs.
      </p>
    );
  }

  const { sellers, messagingReady } = data;
  const visible = sellers
    .filter((seller) => matches(seller, filter))
    .filter((seller) => !query || [seller.shopName, seller.slug, seller.email ?? "", seller.whatsapp].some((value) => value.toLowerCase().includes(query)))
    // Les vendeurs qui ont écrit en dernier passent en premier.
    .sort((a, b) => b.unreadFromSeller - a.unreadFromSeller || (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));

  const withProducts = sellers.filter((seller) => seller.products > 0).length;
  const withOrders = sellers.filter((seller) => seller.orders > 0).length;
  const unread = sellers.reduce((sum, seller) => sum + seller.unreadFromSeller, 0);

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Vos vendeurs</h1>

      <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Vendeurs" value={sellers.length} />
        <Stat label="Avec des produits" value={withProducts} />
        <Stat label="Avec des commandes" value={withOrders} />
        <Stat label="Messages non lus" value={unread} />
      </dl>

      {!messagingReady && (
        <p role="note" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm">
          La messagerie n&apos;est pas encore activée : lancez le script <b>phase9.sql</b> dans Supabase (SQL Editor, puis Run).
        </p>
      )}

      <form className="mb-3 flex gap-2" role="search">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Chercher un vendeur, un email, un numéro..." aria-label="Chercher un vendeur" />
        {filter !== "tous" && <input type="hidden" name="filtre" value={filter} />}
        <Button type="submit" variant="outline">
          Chercher
        </Button>
      </form>

      <nav aria-label="Filtrer les vendeurs" className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "tous" ? "/admin" : `/admin?filtre=${item.id}`}
            aria-current={filter === item.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
              filter === item.id ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-surface",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-muted">{sellers.length === 0 ? "Aucun vendeur inscrit pour le moment." : "Aucun vendeur ne correspond."}</p>
      ) : (
        <ul aria-label="Liste des vendeurs">
          {visible.map((seller) => (
            <li key={seller.shopId}>
              <Card className="mb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/vendeurs/${seller.shopId}`} className="block truncate text-[17px] font-bold underline-offset-2 hover:underline">
                      {seller.shopName}
                    </Link>
                    <p className="truncate text-sm text-muted">{seller.email ?? "Email inconnu"}</p>
                  </div>
                  {seller.unreadFromSeller > 0 && (
                    <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-on-brand">
                      {seller.unreadFromSeller} non lu{seller.unreadFromSeller > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm">
                  {seller.products} produit{seller.products > 1 ? "s" : ""} · {seller.orders} commande{seller.orders > 1 ? "s" : ""} ({seller.delivered} livrée
                  {seller.delivered > 1 ? "s" : ""})
                </p>
                <p className="text-sm text-muted">
                  Inscrit le {dateFormat.format(new Date(seller.createdAt))}
                  {seller.lastSignInAt ? ` · vu le ${dateFormat.format(new Date(seller.lastSignInAt))}` : " · jamais reconnecté"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/admin/vendeurs/${seller.shopId}`}>Ouvrir la conversation</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${seller.slug}`} target="_blank">
                      Voir la boutique
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold">{value}</dd>
    </div>
  );
}
