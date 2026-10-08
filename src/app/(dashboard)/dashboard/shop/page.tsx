import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AboutForm } from "@/components/dashboard/AboutForm";
import { DeliveryForm } from "@/components/dashboard/DeliveryForm";
import { ShopInfoForm } from "@/components/dashboard/ShopInfoForm";
import { requireShop } from "@/lib/shop";
import { shopAddress } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS } from "@/lib/validators";

export const metadata: Metadata = { title: "Réglages de la boutique" };

export default async function ShopSettingsPage() {
  const { user, shop } = await requireShop();
  const supabase = await createClient();
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, name, fee, position")
    .eq("shop_id", shop.id)
    .order("position")
    .order("name");

  const host = shopAddress("").replace(/\/$/, "");
  const zoneRows = (zones ?? []).map((zone) => ({ id: zone.id as string, name: zone.name as string, fee: String(zone.fee ?? 0) }));
  const payments = shop.payment_methods.filter((method): method is (typeof PAYMENT_METHODS)[number] =>
    (PAYMENT_METHODS as readonly string[]).includes(method),
  );

  // La clé relance les formulaires avec les valeurs enregistrées après chaque modification.
  const deliveryKey = JSON.stringify([shop.delivery_enabled, shop.pickup_enabled, shop.pickup_address, payments, shop.payment_note, zoneRows]);
  const aboutKey = JSON.stringify([shop.announcement, shop.about, shop.opening_hours, shop.social_url]);

  return (
    <>
      <Link href="/dashboard" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} aria-hidden="true" />
        Accueil
      </Link>
      <h1 className="mb-3 text-xl font-bold">Réglages de la boutique</h1>

      <ShopInfoForm
        key={`${shop.slug}|${shop.logo_url}`}
        userId={user.id}
        host={host}
        initial={{ shopName: shop.shop_name, slug: shop.slug, whatsapp: shop.whatsapp_number, logoUrl: shop.logo_url }}
      />
      <DeliveryForm
        key={deliveryKey}
        initial={{
          deliveryEnabled: shop.delivery_enabled,
          pickupEnabled: shop.pickup_enabled,
          pickupAddress: shop.pickup_address ?? "",
          zones: zoneRows,
          paymentMethods: payments,
          paymentNote: shop.payment_note ?? "",
        }}
      />
      <AboutForm
        key={aboutKey}
        initial={{
          announcement: shop.announcement ?? "",
          about: shop.about ?? "",
          openingHours: shop.opening_hours ?? "",
          socialUrl: shop.social_url ?? "",
        }}
      />
    </>
  );
}
