import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { ReviewForm } from "@/components/storefront/ReviewForm";
import { Button } from "@/components/ui/button";
import { UUID_PATTERN } from "@/lib/orders";
import { slugError } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

// Page d'avis à usage unique : toujours calculée à la demande, jamais indexée.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Donner mon avis", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string; token: string }> };

type State =
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "not_delivered"; shopName: string; logoUrl: string | null }
  | { kind: "already"; shopName: string; logoUrl: string | null }
  | { kind: "form"; shopName: string; logoUrl: string | null };

async function loadState(slug: string, token: string): Promise<State> {
  const admin = createAdminClient();
  if (!admin) return { kind: "unavailable" };

  const { data: shop } = await admin.from("shops").select("id, shop_name, logo_url").eq("slug", slug).maybeSingle<{ id: string; shop_name: string; logo_url: string | null }>();
  if (!shop) return { kind: "invalid" };

  // Le jeton doit appartenir à une commande de CETTE boutique.
  const { data: order } = await admin
    .from("orders")
    .select("id, status")
    .eq("review_token", token)
    .eq("shop_id", shop.id)
    .maybeSingle<{ id: string; status: string }>();
  if (!order) return { kind: "invalid" };

  const base = { shopName: shop.shop_name, logoUrl: shop.logo_url };
  if (order.status !== "delivered") return { kind: "not_delivered", ...base };

  const { data: review } = await admin.from("reviews").select("id").eq("order_id", order.id).maybeSingle();
  return review ? { kind: "already", ...base } : { kind: "form", ...base };
}

export default async function ReviewPage({ params }: Props) {
  const { slug, token } = await params;
  if (slugError(slug) || !UUID_PATTERN.test(token)) notFound();

  const state = await loadState(slug, token);

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      {state.kind === "invalid" || state.kind === "unavailable" ? (
        <Logo size={64} className="mx-auto mb-3" />
      ) : state.logoUrl ? (
        <Image src={state.logoUrl} alt="" width={64} height={64} sizes="64px" className="mx-auto mb-3 h-16 w-16 rounded-2xl border border-border object-cover" />
      ) : (
        <Logo size={64} className="mx-auto mb-3" />
      )}

      {state.kind === "invalid" && (
        <Message title="Lien invalide" text="Ce lien d'avis n'existe pas ou n'est plus valable. Vérifiez le message reçu du vendeur." slug={slug} home />
      )}
      {state.kind === "unavailable" && (
        <Message title="Service indisponible" text="L'envoi d'avis n'est pas disponible pour le moment. Réessayez plus tard." slug={slug} />
      )}
      {state.kind === "not_delivered" && (
        <Message
          title="Pas encore possible"
          text={`Vous pourrez donner votre avis dès que votre commande chez ${state.shopName} sera livrée.`}
          slug={slug}
        />
      )}
      {state.kind === "already" && (
        <Message title="Avis déjà enregistré" text={`Merci ! Vous avez déjà donné votre avis pour cette commande chez ${state.shopName}.`} slug={slug} />
      )}
      {state.kind === "form" && (
        <>
          <h1 className="text-center text-xl font-bold">Votre avis sur {state.shopName}</h1>
          <p className="mb-5 mt-1 text-center text-muted">Une note et, si vous le souhaitez, un petit commentaire.</p>
          <ReviewForm slug={slug} token={token} shopName={state.shopName} />
        </>
      )}
    </main>
  );
}

function Message({ title, text, slug, home = false }: { title: string; text: string; slug: string; home?: boolean }) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={home ? "/" : `/${slug}`}>{home ? "Aller à l'accueil" : "Voir la boutique"}</Link>
      </Button>
    </div>
  );
}
