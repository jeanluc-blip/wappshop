import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront/Storefront";
import { qrSvg } from "@/lib/qr";
import { slugError } from "@/lib/slug";
import { shopUrl } from "@/lib/site";
import { getStorefront } from "@/lib/storefront";

// Page rendue côté serveur puis mise en cache 60 s ; les modifications du vendeur la renouvellent aussitôt.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slugError(slug)) return {};
  const data = await getStorefront(slug);
  if (!data) return {};
  const { shop } = data;
  const description = shop.about?.slice(0, 160) || `Découvrez le catalogue de ${shop.name} et commandez sur WhatsApp.`;
  return {
    title: shop.name,
    description,
    alternates: { canonical: shopUrl(slug) },
    openGraph: {
      type: "website",
      title: shop.name,
      description,
      url: shopUrl(slug),
      siteName: "WappShop",
      locale: "fr_FR",
      images: shop.logoUrl ? [{ url: shop.logoUrl }] : undefined,
    },
  };
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  // Adresse invalide ou réservée : 404 immédiate, sans interroger la base.
  if (slugError(slug)) notFound();

  const data = await getStorefront(slug);
  if (!data) notFound();

  return <Storefront shop={data.shop} categories={data.categories} products={data.products} zones={data.zones} qrSvg={await qrSvg(shopUrl(slug))} />;
}
