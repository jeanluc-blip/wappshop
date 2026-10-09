import type { Metadata } from "next";
import Link from "next/link";
import { OrderCard, type OrderView } from "@/components/dashboard/OrderCard";
import { ORDER_STATUSES, STATUS_LABELS, type Fulfillment, type OrderItem, type OrderStatus } from "@/lib/orders";
import { requireShop } from "@/lib/shop";
import { shopUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { reviewRequestMessage } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Commandes" };

type Row = {
  id: string;
  order_number: number;
  items_details: OrderItem[];
  total_amount: number | string;
  status: OrderStatus;
  customer_name: string | null;
  fulfillment: Fulfillment | null;
  delivery_zone: string | null;
  delivery_address: string | null;
  delivery_fee: number | string;
  payment_method: string | null;
  review_token: string;
  created_at: string;
};

const PAGE_SIZE = 100;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { shop } = await requireShop();
  const { statut } = await searchParams;
  const filter = ORDER_STATUSES.find((status) => status === statut) ?? null;

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, items_details, total_amount, status, customer_name, fulfillment, delivery_zone, delivery_address, delivery_fee, payment_method, review_token, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query.returns<Row[]>();

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const { data: reviews } = ids.length > 0 ? await supabase.from("reviews").select("order_id, rating").in("order_id", ids) : { data: [] };
  const ratings = new Map((reviews ?? []).map((review) => [review.order_id as string, Number(review.rating)]));

  const orders: OrderView[] = rows.map((row) => ({
    id: row.id,
    orderNumber: Number(row.order_number),
    status: row.status,
    customerName: row.customer_name,
    fulfillment: row.fulfillment,
    zone: row.delivery_zone,
    address: row.delivery_address,
    paymentMethod: row.payment_method,
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total_amount),
    createdAt: row.created_at,
    items: Array.isArray(row.items_details) ? row.items_details : [],
    rating: ratings.get(row.id) ?? null,
    reviewRequest:
      row.status === "delivered" && !ratings.has(row.id)
        ? reviewRequestMessage(row.customer_name, shop.shop_name, Number(row.order_number), `${shopUrl(shop.slug)}/avis/${row.review_token}`)
        : null,
  }));

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Commandes</h1>

      <nav aria-label="Filtrer par statut" className="mb-3 flex flex-wrap gap-2">
        <FilterLink href="/dashboard/orders" active={filter === null}>
          Toutes
        </FilterLink>
        {ORDER_STATUSES.map((status) => (
          <FilterLink key={status} href={`/dashboard/orders?statut=${status}`} active={filter === status}>
            {STATUS_LABELS[status]}
          </FilterLink>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="py-8 text-center text-danger">
          Impossible de charger les commandes. Rechargez la page.
        </p>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {filter
            ? `Aucune commande « ${STATUS_LABELS[filter]} » pour le moment.`
            : "Aucune commande pour le moment. Partagez le lien de votre boutique : les commandes de vos clients apparaîtront ici."}
        </p>
      ) : (
        <ul aria-label="Vos commandes">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
      {orders.length === PAGE_SIZE && <p className="mt-2 text-center text-sm text-muted">Affichage des {PAGE_SIZE} commandes les plus récentes.</p>}
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-surface",
      )}
    >
      {children}
    </Link>
  );
}
