"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCY } from "@/lib/format";
import {
  deliverySettingsSchema,
  MAX_ZONES,
  PAYMENT_METHODS,
  type DeliverySettingsValues,
} from "@/lib/validators";
import { updateDeliverySettings } from "@/app/(dashboard)/dashboard/shop/actions";

export function DeliveryForm({ initial }: { initial: DeliverySettingsValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const form = useForm<DeliverySettingsValues>({
    resolver: zodResolver(deliverySettingsSchema),
    defaultValues: initial,
  });
  const zones = useFieldArray({ control: form.control, name: "zones" });
  const { errors } = form.formState;

  const deliveryEnabled = useWatch({ control: form.control, name: "deliveryEnabled" });
  const pickupEnabled = useWatch({ control: form.control, name: "pickupEnabled" });
  const paymentMethods = useWatch({ control: form.control, name: "paymentMethods" });

  function toggle(name: "deliveryEnabled" | "pickupEnabled") {
    const next = name === "deliveryEnabled" ? !deliveryEnabled : !pickupEnabled;
    if (name === "deliveryEnabled") form.setValue("deliveryEnabled", next, { shouldDirty: true });
    else form.setValue("pickupEnabled", next, { shouldDirty: true });
    form.clearErrors("deliveryEnabled");
  }

  function togglePayment(method: (typeof PAYMENT_METHODS)[number]) {
    const next = paymentMethods.includes(method)
      ? paymentMethods.filter((value) => value !== method)
      : [...paymentMethods, method];
    form.setValue("paymentMethods", next, { shouldDirty: true });
  }

  async function onSubmit(values: DeliverySettingsValues) {
    setBusy(true);
    try {
      const result = await updateDeliverySettings(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Livraison et paiement enregistrés");
      router.refresh();
    } catch {
      toast.error("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="livraison" aria-labelledby="delivery-title">
      <h2 id="delivery-title" className="mb-3 text-base font-bold">
        Livraison et paiement
      </h2>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <p className="mb-1 text-sm text-muted" id="modes-label">
          Modes de réception proposés
        </p>
        <div role="group" aria-labelledby="modes-label" className="flex flex-wrap gap-2">
          <Chip pressed={deliveryEnabled} onClick={() => toggle("deliveryEnabled")}>
            Livraison
          </Chip>
          <Chip pressed={pickupEnabled} onClick={() => toggle("pickupEnabled")}>
            Retrait en boutique
          </Chip>
        </div>
        <FieldError message={errors.deliveryEnabled?.message} />

        {pickupEnabled && (
          <>
            <Label htmlFor="pickupAddress" className="mt-4">
              Adresse de retrait
            </Label>
            <Input
              id="pickupAddress"
              autoComplete="street-address"
              placeholder="Quartier, point de repère"
              aria-invalid={errors.pickupAddress ? true : undefined}
              {...form.register("pickupAddress")}
            />
            <FieldError message={errors.pickupAddress?.message} />
          </>
        )}

        {deliveryEnabled && (
          <fieldset className="mt-4">
            <legend className="mb-1 text-sm text-muted">Zones de livraison et frais ({CURRENCY})</legend>
            {zones.fields.length === 0 && (
              <p className="mb-2 text-sm text-muted">Aucune zone : ajoutez vos quartiers ou villes avec leurs frais (0 = gratuit).</p>
            )}
            <ul>
              {zones.fields.map((field, index) => (
                <li key={field.id} className="mb-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        aria-label={`Nom de la zone ${index + 1}`}
                        placeholder="Quartier ou ville"
                        aria-invalid={errors.zones?.[index]?.name ? true : undefined}
                        {...form.register(`zones.${index}.name`)}
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <Input
                        aria-label={`Frais de la zone ${index + 1}`}
                        inputMode="decimal"
                        placeholder="Frais"
                        aria-invalid={errors.zones?.[index]?.fee ? true : undefined}
                        {...form.register(`zones.${index}.fee`)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-11 shrink-0 px-0"
                      aria-label={`Supprimer la zone ${index + 1}`}
                      onClick={() => zones.remove(index)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </Button>
                  </div>
                  <FieldError message={errors.zones?.[index]?.name?.message ?? errors.zones?.[index]?.fee?.message} />
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={zones.fields.length >= MAX_ZONES}
              onClick={() => zones.append({ name: "", fee: "0" })}
            >
              <Plus size={16} aria-hidden="true" />
              Ajouter une zone
            </Button>
          </fieldset>
        )}

        <p className="mb-1 mt-5 text-sm text-muted" id="pay-label">
          Modes de paiement acceptés
        </p>
        <div role="group" aria-labelledby="pay-label" className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
            <Chip key={method} pressed={paymentMethods.includes(method)} onClick={() => togglePayment(method)}>
              {method}
            </Chip>
          ))}
        </div>

        <Label htmlFor="paymentNote" className="mt-4">
          Précisions de paiement (facultatif)
        </Label>
        <Input
          id="paymentNote"
          placeholder="Ex. numéro Mobile Money à utiliser"
          aria-invalid={errors.paymentNote ? true : undefined}
          {...form.register("paymentNote")}
        />
        <FieldError message={errors.paymentNote?.message} />

        <Button type="submit" size="full" className="mt-5" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
