"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePicker, type PickedImage } from "@/components/dashboard/ImagePicker";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";
import { buildSlugCandidates } from "@/lib/slug";
import {
  DEMO_WHATSAPP,
  firstProductSchema,
  normalizeWhatsapp,
  parsePrice,
  shopNameSchema,
  whatsappSchema,
} from "@/lib/validators";

type Step = 1 | 2 | 3;
function Progress({ step }: { step: Step }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm text-muted">Étape {step} sur 3</p>
      <div
        role="progressbar"
        aria-label={`Étape ${step} sur 3`}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        className="flex gap-1.5"
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mb-2 text-sm text-danger">{message}</p> : null;
}

export function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [shopName, setShopName] = useState("");
  const [logo, setLogo] = useState<PickedImage[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickedImage[]>([]);

  // Étape 1 : nom + logo
  const nameForm = useForm({
    resolver: zodResolver(shopNameSchema),
    defaultValues: { shopName: "" },
  });

  // Étape 2 : numéro WhatsApp
  const waForm = useForm({
    resolver: zodResolver(whatsappSchema),
    defaultValues: { whatsapp: "" },
  });

  // Étape 3 : premier produit
  const productForm = useForm({
    resolver: zodResolver(firstProductSchema),
    defaultValues: { name: "", price: "" },
  });

  function finish() {
    toast.success("Votre boutique est prête");
    router.refresh();
  }

  async function createShop(values: { whatsapp: string }) {
    const whatsapp = normalizeWhatsapp(values.whatsapp);
    if (whatsapp === DEMO_WHATSAPP) {
      waForm.setError("whatsapp", { message: "Ce numéro est un numéro de démonstration : saisissez le vôtre." });
      return;
    }

    setBusy(true);
    try {
      let logoUrl: string | null = null;
      if (logo[0]) {
        logoUrl = await uploadImage(supabase, "logos", `${userId}/${crypto.randomUUID()}.${logo[0].ext}`, logo[0]);
      }

      for (const slug of buildSlugCandidates(shopName)) {
        const { data, error } = await supabase
          .from("shops")
          .insert({ user_id: userId, shop_name: shopName, slug, logo_url: logoUrl, whatsapp_number: whatsapp })
          .select("id")
          .single();

        if (!error) {
          setShopId(data.id);
          setStep(3);
          return;
        }
        if (error.code === "23505") {
          // Boutique déjà créée pour ce compte (ex. double clic) : on passe au tableau de bord.
          if (`${error.message} ${error.details ?? ""}`.includes("user_id")) {
            router.refresh();
            return;
          }
          continue; // adresse déjà prise : on essaie la variante suivante
        }
        throw error;
      }
      toast.error("Impossible de trouver une adresse libre. Modifiez le nom de votre boutique.");
    } catch {
      toast.error("Impossible de créer la boutique. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function createFirstProduct(values: { name: string; price: string }) {
    const price = parsePrice(values.price);
    if (!shopId || price === null) return;

    setBusy(true);
    try {
      const { data: product, error } = await supabase
        .from("products")
        .insert({ shop_id: shopId, name: values.name.trim(), price })
        .select("id")
        .single();
      if (error) throw error;

      let failed = 0;
      const rows: { product_id: string; image_url: string; position: number }[] = [];
      for (const [index, photo] of photos.entries()) {
        try {
          const url = await uploadImage(
            supabase,
            "product-images",
            `${userId}/${product.id}/${crypto.randomUUID()}.${photo.ext}`,
            photo,
          );
          rows.push({ product_id: product.id, image_url: url, position: index });
        } catch {
          failed++;
        }
      }
      if (rows.length > 0) {
        const { error: imagesError } = await supabase.from("images").insert(rows);
        if (imagesError) failed += rows.length;
      }
      if (failed > 0) toast.error("Certaines photos n'ont pas pu être envoyées : vous pourrez les ajouter plus tard.");
      finish();
    } catch {
      toast.error("Impossible d'enregistrer le produit. Réessayez ou passez cette étape.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="wizard-title">
      <Progress step={step} />

      {step === 1 && (
        <form
          noValidate
          onSubmit={nameForm.handleSubmit((values) => {
            setShopName(values.shopName);
            setStep(2);
          })}
        >
          <h1 id="wizard-title" className="mb-1 text-xl font-bold">Nom et logo de votre boutique</h1>
          <p className="mb-4 text-sm text-muted">Vos clients verront ces informations en haut de votre boutique.</p>
          <Label htmlFor="shopName">Nom de la boutique</Label>
          <Input
            id="shopName"
            autoComplete="organization"
            placeholder="Ex. Chez Awa"
            aria-invalid={nameForm.formState.errors.shopName ? true : undefined}
            className="mb-1"
            {...nameForm.register("shopName")}
          />
          <FieldError message={nameForm.formState.errors.shopName?.message} />
          <p className="mb-1 mt-3 text-sm text-muted">Logo (facultatif)</p>
          <ImagePicker
            value={logo}
            onChange={setLogo}
            maxSide={512}
            label={logo.length > 0 ? "Changer le logo" : "Choisir un logo"}
          />
          <Button type="submit" size="full" className="mt-6">Continuer</Button>
        </form>
      )}

      {step === 2 && (
        <form noValidate onSubmit={waForm.handleSubmit(createShop)}>
          <h1 id="wizard-title" className="mb-1 text-xl font-bold">Votre numéro WhatsApp</h1>
          <p className="mb-4 text-sm text-muted">
            Les commandes de vos clients arriveront sur ce numéro. Chiffres uniquement, avec l&apos;indicatif
            du pays (ex. 22997123456).
          </p>
          <Label htmlFor="whatsapp">Numéro WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="22997123456"
            aria-invalid={waForm.formState.errors.whatsapp ? true : undefined}
            className="mb-1"
            {...waForm.register("whatsapp")}
          />
          <FieldError message={waForm.formState.errors.whatsapp?.message} />
          <div className="mt-6 flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(1)}>Retour</Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Création de la boutique…" : "Continuer"}
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form noValidate onSubmit={productForm.handleSubmit(createFirstProduct)}>
          <h1 id="wizard-title" className="mb-1 text-xl font-bold">Votre premier produit</h1>
          <p className="mb-4 text-sm text-muted">
            Votre boutique est créée. Ajoutez un premier produit maintenant, ou passez cette étape.
          </p>
          <Label htmlFor="productName">Nom du produit</Label>
          <Input
            id="productName"
            placeholder="Ex. Robe wax"
            aria-invalid={productForm.formState.errors.name ? true : undefined}
            className="mb-1"
            {...productForm.register("name")}
          />
          <FieldError message={productForm.formState.errors.name?.message} />
          <Label htmlFor="productPrice" className="mt-3">Prix</Label>
          <Input
            id="productPrice"
            inputMode="decimal"
            placeholder="5000"
            aria-invalid={productForm.formState.errors.price ? true : undefined}
            className="mb-1"
            {...productForm.register("price")}
          />
          <FieldError message={productForm.formState.errors.price?.message} />
          <p className="mb-1 mt-3 text-sm text-muted">Photos (facultatif, 8 maximum)</p>
          <ImagePicker
            value={photos}
            onChange={setPhotos}
            multiple
            max={8}
            label={photos.length > 0 ? "Ajouter d'autres photos" : "Ajouter des photos"}
          />
          <Button type="submit" size="full" className="mt-6" disabled={busy}>
            {busy ? "Enregistrement…" : "Terminer"}
          </Button>
          <Button type="button" variant="ghost" size="full" className="mt-2" disabled={busy} onClick={finish}>
            Passer cette étape
          </Button>
        </form>
      )}
    </section>
  );
}
