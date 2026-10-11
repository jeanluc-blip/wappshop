"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePicker, type PickedImage } from "@/components/dashboard/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { removeUploaded, uploadImage } from "@/lib/upload";
import { updateBanner, type LogoChange } from "@/app/(dashboard)/dashboard/shop/actions";

type BannerFormProps = { userId: string; initial: { title: string; imageUrl: string | null } };

/** Bannière affichée en haut de la boutique : un titre, une photo (facultative) et le bouton « Découvrir ». */
export function BannerForm({ userId, initial }: BannerFormProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState(initial.title);
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      let image: LogoChange = clear || imageRemoved ? { action: "remove" } : { action: "keep" };
      if (!clear && picked[0]) {
        uploadedPath = `${userId}/banner/${crypto.randomUUID()}.${picked[0].ext}`;
        image = { action: "set", url: await uploadImage(supabase, "product-images", uploadedPath, picked[0]) };
      }
      const result = await updateBanner(clear ? "" : title, image);
      if (!result.ok) {
        await removeUploaded(supabase, "product-images", uploadedPath ? [uploadedPath] : []);
        toast.error(result.error);
        return;
      }
      toast.success(clear ? "Bannière retirée" : "Bannière enregistrée");
      if (clear) setTitle("");
      setPicked([]);
      setImageRemoved(false);
      router.refresh();
    } catch {
      await removeUploaded(supabase, "product-images", uploadedPath ? [uploadedPath] : []);
      toast.error("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const showCurrent = initial.imageUrl && !imageRemoved && picked.length === 0;

  return (
    <Card id="banniere" aria-labelledby="banner-title">
      <h2 id="banner-title" className="mb-1 text-base font-bold">
        Bannière de la boutique
      </h2>
      <p className="mb-3 text-sm text-muted">Une grande bannière verte en haut de votre boutique. Elle apparaît dès que vous ajoutez un titre ou une photo.</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Label htmlFor="banner-title-input">Titre de la bannière</Label>
        <Input
          id="banner-title-input"
          value={title}
          maxLength={80}
          placeholder="Ex. Nouvelle collection disponible"
          onChange={(event) => setTitle(event.target.value)}
        />

        <p className="mb-1 mt-3 text-sm text-muted">Photo (facultatif : de préférence une personne ou un produit détouré)</p>
        {showCurrent && (
          <div className="mb-2 flex items-center gap-3">
            <Image
              src={initial.imageUrl!}
              alt="Photo actuelle de la bannière"
              width={96}
              height={64}
              sizes="96px"
              className="h-16 w-24 rounded-xl border border-border object-cover"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setImageRemoved(true)}>
              Retirer la photo
            </Button>
          </div>
        )}
        <ImagePicker
          value={picked}
          onChange={setPicked}
          maxSide={900}
          label={showCurrent || picked.length > 0 ? "Changer la photo" : "Choisir une photo"}
        />

        <Button type="submit" size="full" className="mt-5" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer la bannière"}
        </Button>
        {(initial.title || initial.imageUrl) && (
          <Button type="button" variant="ghost" size="full" className="mt-2" disabled={busy} onClick={() => void save(true)}>
            Retirer la bannière
          </Button>
        )}
      </form>
    </Card>
  );
}
