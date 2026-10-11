"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";

type ShopBannerProps = {
  shopName: string;
  title: string | null;
  imageUrl: string | null;
  onDiscover: () => void;
};

/** Grande bannière verte (titre, bouton « Découvrir », photo à droite) : comme sur la maquette de l'affiche. */
export function ShopBanner({ shopName, title, imageUrl, onDiscover }: ShopBannerProps) {
  return (
    <section
      aria-label="Bannière de la boutique"
      className="relative mb-4 flex min-h-40 items-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b5a31] to-[#178a4b] text-white"
    >
      <div className={`relative z-10 p-5 sm:p-8 ${imageUrl ? "max-w-[62%]" : "max-w-full"}`}>
        <p className="text-xl font-bold leading-tight sm:text-3xl">{title || `Bienvenue chez ${shopName}`}</p>
        <button
          type="button"
          onClick={onDiscover}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#0b5a31]"
        >
          Découvrir
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      {imageUrl && (
        <div className="absolute inset-y-0 right-0 w-[42%]">
          <Image src={imageUrl} alt="" fill sizes="(min-width: 640px) 320px, 42vw" priority className="object-cover object-top" />
        </div>
      )}
    </section>
  );
}
