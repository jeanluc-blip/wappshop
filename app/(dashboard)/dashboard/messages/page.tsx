import type { Metadata } from "next";
import Link from "next/link";
import { ChatThread } from "@/components/chat/ChatThread";
import type { ChatMessage } from "@/lib/admin-data";
import { requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { sendSellerMessage } from "./actions";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { shop } = await requireShop();
  const supabase = await createClient();

  // Lecture avec les droits du vendeur : la sécurité de la base ne laisse voir que les messages de sa boutique.
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender, kind, body, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold">Messages</h1>
        <p role="note" className="rounded-xl border border-border bg-surface p-3 text-sm">
          La messagerie sera disponible très bientôt.
        </p>
      </>
    );
  }

  // Ouvrir la page marque les messages de l'équipe comme lus (la pastille disparaît).
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("shop_id", shop.id).eq("sender", "admin").is("read_at", null);

  const messages: ChatMessage[] = (data ?? []).map((row) => ({
    id: row.id as string,
    sender: row.sender as "seller" | "admin",
    kind: row.kind as "chat" | "announcement",
    body: row.body as string,
    createdAt: row.created_at as string,
  }));

  return (
    <>
      <h1 className="text-xl font-bold">Messages</h1>
      <p className="mb-3 text-sm text-muted">Écrivez à l&apos;équipe WappShop : questions, difficultés, idées pour mieux vendre. Nous vous répondons ici.</p>
      <ChatThread
        viewer="seller"
        messages={messages}
        onSend={sendSellerMessage}
        placeholder="Écrivez à l'équipe WappShop..."
        emptyText="Aucun message pour le moment. Posez votre première question !"
      />
      <p className="mt-4 text-center text-sm text-muted">
        Besoin d&apos;un conseil tout de suite ?{" "}
        <Link href="/dashboard/assistant" className="font-semibold text-foreground underline underline-offset-2">
          Demandez à l&apos;assistant de vente
        </Link>
      </p>
    </>
  );
}
