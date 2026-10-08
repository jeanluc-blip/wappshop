"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, Circle, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyText } from "@/lib/clipboard";

export type StartItem = { label: string; done: boolean; href: string };

type HomePanelProps = {
  shopId: string;
  shopPath: string;
  shopLink: string;
  shopAddress: string;
  qrSvg: string;
  qrPng: string;
  items: StartItem[];
};

const COPIED_EVENT = "wappshop:link-copied";
const copiedKey = (shopId: string) => `wappshop:link-copied:${shopId}`;

function readCopied(shopId: string): boolean {
  try {
    return localStorage.getItem(copiedKey(shopId)) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COPIED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COPIED_EVENT, onChange);
  };
}

/** Accueil vendeur : liste de démarrage, lien de la boutique à copier, QR code. */
export function HomePanel({ shopId, shopPath, shopLink, shopAddress, qrSvg, qrPng, items }: HomePanelProps) {
  const copied = useSyncExternalStore(
    subscribe,
    () => readCopied(shopId),
    () => false,
  );

  async function copyLink() {
    if (await copyText(shopLink)) {
      toast.success("Lien copié");
    } else {
      window.prompt("Copiez ce lien :", shopLink);
    }
    try {
      localStorage.setItem(copiedKey(shopId), "1");
      window.dispatchEvent(new Event(COPIED_EVENT));
    } catch {
      // stockage indisponible : la case « lien copié » ne sera simplement pas cochée
    }
  }

  const checklist = [...items, { label: "Copier le lien de votre boutique", done: copied, href: "#lien" }];
  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <>
      {doneCount < checklist.length && (
        <Card aria-labelledby="start-title">
          <h2 id="start-title" className="text-base font-bold">
            Pour bien démarrer
          </h2>
          <div className="mb-3 mt-2 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Progression de la liste de démarrage"
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-valuenow={doneCount}
              className="h-2 flex-1 overflow-hidden rounded-full bg-border"
            >
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>
            <span className="text-sm text-muted">
              {doneCount}/{checklist.length}
            </span>
          </div>
          <ul>
            {checklist.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 text-[15px]"
                  aria-label={`${item.label} : ${item.done ? "fait" : "à faire"}`}
                >
                  {item.done ? (
                    <Check size={20} className="shrink-0 text-[#166534]" aria-hidden="true" />
                  ) : (
                    <Circle size={20} className="shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span className={item.done ? "text-muted line-through" : ""}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card id="lien" aria-labelledby="link-title">
        <h2 id="link-title" className="text-base font-bold">
          Lien public de la boutique
        </h2>
        <p className="mb-3 mt-1 break-all text-sm text-muted">{shopAddress}</p>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={copyLink}>
            Copier le lien de ma boutique
          </Button>
          <Button asChild variant="outline">
            <Link href={shopPath} target="_blank" aria-label="Voir ma boutique (nouvel onglet)">
              <ExternalLink size={18} aria-hidden="true" />
              Voir
            </Link>
          </Button>
        </div>
        <div className="mt-5 text-center">
          <div
            role="img"
            aria-label="QR code de votre boutique"
            className="mx-auto inline-block h-48 w-48 rounded-xl border border-border bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-2 text-sm text-muted">Affichez ce QR code en boutique : vos clients arrivent directement sur votre catalogue.</p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <a href={qrPng} download={`qr-${shopId.slice(0, 8)}.png`}>
              <Download size={16} aria-hidden="true" />
              Télécharger le QR code (PNG)
            </a>
          </Button>
        </div>
      </Card>
    </>
  );
}
