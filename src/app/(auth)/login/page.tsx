import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error
    ? "La connexion avec Google n'a pas abouti. Réessayez ou utilisez votre email."
    : null;

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <Logo size={84} priority className="mx-auto mb-3 rounded-[18px]" />
      <h1 className="text-center text-xl font-bold">WappShop</h1>
      <LoginForm initialError={initialError} />
    </main>
  );
}
