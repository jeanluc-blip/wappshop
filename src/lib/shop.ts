import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MyShop = {
  id: string;
  user_id: string;
  shop_name: string;
  slug: string;
  logo_url: string | null;
  whatsapp_number: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_address: string | null;
  payment_methods: string[];
  payment_note: string | null;
  about: string | null;
  opening_hours: string | null;
  social_url: string | null;
  announcement: string | null;
};

const SHOP_COLUMNS =
  "id, user_id, shop_name, slug, logo_url, whatsapp_number, delivery_enabled, pickup_enabled, pickup_address, payment_methods, payment_note, about, opening_hours, social_url, announcement";

/** Boutique du vendeur connecté (RLS : uniquement la sienne), ou null s'il n'en a pas encore. */
export const getMyShop = cache(async (): Promise<MyShop | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select(SHOP_COLUMNS).eq("user_id", user.id).maybeSingle<MyShop>();
  return data;
});

/** Pages et actions de l'espace vendeur : session valide + boutique existante (sinon assistant de démarrage). */
export async function requireShop(): Promise<{ user: CurrentUser; shop: MyShop }> {
  const user = await requireUser();
  const shop = await getMyShop();
  if (!shop) redirect("/dashboard");
  return { user, shop };
}

/** Pour les actions serveur : contexte du vendeur connecté, ou null (session expirée / pas de boutique). */
export async function getShopContext(): Promise<{ user: CurrentUser; shop: MyShop } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const shop = await getMyShop();
  return shop ? { user, shop } : null;
}
