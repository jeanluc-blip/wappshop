import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // chaque page admin revérifie l'accès : jamais de contenu sans administrateur connecté

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo size={32} />
            <b className="text-[17px]">Administration</b>
          </Link>
          <nav aria-label="Administration" className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-lg px-3 py-2 font-semibold hover:bg-surface">
              Vendeurs
            </Link>
            <Link href="/admin/annonce" className="rounded-lg px-3 py-2 font-semibold hover:bg-surface">
              Annonce
            </Link>
          </nav>
          <Link href="/dashboard" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface">
            Mon espace vendeur
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}
