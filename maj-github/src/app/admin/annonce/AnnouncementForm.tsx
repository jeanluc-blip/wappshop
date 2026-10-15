"use client";

import { useState } from "react";
import { toast } from "sonner";
import { sendAnnouncement } from "@/app/admin/actions";
import type { Audience } from "@/lib/admin-audience";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Counts = { all: number; no_products: number; no_orders: number };

const IDEAS = [
  "Astuce de la semaine : partagez chaque jour un de vos produits sur votre statut WhatsApp avec le bouton Partager. C'est la méthode qui amène le plus de clients.",
  "Pensez à demander un avis à vos clients après chaque livraison (onglet Commandes) : les avis rassurent les nouveaux acheteurs.",
  "Cette semaine, mettez un produit en promotion : ajoutez un prix barré et l'étiquette Promo depuis votre catalogue.",
];

export function AnnouncementForm({ counts }: { counts: Counts }) {
  const [audience, setAudience] = useState<Audience>("all");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const recipients = counts[audience];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || body.trim() === "") return;
    if (!window.confirm(`Envoyer cette annonce à ${recipients} vendeur${recipients > 1 ? "s" : ""} ?`)) return;
    setSending(true);
    try {
      const result = await sendAnnouncement(audience, body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Annonce envoyée à ${result.data.count} vendeur${result.data.count > 1 ? "s" : ""}`);
      setBody("");
    } catch {
      toast.error("Envoi impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-3">
        <Label htmlFor="audience">Destinataires</Label>
        <Select id="audience" value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
          <option value="all">Tous les vendeurs ({counts.all})</option>
          <option value="no_products">Vendeurs sans produit ({counts.no_products})</option>
          <option value="no_orders">Vendeurs sans commande ({counts.no_orders})</option>
        </Select>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Idées d'annonces">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setBody(idea)}
            className="min-h-9 cursor-pointer rounded-full border border-border bg-background px-3 text-left text-xs hover:bg-surface"
          >
            {idea.slice(0, 46)}...
          </button>
        ))}
      </div>

      <Label htmlFor="announcement-body">Message</Label>
      <Textarea id="announcement-body" value={body} onChange={(event) => setBody(event.target.value.slice(0, 2000))} maxLength={2000} className="min-h-32" />
      <p className="mb-3 mt-1 text-right text-xs text-muted">{body.length}/2000</p>

      <Button type="submit" size="full" disabled={sending || body.trim() === "" || recipients === 0}>
        {sending ? "Envoi..." : `Envoyer à ${recipients} vendeur${recipients > 1 ? "s" : ""}`}
      </Button>
      <p className="mt-2 text-center text-xs text-muted">Chaque vendeur reçoit l&apos;annonce dans son onglet Messages, avec une pastille.</p>
    </form>
  );
}
