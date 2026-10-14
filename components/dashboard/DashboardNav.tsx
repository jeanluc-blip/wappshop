"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, ClipboardList, House, LayoutGrid, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Accueil", icon: House, match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/shop") },
  { href: "/dashboard/categories", label: "Catégories", icon: LayoutGrid, match: (p: string) => p.startsWith("/dashboard/categories") },
  { href: "/dashboard/products", label: "Catalogue", icon: Package, match: (p: string) => p.startsWith("/dashboard/products") },
  { href: "/dashboard/orders", label: "Commandes", icon: ClipboardList, match: (p: string) => p.startsWith("/dashboard/orders") },
  { href: "/dashboard/stats", label: "Stats", icon: ChartColumn, match: (p: string) => p.startsWith("/dashboard/stats") },
] as const;

/** Navigation du bas (mobile d'abord) : zones tactiles de 56 px. */
export function DashboardNav({ newOrders = 0 }: { newOrders?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "font-bold text-foreground shadow-[inset_0_-3px_0_var(--brand)]" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon size={20} aria-hidden="true" />
                  {href === "/dashboard/orders" && newOrders > 0 && (
                    <span className="absolute -right-3 -top-2 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-on-brand">
                      <span aria-hidden="true">{newOrders > 99 ? "99+" : newOrders}</span>
                      <span className="sr-only">{newOrders} nouvelle{newOrders > 1 ? "s" : ""} commande{newOrders > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
