"use client";

import { useEffect } from "react";
import { parseSource } from "@/lib/share";

/** Compte la visite de façon anonyme (une fois par session de navigation, sans cookie). */
export function VisitBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `wappshop-visit-${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // stockage indisponible : le serveur évite quand même les doublons rapprochés
    }
    // Origine du visiteur : seulement si l'adresse porte ?src=whatsapp, facebook... (liste fermée).
    const source = parseSource(new URLSearchParams(window.location.search).get("src"));
    const sessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, sessionId);
    } catch {
      // sans conséquence
    }
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, sessionId, source: source ?? undefined }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
