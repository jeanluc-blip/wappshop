import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Assistant administrateur" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Qui dois-je accompagner en priorité aujourd'hui ?",
  "Résume l'état de mes vendeurs en quelques lignes.",
  "Écris un message pour un vendeur qui n'a aucun produit.",
  "Écris un message pour un vendeur qui a des produits mais aucune commande.",
  "Propose-moi une annonce à envoyer à tous mes vendeurs cette semaine.",
  "Fais-moi un plan d'actions pour cette semaine.",
];

export default async function AdminAssistantPage() {
  await requireAdmin();
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <h1 className="text-xl font-bold">Assistant administrateur</h1>
      <p className="mb-3 text-sm text-muted">
        Parlez ou écrivez : il connaît l&apos;état de vos vendeurs (inscriptions, produits, commandes, messages non lus) et vous aide à choisir qui contacter, quoi leur dire
        et quelles idées leur donner. Il propose, vous décidez : il n&apos;envoie rien lui-même.
      </p>
      {enabled ? (
        <AssistantChat endpoint="/api/admin-assistant" suggestions={SUGGESTIONS} emptyText="Choisissez une question ci-dessous, ou posez la vôtre. Vous pouvez aussi dicter." />
      ) : (
        <p role="note" className="rounded-xl border border-border bg-surface p-3 text-sm">
          L&apos;assistant n&apos;est pas encore activé : ajoutez la variable <b>ANTHROPIC_API_KEY</b> dans Vercel (Settings &gt; Environment Variables), puis redéployez.
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Il reçoit les noms de boutiques et des chiffres, jamais les emails, numéros ou données de clients. Ses conseils sont des idées, pas des garanties de résultat.
      </p>
    </>
  );
}
