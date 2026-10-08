"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

type PhotoGalleryProps = {
  images: string[];
  alt: string;
  sizes: string;
  /** Ratio de la zone : carré dans la grille, 4/3 dans la fiche produit. */
  ratio?: "square" | "wide";
  /** Charge la première photo en priorité (produits visibles dès l'ouverture). */
  priority?: boolean;
  /** Miniatures cliquables (ordinateur uniquement), pour la fiche produit. */
  thumbnails?: boolean;
  overlay?: React.ReactNode;
};

/**
 * Galerie swipeable sans bibliothèque : défilement CSS avec scroll-snap, un doigt = une photo.
 * Points + compteur « 1/5 » seulement s'il y a plusieurs photos ; flèches et miniatures sur ordinateur.
 */
export function PhotoGallery({ images, alt, sizes, ratio = "square", priority = false, thumbnails = false, overlay }: PhotoGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex((current) => (current === next ? current : next));
  }

  function goTo(target: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(count - 1, target));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  const aspect = ratio === "wide" ? "aspect-[4/3]" : "aspect-square";

  return (
    <div>
      <div className="group relative overflow-hidden rounded-xl bg-surface">
        {count === 0 ? (
          <div className={cn("grid w-full place-items-center text-muted", aspect)}>
            <ShoppingBag size={40} aria-hidden="true" />
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onScroll={count > 1 ? onScroll : undefined}
            role="group"
            aria-roledescription="carrousel"
            aria-label={`Photos de ${alt}`}
            tabIndex={count > 1 ? 0 : undefined}
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((src, i) => (
              <div key={src} className={cn("relative w-full shrink-0 snap-center", aspect)}>
                <Image
                  src={src}
                  alt={count > 1 ? `${alt} - photo ${i + 1} sur ${count}` : alt}
                  fill
                  sizes={sizes}
                  draggable={false}
                  priority={priority && i === 0}
                  loading={priority && i === 0 ? undefined : "lazy"}
                  className="select-none object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {overlay}

        {count > 1 && (
          <>
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-foreground/70 px-2 py-0.5 text-xs text-white" aria-hidden="true">
              {index + 1}/{count}
            </span>
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden="true">
              {images.map((src, i) => (
                <i
                  key={src}
                  className={cn(
                    "h-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.2)] transition-[width] duration-200",
                    i === index ? "w-4 bg-white" : "w-1.5 bg-white/65",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-background/90 shadow disabled:opacity-0 md:grid"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === count - 1}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-background/90 shadow disabled:opacity-0 md:grid"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {thumbnails && count > 1 && (
        <ul className="mt-2 hidden gap-2 md:flex" aria-label="Miniatures">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Voir la photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block h-14 w-14 cursor-pointer overflow-hidden rounded-lg border-2",
                  i === index ? "border-foreground" : "border-transparent",
                )}
              >
                <Image src={src} alt="" fill sizes="56px" quality={60} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
