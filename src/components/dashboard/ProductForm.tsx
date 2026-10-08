"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { PhotoManager, type PhotoItem } from "@/components/dashboard/PhotoManager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { removeUploaded, uploadImage } from "@/lib/upload";
import { MAX_PRODUCT_IMAGES, MAX_VARIANTS, productFormSchema, type ProductFormValues } from "@/lib/validators";
import { deleteProduct, saveProduct } from "@/app/(dashboard)/dashboard/products/actions";

type ProductFormProps = {
  userId: string;
  categories: { id: string; name: string }[];
  /** Absent : création d'un produit. */
  product?: { id: string; values: ProductFormValues; imageUrls: string[] };
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  price: "",
  badge: "none",
  oldPrice: "",
  soldOut: false,
  description: "",
  categoryId: "",
  variants: [],
};

const isBlankVariant = (variant: { name: string; value: string; supplement: string }) =>
  !variant.name.trim() && !variant.value.trim() && !variant.supplement.trim();

export function ProductForm({ userId, categories, product }: ProductFormProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (product?.imageUrls ?? []).map((url) => ({ id: crypto.randomUUID(), kind: "saved" as const, url })),
  );
  const [status, setStatus] = useState<string | null>(null);
  const busy = status !== null;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product?.values ?? EMPTY_VALUES,
  });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const { errors } = form.formState;
  const badge = useWatch({ control: form.control, name: "badge" });

  async function onSubmit(values: ProductFormValues) {
    const uploaded: string[] = [];
    try {
      // 1. Envoi des nouvelles photos (dans le dossier du vendeur), en gardant l'ordre choisi.
      const newCount = photos.filter((photo) => photo.kind === "new").length;
      const imageUrls: string[] = [];
      let sent = 0;
      for (const photo of photos) {
        if (photo.kind === "saved") {
          imageUrls.push(photo.url);
          continue;
        }
        sent += 1;
        setStatus(`Envoi des photos ${sent}/${newCount}…`);
        const path = `${userId}/${product?.id ?? "new"}/${crypto.randomUUID()}.${photo.ext}`;
        const url = await uploadImage(supabase, "product-images", path, photo);
        uploaded.push(path);
        imageUrls.push(url);
      }

      // 2. Enregistrement : validation et droits revérifiés côté serveur.
      setStatus("Enregistrement…");
      const result = await saveProduct({ id: product?.id, values, imageUrls });
      if (!result.ok) {
        await removeUploaded(supabase, "product-images", uploaded);
        const field = result.field as keyof ProductFormValues | undefined;
        if (field && ["name", "price", "oldPrice", "categoryId", "description"].includes(field)) {
          form.setError(field, { message: result.error });
        }
        toast.error(result.error);
        return;
      }
      toast.success("Produit enregistré");
      router.push("/dashboard/products");
      router.refresh();
    } catch {
      await removeUploaded(supabase, "product-images", uploaded);
      toast.error("Enregistrement impossible : une photo n'a peut-être pas pu être envoyée. Réessayez.");
    } finally {
      setStatus(null);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    // Les lignes de variantes laissées vides sont ignorées au lieu de bloquer l'enregistrement.
    const current = form.getValues("variants");
    if (current.some(isBlankVariant)) variants.replace(current.filter((variant) => !isBlankVariant(variant)));
    return form.handleSubmit(onSubmit)(event);
  }

  async function remove() {
    if (!product) return;
    setStatus("Suppression…");
    try {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Produit supprimé");
      router.push("/dashboard/products");
      router.refresh();
    } catch {
      toast.error("Suppression impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form noValidate onSubmit={submit} aria-busy={busy}>
      <Card aria-labelledby="p-info">
        <h2 id="p-info" className="sr-only">
          Informations du produit
        </h2>
        <Label htmlFor="name">Titre</Label>
        <Input id="name" aria-invalid={errors.name ? true : undefined} {...form.register("name")} />
        <FieldError message={errors.name?.message} />

        <Label htmlFor="price" className="mt-3">
          Prix ({CURRENCY})
        </Label>
        <Input
          id="price"
          inputMode="decimal"
          placeholder="5000"
          aria-invalid={errors.price ? true : undefined}
          {...form.register("price")}
        />
        <FieldError message={errors.price?.message} />

        <Label htmlFor="description" className="mt-3">
          Description
        </Label>
        <Textarea id="description" rows={4} aria-invalid={errors.description ? true : undefined} {...form.register("description")} />
        <FieldError message={errors.description?.message} />

        <Label htmlFor="categoryId" className="mt-3">
          Catégorie
        </Label>
        <Select id="categoryId" {...form.register("categoryId")}>
          <option value="">Sans catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Label htmlFor="badge" className="mt-3">
          Étiquette
        </Label>
        <Select id="badge" {...form.register("badge")}>
          <option value="none">Aucune</option>
          <option value="new">Nouveau</option>
          <option value="promo">Promo</option>
        </Select>

        {badge === "promo" && (
          <>
            <Label htmlFor="oldPrice" className="mt-3">
              Ancien prix barré ({CURRENCY})
            </Label>
            <Input
              id="oldPrice"
              inputMode="decimal"
              aria-invalid={errors.oldPrice ? true : undefined}
              {...form.register("oldPrice")}
            />
            <FieldError message={errors.oldPrice?.message} />
          </>
        )}

        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" className="h-5 w-5 accent-[#25d366]" {...form.register("soldOut")} />
          <span>
            Produit épuisé
            <span className="block text-sm text-muted">Affiché « Épuisé » : vos clients ne peuvent pas le commander.</span>
          </span>
        </label>
      </Card>

      <Card aria-labelledby="p-photos">
        <h2 id="p-photos" className="mb-3 text-base font-bold">
          Photos
        </h2>
        <PhotoManager value={photos} onChange={setPhotos} max={MAX_PRODUCT_IMAGES} disabled={busy} />
      </Card>

      <Card aria-labelledby="p-variants">
        <h2 id="p-variants" className="mb-1 text-base font-bold">
          Variantes
        </h2>
        <p className="mb-3 text-sm text-muted">
          Taille, couleur, pointure… Le supplément s&apos;ajoute au prix de base (facultatif).
        </p>
        <ul>
          {variants.fields.map((field, index) => (
            <li key={field.id} className="mb-3 rounded-xl border border-border p-2">
              <div className="flex gap-2">
                <Input
                  aria-label={`Option de la variante ${index + 1}`}
                  placeholder="Option (Taille)"
                  aria-invalid={errors.variants?.[index]?.name ? true : undefined}
                  {...form.register(`variants.${index}.name`)}
                />
                <Input
                  aria-label={`Valeur de la variante ${index + 1}`}
                  placeholder="Valeur (L)"
                  aria-invalid={errors.variants?.[index]?.value ? true : undefined}
                  {...form.register(`variants.${index}.value`)}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  aria-label={`Supplément de prix de la variante ${index + 1}`}
                  inputMode="decimal"
                  placeholder={`Supplément (${CURRENCY})`}
                  aria-invalid={errors.variants?.[index]?.supplement ? true : undefined}
                  {...form.register(`variants.${index}.supplement`)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-11 shrink-0 px-0"
                  aria-label={`Supprimer la variante ${index + 1}`}
                  onClick={() => variants.remove(index)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </Button>
              </div>
              <FieldError
                message={
                  errors.variants?.[index]?.name?.message ??
                  errors.variants?.[index]?.value?.message ??
                  errors.variants?.[index]?.supplement?.message
                }
              />
            </li>
          ))}
        </ul>
        <FieldError message={errors.variants?.message} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={variants.fields.length >= MAX_VARIANTS}
          onClick={() => {
            const last = form.getValues("variants").at(-1);
            variants.append({ name: last?.name ?? "", value: "", supplement: "" });
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter une variante
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => router.push("/dashboard/products")}>
          Annuler
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {status ?? "Enregistrer le produit"}
        </Button>
      </div>

      {product && (
        <div className="mt-4">
          <ConfirmButton
            label="Supprimer le produit"
            size="full"
            disabled={busy}
            message="Supprimer ce produit et ses photos ? Cette action est définitive."
            confirmLabel="Oui, supprimer"
            onConfirm={remove}
          />
        </div>
      )}
    </form>
  );
}
