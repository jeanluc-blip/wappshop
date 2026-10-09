import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getMyShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser(); // en plus du proxy : la page ne s'affiche jamais sans session valide
  const shop = await getMyShop(); // pas de navigation tant que l'assistant de démarrage n'est pas terminé

  // Pastille « Commandes » : nombre de commandes encore au statut « Nouvelle » (RLS : uniquement les siennes).
  let newOrders = 0;
  if (shop) {
    const supabase = await createClient();
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "new");
    newOrders = count ?? 0;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-background px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size={36} />
          <b className="text-[17px]">WappShop</b>
        </Link>
        <span className="flex-1" />
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Déconnexion
          </Button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-4">{children}</main>
      {shop && <DashboardNav newOrders={newOrders} />}
    </div>
  );
}
