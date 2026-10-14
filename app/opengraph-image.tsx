import { ImageResponse } from "next/og";

// Image d'aperçu par défaut (WhatsApp, Facebook...) quand une page n'a pas la sienne.
export const alt = "WappShop - Votre boutique en ligne, commandes sur WhatsApp";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#111827",
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 36,
            background: "#25d366",
            color: "#0b1220",
            fontSize: 110,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          W
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 36 }}>WappShop</div>
        <div style={{ fontSize: 36, color: "#6b7280", marginTop: 12 }}>Votre boutique en ligne, commandes sur WhatsApp</div>
      </div>
    ),
    size,
  );
}
