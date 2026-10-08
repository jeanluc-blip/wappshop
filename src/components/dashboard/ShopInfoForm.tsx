"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePicker, type PickedImage } from "@/components/dashboard/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugError } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";
import { removeUploaded, uploadImage } from "@/lib/upload";
import { DEMO_WHATSAPP, normalizeWhatsapp, shopInfoSchema, type ShopInfoValues } from "@/lib/validators";
import { updateShopInfo, type LogoChange } from "@/app/(dashboard)/dashboard/shop/actions";

type ShopInfoFormProps = {
  userId: string;
  host: string;
  initial: { shopName: string; slug: string; whatsapp: string; logoUrl: string | null };
};

type SlugCheck = { slug: string; taken: boolean };

export function ShopInfoForm({ userId, host, initial }: ShopInfoFormProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [checked, setChecked] = useState<SlugCheck | null>(null);

  const form = useForm<ShopInfoValues>({
    resolver: zodResolver(shopInfoSchema),
    defaultValues: { shopName: initial.shopName, slug: initial.slug, whatsapp: initial.whatsapp },
  });
  const errors = form.formState.errors;

  // Vérification en direct de l'adresse (lecture publique de `shops`, protégée par la contrainte d'unicité à l'enregistrement).
  const slugValue = (useWatch({ control: form.control, name: "slug" }) ?? "").trim().toLowerCase();
  const needsCheck = slugValue !== initial.slug && slugError(slugValue) === null;

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("shops").select("id").eq("slug", slugValue).maybeSingle();
      if (!cancelled) setChecked({ slug: slugValue, taken: Boolean(data) });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsCheck, slugValue, supabase]);

  const slugHint = (() => {
    const local = slugError(slugValue);
    if (local) return { tone: "error" as const, text: local };
    if (slugValue === initial.slug) return null;
    if (checked?.slug !== slugValue) return { tone: "muted" as const, text: "Vérification de l'adresse…" };
    return checked.taken
      ? { tone: "error" as const, text: "Cette adresse est déjà prise : choisissez-en une autre." }
      : { tone: "ok" as const, text: "Cette adresse est disponible." };
  })();

  async function onSubmit(values: ShopInfoValues) {
    if (normalizeWhatsapp(values.whatsapp) === DEMO_WHATSAPP) {
      form.setError("whatsapp", { message: "Ce numéro est un numéro de démonstration : saisissez le vôtre." });
      return;
    }
    if (slugHint?.tone === "error") return;

    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      let logo: LogoChange = logoRemoved ? { action: "remove" } : { action: "keep" };
      if (picked[0]) {
        uploadedPath = `${userId}/${crypto.randomUUID()}.${picked[0].ext}`;
        const url = await uploadImage(supabase, "logos", uploadedPath, picked[0]);
        logo = { action: "set", url };
      }

      const result = await updateShopInfo(values, logo);
      if (!result.ok) {
        await removeUploaded(supabase, "logos", uploadedPath ? [uploadedPath] : []);
        if (result.field === "slug" || result.field === "whatsapp" || result.field === "shopName") {
          form.setError(result.field, { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success("Informations enregistrées");
      setPicked([]);
      setLogoRemoved(false);
      router.refresh();
    } catch {
      await removeUploaded(supabase, "logos", uploadedPath ? [uploadedPath] : []);
      toast.error("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const showCurrentLogo = initial.logoUrl && !logoRemoved && picked.length === 0;
  const slugChanged = slugValue !== initial.slug && slugValue !== "";

  return (
    <Card id="infos" aria-labelledby="info-title">
      <h2 id="info-title" className="mb-3 text-base font-bold">
        Informations
      </h2>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <Label htmlFor="shopName">Nom de la boutique</Label>
        <Input
          id="shopName"
          autoComplete="organization"
          aria-invalid={errors.shopName ? true : undefined}
          {...form.register("shopName")}
        />
        <FieldError message={errors.shopName?.message} />

        <Label htmlFor="slug" className="mt-3">
          Adresse personnalisée de la boutique
        </Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted">{host}/</span>
          <Input
            id="slug"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            aria-invalid={errors.slug || slugHint?.tone === "error" ? true : undefined}
            aria-describedby="slug-hint"
            {...form.register("slug")}
          />
        </div>
        <p
          id="slug-hint"
          aria-live="polite"
          className={`mt-1 text-sm ${slugHint?.tone === "error" ? "text-danger" : slugHint?.tone === "ok" ? "text-[#166534]" : "text-muted"}`}
        >
          {slugHint?.text ?? "Minuscules, chiffres et tirets, de 3 à 40 caractères."}
        </p>
        {slugChanged && (
          <p className="mt-1 text-sm text-muted">
            Attention : si vous changez l&apos;adresse, l&apos;ancien lien déjà partagé ne fonctionnera plus.
          </p>
        )}
        <FieldError message={errors.slug?.message} />

        <Label htmlFor="whatsapp" className="mt-3">
          Numéro WhatsApp (format international, sans +)
        </Label>
        <Input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="22997123456"
          aria-invalid={errors.whatsapp ? true : undefined}
          {...form.register("whatsapp")}
        />
        <FieldError message={errors.whatsapp?.message} />

        <p className="mb-1 mt-3 text-sm text-muted">Logo</p>
        {showCurrentLogo && (
          <div className="mb-2 flex items-center gap-3">
            <Image
              src={initial.logoUrl!}
              alt="Logo actuel"
              width={64}
              height={64}
              sizes="64px"
              className="h-16 w-16 rounded-xl border border-border object-cover"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setLogoRemoved(true)}>
              Retirer le logo
            </Button>
          </div>
        )}
        <ImagePicker
          value={picked}
          onChange={setPicked}
          maxSide={512}
          label={showCurrentLogo || picked.length > 0 ? "Changer le logo" : "Choisir un logo"}
        />

        <Button type="submit" size="full" className="mt-5" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
