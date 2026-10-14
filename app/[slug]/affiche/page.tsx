import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { qrSvg } from "@/lib/qr";
import { slugError } from "@/lib/slug";
import { shopAddress, shopUrl } from "@/lib/site";
import { getStorefront } from "@/lib/storefront";
import { PrintButton } from "./PrintButton";

// Affiche à imprimer (A4) : nom de la boutique, QR code et adresse. Les visiteurs arrivés par ce QR code sont comptés
// dans les statistiques sous « QR code / affiche ».
export const revalidate = 60;
export const metadata: Metadata = { title: "Affiche de la boutique", robots: { index: false, follow: false } };

export default async function PosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slugError(slug)) notFound();
  const data = await getStorefront(slug);
  if (!data) notFound();

  const svg = await qrSvg(`${shopUrl(slug)}?src=qr`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center px-6 py-8 text-center print:min-h-0 print:max-w-none print:py-4">
      <div className="mb-6 flex gap-2 print:hidden">
        <PrintButton />
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-[15px] font-semibold">
          Retour
        </Link>
      </div>

      <section aria-label="Affiche" className="flex w-full flex-col items-center rounded-3xl border-2 border-foreground p-8 print:border-0">
        {data.shop.logoUrl ? (
          <Image src={data.shop.logoUrl} alt="" width={112} height={112} sizes="112px" priority className="h-28 w-28 rounded-3xl border border-border object-cover" />
        ) : (
          <Logo size={112} />
        )}
        <h1 className="mt-4 text-4xl font-extrabold leading-tight">{data.shop.name}</h1>
        <p className="mt-2 text-2xl font-semibold">Commandez sur WhatsApp</p>

        <div
          role="img"
          aria-label={`QR code de la boutique ${data.shop.name}`}
          className="my-6 h-72 w-72 rounded-2xl border border-border bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="text-xl font-semibold">Scannez pour voir nos produits</p>
        <p className="mt-2 break-all text-lg text-muted">{shopAddress(slug)}</p>
      </section>
    </main>
  );
}
