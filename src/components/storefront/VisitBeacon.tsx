"use client";

import { useEffect } from "react";

/** Compte la visite de façon anonyme (une fois par session de navigation, sans cookie). */
export function VisitBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `wappshop-visit-${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // stockage indisponible : le serveur évite quand même les doublons rapprochés
    }
    const sessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, sessionId);
    } catch {
      // sans conséquence
    }
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, sessionId }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
