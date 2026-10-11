import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { CreateCodeForm } from "@/components/auth/CreateCodeForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Créer mon code secret" };

// Étape après le code reçu par email : le vendeur choisit le code secret qu'il gardera pour ses prochaines connexions.
export default async function CreateCodePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <Logo size={72} priority className="mx-auto mb-3 rounded-[16px]" />
      <h1 className="text-center text-xl font-bold">Créez votre code secret</h1>
      <p className="mt-2 text-center text-muted">
        Vous l&apos;utiliserez avec votre email pour vous connecter, sans attendre de code par email.
      </p>
      <CreateCodeForm />
    </main>
  );
}
