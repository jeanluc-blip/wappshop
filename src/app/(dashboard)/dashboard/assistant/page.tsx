import type { Metadata } from "next";
import Link from "next/link";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { assistantEnabled } from "@/lib/assistant-llm";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Assistant de vente" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const { shop } = await requireShop();
  const enabled = assistantEnabled();

  return (
    <>
      <h1 className="text-xl font-bold">Assistant de vente</h1>
      <p className="mb-3 text-sm text-muted">
        Posez vos questions à voix haute ou par écrit : idées de promotions, textes pour votre statut WhatsApp, conseils pour vendre plus. Il connaît les chiffres de{" "}
        {shop.shop_name}.
      </p>
      {enabled ? (
        <AssistantChat />
      ) : (
        <p role="note" className="rounded-xl border border-border bg-surface p-3 text-sm">
          L&apos;assistant sera disponible très bientôt. En attendant, vous pouvez écrire à l&apos;équipe dans{" "}
          <Link href="/dashboard/messages" className="font-semibold underline underline-offset-2">
            l&apos;onglet Messages
          </Link>
          .
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Les conseils de l&apos;assistant sont des idées, pas des garanties de résultat. Pour la dictée vocale, votre navigateur peut envoyer le son à son fournisseur
        (Google pour Chrome) afin de le transcrire.
      </p>
    </>
  );
}
