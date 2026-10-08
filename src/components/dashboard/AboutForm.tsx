"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aboutSettingsSchema, type AboutSettingsValues } from "@/lib/validators";
import { updateAboutSettings } from "@/app/(dashboard)/dashboard/shop/actions";

export function AboutForm({ initial }: { initial: AboutSettingsValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const form = useForm<AboutSettingsValues>({
    resolver: zodResolver(aboutSettingsSchema),
    defaultValues: initial,
  });
  const { errors } = form.formState;

  async function onSubmit(values: AboutSettingsValues) {
    setBusy(true);
    try {
      const result = await updateAboutSettings(values);
      if (!result.ok) {
        if (result.field === "socialUrl") form.setError("socialUrl", { message: result.error });
        else toast.error(result.error);
        return;
      }
      toast.success("Page À propos enregistrée");
      router.refresh();
    } catch {
      toast.error("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="apropos" aria-labelledby="about-title">
      <h2 id="about-title" className="mb-3 text-base font-bold">
        Page À propos et annonce
      </h2>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <Label htmlFor="announcement">Bandeau d&apos;annonce (en haut de la boutique)</Label>
        <Input
          id="announcement"
          placeholder="Ex. Livraison offerte dès 20 000 FCFA"
          aria-invalid={errors.announcement ? true : undefined}
          {...form.register("announcement")}
        />
        <FieldError message={errors.announcement?.message} />

        <Label htmlFor="about" className="mt-3">
          Présentation de la boutique
        </Label>
        <Textarea id="about" rows={4} aria-invalid={errors.about ? true : undefined} {...form.register("about")} />
        <FieldError message={errors.about?.message} />

        <Label htmlFor="openingHours" className="mt-3">
          Horaires
        </Label>
        <Input
          id="openingHours"
          placeholder="Lun-Sam 9h-19h"
          aria-invalid={errors.openingHours ? true : undefined}
          {...form.register("openingHours")}
        />
        <FieldError message={errors.openingHours?.message} />

        <Label htmlFor="socialUrl" className="mt-3">
          Lien réseaux sociaux (https://...)
        </Label>
        <Input
          id="socialUrl"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          placeholder="https://instagram.com/votreboutique"
          aria-invalid={errors.socialUrl ? true : undefined}
          {...form.register("socialUrl")}
        />
        <FieldError message={errors.socialUrl?.message} />

        <Button type="submit" size="full" className="mt-5" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
