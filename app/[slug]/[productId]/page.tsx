import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront/Storefront";
import { formatPrice } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/orders";
import { qrSvg } from "@/lib/qr";
import { slugError } from "@/lib/slug";
import { shopUrl } from "@/lib/site";
import { getStorefront } from "@/lib/storefront";

// Lien direct vers un produit : https://.../{boutique}/{id du produit}.
// La boutique s'ouvre avec la fiche du produit affichée ; les balises Open Graph donnent à WhatsApp
// une carte avec la photo et le prix.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string; productId: string }> };

const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params;
  if (slugError(slug) || !UUID_PATTERN.test(productId)) return {};
  const data = await getStorefront(slug);
  const product = data?.products.find((item) => item.id === productId);
  if (!data || !product) return {};

  const url = `${shopUrl(slug)}/${product.id}`;
  const title = `${product.name} - ${data.shop.name}`;
  const description = [plain(formatPrice(product.price)), product.description?.slice(0, 140)].filter(Boolean).join(" · ");
  const image = product.images[0] ?? data.shop.logoUrl ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "WappShop",
      locale: "fr_FR",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productId } = await params;
  if (slugError(slug) || !UUID_PATTERN.test(productId)) notFound();

  const data = await getStorefront(slug);
  if (!data || !data.products.some((product) => product.id === productId)) notFound();

  return (
    <Storefront
      shop={data.shop}
      categories={data.categories}
      products={data.products}
      zones={data.zones}
      trust={data.trust}
      qrSvg={await qrSvg(shopUrl(slug))}
      initialProductId={productId}
    />
  );
}
