import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { HomePanel, type StartItem } from "@/components/dashboard/HomePanel";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { CHECKOUT_ENABLED } from "@/lib/features";
import { qrPngDataUrl, qrSvg } from "@/lib/qr";
import { getMyShop } from "@/lib/shop";
import { shopAddress, shopUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { DEMO_WHATSAPP } from "@/lib/validators";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();
  const shop = await getMyShop();

  // Première connexion : assistant en 3 étapes.
  if (!shop) return <OnboardingWizard userId={user.id} />;

  const supabase = await createClient();
  const [categories, products, zones] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("delivery_zones").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
  ]);

  const items: StartItem[] = [
    { label: "Ajouter votre logo", done: Boolean(shop.logo_url), href: "/dashboard/shop#infos" },
    { label: "Configurer votre vrai numéro WhatsApp", done: shop.whatsapp_number !== DEMO_WHATSAPP, href: "/dashboard/shop#infos" },
    { label: "Créer une catégorie", done: (categories.count ?? 0) >= 1, href: "/dashboard/categories" },
    { label: `Ajouter 5 produits (${Math.min(products.count ?? 0, 5)}/5)`, done: (products.count ?? 0) >= 5, href: "/dashboard/products/new" },
    {
      label: "Définir livraison ou retrait",
      done: (zones.count ?? 0) > 0 || (shop.pickup_enabled && Boolean(shop.pickup_address)),
      href: "/dashboard/shop#livraison",
    },
  ];

  const link = shopUrl(shop.slug);
  const [svg, png] = await Promise.all([qrSvg(link), qrPngDataUrl(link)]);

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">{shop.shop_name}</h1>

      {!CHECKOUT_ENABLED && (
        <div role="note" className="mb-3 flex gap-3 rounded-2xl bg-surface p-4 text-sm">
          <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <b>Accès anticipé :</b> préparez votre boutique (catégories, produits, livraison). Les commandes de vos
            clients sur WhatsApp arrivent bientôt.
          </p>
        </div>
      )}

      <HomePanel
        shopId={shop.id}
        shopPath={`/${shop.slug}`}
        shopLink={link}
        shopAddress={shopAddress(shop.slug)}
        qrSvg={svg}
        qrPng={png}
        items={items}
      />

      <Card>
        <Link href="/dashboard/shop" className="flex min-h-11 items-center justify-between">
          <span>
            <b className="block text-base">Réglages de la boutique</b>
            <span className="text-sm text-muted">Nom, adresse, WhatsApp, livraison, paiement, page À propos</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      </Card>
    </>
  );
}
