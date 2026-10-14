import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

// Page d'accueil provisoire (la vraie page marketing viendra au lancement : voir LANCEMENT.md).
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 py-10 text-center">
      <Logo size={96} priority className="mb-4 rounded-[20px]" />
      <h1 className="text-2xl font-bold">WappShop</h1>
      <p className="mt-2 text-muted">
        Créez votre boutique en ligne et recevez vos commandes sur WhatsApp.
      </p>
      <Button asChild size="full" className="mt-6">
        <Link href="/login">Créer ma boutique gratuitement</Link>
      </Button>
      <p className="mt-3 text-sm text-muted">
        Déjà inscrit ? <Link href="/login" className="underline">Se connecter</Link>
      </p>
    </main>
  );
}
