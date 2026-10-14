import "server-only";
import QRCode from "qrcode";

/** QR code en SVG (affichage net à toutes les tailles). Le texte vient toujours de `shopUrl()`. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

/** QR code en PNG (adresse de données) : téléchargeable et imprimable. */
export function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 768, margin: 2, errorCorrectionLevel: "M" });
}
