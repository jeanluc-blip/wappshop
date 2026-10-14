import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sendAdminMessage } from "@/app/admin/actions";
import { ChatThread } from "@/components/chat/ChatThread";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin";
import { loadSellers, type ChatMessage } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { waLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Vendeur" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Porto-Novo" });

// Idées de messages toutes prêtes : l'administrateur peut les ajuster avant d'envoyer.
const IDEAS = [
  "Bienvenue sur WappShop ! Je suis là pour vous aider à vendre plus. N'hésitez pas à me poser vos questions ici.",
  "Ajoutez au moins 5 produits avec de belles photos nettes : les boutiques bien remplies reçoivent beaucoup plus de commandes.",
  "Partagez chaque jour un produit sur votre statut WhatsApp avec le bouton Partager : c'est la méthode qui amène le plus de clients.",
  "Mettez un produit en promotion cette semaine (prix barré + étiquette Promo) : les clients décident plus vite.",
  "Quand une commande est livrée, envoyez la demande d'avis depuis l'onglet Commandes : les avis rassurent les nouveaux clients.",
  "Imprimez l'affiche avec votre QR code (accueil > Imprimer l'affiche) et placez-la à votre point de vente.",
];

export default async function SellerDetail({ params }: { params: Promise<{ shopId: string }> }) {
  await requireAdmin();
  const { shopId } = await params;
  if (!UUID_PATTERN.test(shopId)) return notFound();

  const data = await loadSellers();
  const seller = data?.sellers.find((item) => item.shopId === shopId);
  if (!data || !seller) return notFound();

  // Conversation : lecture avec la clé serveur, puis les messages du vendeur sont marqués « lus ».
  const admin = createAdminClient();
  let messages: ChatMessage[] = [];
  if (admin && data.messagingReady) {
    const { data: rows } = await admin
      .from("messages")
      .select("id, sender, kind, body, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true })
      .limit(300);
    messages = (rows ?? []).map((row) => ({
      id: row.id as string,
      sender: row.sender as "seller" | "admin",
      kind: row.kind as "chat" | "announcement",
      body: row.body as string,
      createdAt: row.created_at as string,
    }));
    if (seller.unreadFromSeller > 0) {
      await admin.from("messages").update({ read_at: new Date().toISOString() }).eq("shop_id", shopId).eq("sender", "seller").is("read_at", null);
    }
  }

  // Points d'attention : de quoi guider la conversation.
  const hints: string[] = [];
  if (seller.products === 0) hints.push("Boutique vide : aidez-le à ajouter ses premiers produits.");
  else if (seller.products < 5) hints.push(`Seulement ${seller.products} produit${seller.products > 1 ? "s" : ""} : conseillez d'en ajouter jusqu'à 5 ou plus.`);
  if (seller.products > 0 && seller.orders === 0) hints.push("Des produits mais aucune commande : aidez-le à partager sa boutique (statut WhatsApp, affiche).");
  if (seller.delivered > 0) hints.push("Des commandes livrées : rappelez-lui de demander des avis à ses clients.");
  if (!seller.lastSignInAt) hints.push("Ce vendeur ne s'est jamais reconnecté.");

  return (
    <>
      <Link href="/admin" className="mb-2 inline-block text-sm text-muted underline-offset-2 hover:underline">
        &larr; Tous les vendeurs
      </Link>
      <h1 className="text-xl font-bold">{seller.shopName}</h1>
      <p className="text-sm text-muted">
        {seller.email ?? "Email inconnu"} · WhatsApp {seller.whatsapp}
      </p>
      <p className="mb-3 text-sm text-muted">
        Inscrit le {dateFormat.format(new Date(seller.createdAt))}
        {seller.lastSignInAt ? ` · vu le ${dateFormat.format(new Date(seller.lastSignInAt))}` : ""}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/${seller.slug}`} target="_blank">
            Voir la boutique
          </Link>
        </Button>
        <Button asChild size="sm">
          <a
            href={waLink(seller.whatsapp, `Bonjour, c'est l'équipe WappShop. Comment se passe la vente de ${seller.shopName} ? Je suis là pour vous aider.`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discuter sur WhatsApp
          </a>
        </Button>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Produits" value={String(seller.products)} />
        <Stat label="Commandes" value={String(seller.orders)} />
        <Stat label="Livrées" value={String(seller.delivered)} />
        <Stat label="CA livré" value={formatPrice(seller.revenueDelivered)} />
      </dl>

      {hints.length > 0 && (
        <Card aria-labelledby="hints-title">
          <h2 id="hints-title" className="text-base font-bold">
            Points d&apos;attention
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-2 mt-4 text-base font-bold">Conversation</h2>
      {data.messagingReady ? (
        <ChatThread
          viewer="admin"
          messages={messages}
          onSend={sendAdminMessage.bind(null, shopId)}
          suggestions={IDEAS}
          placeholder="Écrivez à ce vendeur..."
          emptyText="Aucun message pour le moment. Commencez la conversation ou choisissez une idée ci-dessous."
        />
      ) : (
        <p role="note" className="rounded-xl border border-border bg-surface p-3 text-sm">
          La messagerie n&apos;est pas encore activée : lancez le script <b>phase9.sql</b> dans Supabase.
        </p>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold">{value}</dd>
    </div>
  );
}
