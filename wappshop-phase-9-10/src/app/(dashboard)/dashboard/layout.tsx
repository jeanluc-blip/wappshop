import Link from "next/link";
import { MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { getMyShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // en plus du proxy : la page ne s'affiche jamais sans session valide
  const isAdmin = isAdminEmail(user.email);
  const shop = await getMyShop(); // pas de navigation tant que l'assistant de démarrage n'est pas terminé

  // Pastille « Commandes » : nombre de commandes encore au statut « Nouvelle » (RLS : uniquement les siennes).
  let newOrders = 0;
  let unreadMessages = 0;
  if (shop) {
    const supabase = await createClient();
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "new");
    newOrders = count ?? 0;

    // Pastille « Messages » : messages de l'équipe pas encore lus (0 tant que la messagerie n'est pas activée).
    const unread = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("sender", "admin").is("read_at", null);
    unreadMessages = unread.error ? 0 : (unread.count ?? 0);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-background px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size={36} />
          <b className="text-[17px]">WappShop</b>
        </Link>
        <span className="flex-1" />
        {shop && (
          <>
            <Link href="/dashboard/assistant" aria-label="Assistant de vente" className="grid size-10 place-items-center rounded-xl hover:bg-surface">
              <Sparkles size={22} aria-hidden="true" />
            </Link>
            <Link href="/dashboard/messages" aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} non lu${unreadMessages > 1 ? "s" : ""}` : "Messages"} className="relative grid size-10 place-items-center rounded-xl hover:bg-surface">
              <MessageCircle size={22} aria-hidden="true" />
              {unreadMessages > 0 && (
                <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-on-brand">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
          </>
        )}
        {isAdmin && (
          <Link href="/admin" aria-label="Espace administrateur" className="grid size-10 place-items-center rounded-xl hover:bg-surface">
            <ShieldCheck size={22} aria-hidden="true" />
          </Link>
        )}
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
