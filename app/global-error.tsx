"use client";

// Dernier filet de sécurité (erreur dans la structure même du site) : styles intégrés, car la feuille de style n'est pas chargée ici.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#111827" }}>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Une erreur est survenue</h1>
          <p style={{ color: "#6b7280" }}>Réessayez dans un instant.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#25d366", color: "#0b1220", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
