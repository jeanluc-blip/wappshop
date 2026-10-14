"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { ImagePicker, type PickedImage } from "@/components/dashboard/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage, ImageError } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { removeUploaded, uploadImage } from "@/lib/upload";
import { categoryNameSchema } from "@/lib/validators";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/(dashboard)/dashboard/categories/actions";

export type CategoryItem = { id: string; name: string; imageUrl: string | null; productCount: number };

const PHOTO_SIDE = 400;

function CategoryRow({ category, userId }: { category: CategoryItem; userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success?: string) {
    setBusy(true);
    try {
      const result = await task();
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      if (success) toast.success(success);
      router.refresh();
      return true;
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permet de re-choisir le même fichier
    if (!file) return;

    setBusy(true);
    let path: string | null = null;
    try {
      const { blob, ext } = await compressImage(file, PHOTO_SIDE);
      path = `${userId}/categories/${crypto.randomUUID()}.${ext}`;
      const url = await uploadImage(supabase, "product-images", path, { blob });
      const result = await updateCategory(category.id, { imageUrl: url });
      if (!result.ok) {
        await removeUploaded(supabase, "product-images", [path]);
        toast.error(result.error);
        return;
      }
      toast.success("Photo de la catégorie enregistrée");
      router.refresh();
    } catch (error) {
      if (path) await removeUploaded(supabase, "product-images", [path]);
      toast.error(error instanceof ImageError ? error.message : "Impossible d'envoyer la photo. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const trimmed = name.trim();
  const renamed = trimmed !== category.name;

  return (
    <li>
      <Card className="mb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label={`Changer la photo de la catégorie ${category.name}`}
            className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-surface text-lg font-bold disabled:opacity-50"
          >
            {category.imageUrl ? (
              <Image src={category.imageUrl} alt="" width={48} height={48} sizes="48px" className="h-full w-full object-cover" />
            ) : (
              <Plus size={20} aria-hidden="true" />
            )}
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={onPhoto} className="sr-only" tabIndex={-1} aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <Label htmlFor={`cat-${category.id}`} className="sr-only">
              Nom de la catégorie
            </Label>
            <Input
              id={`cat-${category.id}`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
            <p className="mt-1 text-xs text-muted">
              {category.productCount === 0 ? "Aucun produit" : `${category.productCount} produit${category.productCount > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {renamed && (
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setName(category.name)}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                const parsed = categoryNameSchema.safeParse(name);
                if (!parsed.success) return toast.error(parsed.error.issues[0].message);
                void run(() => updateCategory(category.id, { name: parsed.data }), "Catégorie modifiée");
              }}
            >
              Renommer
            </Button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-start gap-2">
          {category.imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => updateCategory(category.id, { imageUrl: null }), "Photo retirée")}
            >
              Retirer la photo
            </Button>
          )}
          <ConfirmButton
            label="Supprimer"
            size="sm"
            disabled={busy}
            message="Supprimer cette catégorie ? Les produits seront conservés, sans catégorie."
            confirmLabel="Oui, supprimer"
            onConfirm={async () => {
              await run(() => deleteCategory(category.id), "Catégorie supprimée");
            }}
          />
        </div>
      </Card>
    </li>
  );
}

export function CategoryManager({ categories, userId }: { categories: CategoryItem[]; userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const parsed = categoryNameSchema.safeParse(name);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    let path: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (photo[0]) {
        path = `${userId}/categories/${crypto.randomUUID()}.${photo[0].ext}`;
        imageUrl = await uploadImage(supabase, "product-images", path, photo[0]);
      }
      const result = await createCategory(parsed.data, imageUrl);
      if (!result.ok) {
        if (path) await removeUploaded(supabase, "product-images", [path]);
        toast.error(result.error);
        return;
      }
      toast.success("Catégorie ajoutée");
      setName("");
      setPhoto([]);
      router.refresh();
    } catch {
      if (path) await removeUploaded(supabase, "product-images", [path]);
      toast.error("Impossible d'ajouter la catégorie. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card aria-labelledby="new-cat-title">
        <h2 id="new-cat-title" className="mb-3 text-base font-bold">
          Nouvelle catégorie
        </h2>
        <form onSubmit={add} noValidate>
          <Label htmlFor="new-category">Nom</Label>
          <Input
            id="new-category"
            value={name}
            maxLength={60}
            placeholder="Ex. Vêtements"
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
          <p className="mb-1 mt-3 text-sm text-muted">Photo (facultatif : sinon, celle du premier produit)</p>
          <ImagePicker value={photo} onChange={setPhoto} maxSide={PHOTO_SIDE} label={photo.length > 0 ? "Changer la photo" : "Choisir une photo"} />
          <Button type="submit" size="full" className="mt-4" disabled={busy}>
            {busy ? "Ajout…" : "Ajouter la catégorie"}
          </Button>
        </form>
      </Card>

      {categories.length === 0 ? (
        <p className="py-6 text-center text-muted">
          Aucune catégorie pour l&apos;instant. Elles aident vos clients à trouver vos produits plus vite.
        </p>
      ) : (
        <ul aria-label="Vos catégories">
          {categories.map((category) => (
            <CategoryRow key={`${category.id}:${category.name}:${category.imageUrl}`} category={category} userId={userId} />
          ))}
        </ul>
      )}
    </>
  );
}
