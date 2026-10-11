"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { Product } from "@/lib/catalog";
import { copyText } from "@/lib/clipboard";
import { formatPrice } from "@/lib/format";
import { networkLinks, shareLink, shareText, type ShareSource } from "@/lib/share";
import { FORMAT_SIZES, makeShareImage, type ShareFormat } from "@/lib/share-image";

type ShareSheetBodyProps = {
  shopName: string;
  shopSlug: string;
  shopLogoUrl: string | null;
  /** Produit à partager ; absent = partage de la boutique entière. */
  product?: Pick<Product, "id" | "name" | "price" | "oldPrice" | "badge" | "images">;
};

const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

/** Partage sur tous les réseaux : menu natif du téléphone, boutons directs, image à télécharger, lien et texte à copier. */
export function ShareSheetBody({ shopName, shopSlug, shopLogoUrl, product }: ShareSheetBodyProps) {
  const [format, setFormat] = useState<ShareFormat>("post");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const promo = product && product.badge === "promo" && product.oldPrice !== null && product.oldPrice > product.price;
  const priceText = product ? plain(formatPrice(product.price)) : "";
  const imageUrl = product ? (product.images[0] ?? shopLogoUrl) : shopLogoUrl;
  const productId = product?.id ?? null;
  const discount = promo && product?.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  // Fabrication de l'image (refaite si le format change).
  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    let created: string | null = null;
    setBlob(null);
    setFailed(false);
    makeShareImage({
      format,
      shopName,
      title: product ? product.name : shopName,
      priceText: product ? priceText : "Boutique en ligne",
      oldPriceText: promo && product?.oldPrice ? plain(formatPrice(product.oldPrice)) : null,
      promoLabel: promo ? (discount > 0 ? `Promo -${discount} %` : "Promo") : null,
      imageUrl,
      displayLink: shareLink(origin, shopSlug, productId, "lien").replace(/^https?:\/\//, "").replace(/\?src=.*$/, ""),
    })
      .then((result) => {
        if (cancelled) return;
        created = URL.createObjectURL(result);
        setBlob(result);
        setPreviewUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, format, productId]);

  const build = useMemo(
    () => (source: ShareSource) => {
      const link = shareLink(origin || "https://wappshop.vercel.app", shopSlug, productId, source);
      return { link, text: shareText({ shopName, productName: product?.name, priceText, link }) };
    },
    [origin, shopSlug, productId, shopName, product?.name, priceText],
  );
  const links = useMemo(() => networkLinks(build), [build]);

  const fileName = `${(product?.name ?? shopName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wappshop"}.png`;
  const canShareFile = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && blob
    ? navigator.canShare({ files: [new File([blob], fileName, { type: "image/png" })] })
    : false;

  async function nativeShare() {
    if (!blob) return;
    const { text } = build("lien");
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], text, title: product?.name ?? shopName });
    } catch {
      // partage annulé par la personne : sans conséquence
    }
  }

  async function copy(value: string, message: string) {
    if (await copyText(value)) toast.success(message);
    else window.prompt("Copiez ce texte :", value);
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted">{product ? "Partagez ce produit avec une belle image et le lien pour commander." : "Partagez votre boutique avec une belle image et son lien."}</p>

      <fieldset className="mb-3">
        <legend className="mb-1 text-sm text-muted">Format de l&apos;image</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FORMAT_SIZES) as ShareFormat[]).map((key) => (
            <Chip key={key} pressed={format === key} onClick={() => setFormat(key)}>
              {FORMAT_SIZES[key].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="mb-3 grid place-items-center rounded-2xl bg-surface p-3">
        {previewUrl && blob ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Aperçu de l'image à partager" className="max-h-[50dvh] w-auto rounded-xl border border-border" />
        ) : failed ? (
          <p className="py-10 text-center text-sm text-muted">L&apos;image n&apos;a pas pu être créée. Vous pouvez quand même partager le lien ci-dessous.</p>
        ) : (
          <p role="status" className="py-10 text-center text-sm text-muted">
            Création de l&apos;image...
          </p>
        )}
      </div>

      {canShareFile && (
        <Button type="button" size="full" onClick={nativeShare}>
          Partager (WhatsApp, Instagram, TikTok, Facebook...)
        </Button>
      )}
      {blob && previewUrl && (
        <Button asChild variant={canShareFile ? "outline" : "default"} size="full" className="mt-2">
          <a href={previewUrl} download={fileName}>
            Télécharger l&apos;image
          </a>
        </Button>
      )}

      <p className="mb-1 mt-4 text-sm font-semibold">Partager le lien directement</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((item) => (
          <Button key={item.source} asChild variant="outline" size="sm">
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {item.label}
            </a>
          </Button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => copy(build("lien").link, "Lien copié")}>
          Copier le lien
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(build("lien").text, "Texte copié")}>
          Copier le texte
        </Button>
      </div>

      <p className="mt-4 rounded-xl bg-surface p-3 text-sm text-muted">
        Instagram, TikTok et Snapchat n&apos;ont pas de bouton de partage pour un site web. Téléchargez l&apos;image, publiez-la, puis collez le lien dans votre
        bio ou votre description (touche « Copier le lien »).
      </p>
    </div>
  );
}
