"use client";

import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type CategoryChip = { id: string; name: string; imageUrl: string | null };

type CategoryBarProps = {
  categories: CategoryChip[];
  active: string;
  onSelect: (id: string) => void;
};

function Item({ id, name, active, onSelect, children }: { id: string; name: string; active: boolean; onSelect: (id: string) => void; children: React.ReactNode }) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-pressed={active}
        className={cn("flex w-[72px] cursor-pointer flex-col items-center gap-1.5 text-xs", active ? "font-bold text-foreground" : "text-muted")}
      >
        <span
          className={cn(
            "relative grid h-[60px] w-[60px] place-items-center overflow-hidden rounded-full bg-surface text-xl font-bold text-foreground",
            active && "ring-2 ring-brand ring-offset-2",
          )}
        >
          {children}
        </span>
        <span className="w-full truncate">{name}</span>
      </button>
    </li>
  );
}

/** Pastilles rondes de 60 px, défilement horizontal, barre collante en haut. « Tout » en premier. */
export function CategoryBar({ categories, active, onSelect }: CategoryBarProps) {
  return (
    <nav aria-label="Catégories" className="sticky top-0 z-30 border-b border-border bg-background">
      <ul className="mx-auto flex max-w-5xl gap-3 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Item id="all" name="Tout" active={active === "all"} onSelect={onSelect}>
          <LayoutGrid size={24} aria-hidden="true" />
        </Item>
        {categories.map((category) => (
          <Item key={category.id} id={category.id} name={category.name} active={active === category.id} onSelect={onSelect}>
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniature de 60 px : <img> léger, chargé en différé
              <img src={category.imageUrl} alt="" loading="lazy" decoding="async" width={60} height={60} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{category.name.slice(0, 1).toUpperCase()}</span>
            )}
          </Item>
        ))}
      </ul>
    </nav>
  );
}
