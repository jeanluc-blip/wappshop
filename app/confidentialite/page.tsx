import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Politique de confidentialité" };

// Remplacez cette adresse par votre email de contact.
const CONTACT_EMAIL = "jeanluckpekpede@gmail.com";
const LAST_UPDATE = "8 octobre 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="mb-6 flex items-center gap-3">
        <Logo size={40} className="rounded-[10px]" />
        <span className="text-lg font-bold">WappShop</span>
      </Link>

      <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {LAST_UPDATE}</p>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Qui sommes-nous ?</h2>
        <p>
          WappShop permet à des vendeurs de créer une boutique en ligne et de recevoir leurs commandes sur
          WhatsApp. Cette page explique quelles données nous utilisons et pourquoi.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Données des vendeurs (compte)</h2>
        <p>Quand vous créez un compte, nous recevons :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>votre adresse email, pour vous connecter (par code ou avec Google) ;</li>
          <li>
            si vous utilisez « Continuer avec Google » : uniquement votre adresse email et les informations de
            base de votre profil Google. Nous n&apos;accédons ni à vos contacts, ni à vos documents, ni à
            votre messagerie.
          </li>
        </ul>
        <p>
          Vous renseignez ensuite les informations de votre boutique : nom, photos, produits, prix, zones de
          livraison et numéro WhatsApp. Ces informations sont affichées sur votre boutique publique.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Données des clients</h2>
        <p>
          Les clients n&apos;ont pas de compte. Les informations saisies pour passer commande (par exemple
          nom, téléphone, adresse de livraison) sont transmises au vendeur de la boutique concernée pour
          traiter la commande.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Visites des boutiques</h2>
        <p>
          Nous comptons les visites pour fournir des statistiques aux vendeurs. Ce comptage est anonyme : pas
          de cookie, pas d&apos;adresse IP enregistrée, pas d&apos;identité.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">À quoi servent ces données ?</h2>
        <p>
          Uniquement à faire fonctionner le service : vous connecter, afficher votre boutique, transmettre les
          commandes et fournir des statistiques. Nous ne vendons pas vos données et ne les utilisons pas pour
          de la publicité.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Hébergement et prestataires</h2>
        <p>
          Les données sont stockées chez Supabase (base de données et authentification) et le site est
          hébergé par Vercel. La connexion Google est fournie par Google.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Vos droits</h2>
        <p>
          Vous pouvez demander l&apos;accès, la correction ou la suppression de votre compte et de vos
          données à tout moment en écrivant à{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Pour toute question :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <p className="mt-10 text-sm text-muted">
        <Link href="/" className="underline">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
