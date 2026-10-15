import { requireAdmin } from "@/lib/admin";
import { loadSellers } from "@/lib/admin-data";
import { AnnouncementForm } from "./AnnouncementForm";

export default async function AnnouncementPage() {
  await requireAdmin();
  const data = await loadSellers();
  if (!data) {
    return (
      <p role="alert" className="py-8 text-center text-danger">
        La clé serveur SUPABASE_SECRET_KEY est absente.
      </p>
    );
  }
  const counts = {
    all: data.sellers.length,
    no_products: data.sellers.filter((seller) => seller.products === 0).length,
    no_orders: data.sellers.filter((seller) => seller.orders === 0).length,
  };

  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Annonce à plusieurs vendeurs</h1>
      <p className="mb-4 text-sm text-muted">Envoyez une idée ou un conseil à tous vos vendeurs, ou à ceux qui ont besoin d&apos;aide. Les futurs vendeurs ne la recevront pas.</p>
      {!data.messagingReady ? (
        <p role="note" className="rounded-xl border border-border bg-surface p-3 text-sm">
          La messagerie n&apos;est pas encore activée : lancez le script <b>phase9.sql</b> dans Supabase.
        </p>
      ) : (
        <AnnouncementForm counts={counts} />
      )}
    </>
  );
}
