"use client";

import { useState, useTransition } from "react";
import { SecretField } from "@/components/auth/SecretField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createCode } from "@/app/(auth)/login/actions";
import { SECRET_CODE_MIN } from "@/lib/validators";

export function CreateCodeForm() {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      // En cas de succès, l'action redirige vers le tableau de bord : on ne revient ici qu'en cas d'erreur.
      const result = await createCode(code, confirm);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4">
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Label htmlFor="new-code">Votre code secret ({SECRET_CODE_MIN} caractères minimum)</Label>
      <SecretField id="new-code" value={code} onChange={setCode} autoComplete="new-password" />
      <Label htmlFor="confirm-code" className="mt-3">
        Confirmez le code
      </Label>
      <SecretField id="confirm-code" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <p className="mb-4 mt-2 text-sm text-muted">Mélangez lettres et chiffres. Notez-le : vous en aurez besoin à chaque connexion.</p>
      <Button type="submit" size="full" disabled={pending || code.length < SECRET_CODE_MIN || confirm.length === 0}>
        {pending ? "Enregistrement…" : "Enregistrer mon code"}
      </Button>
    </form>
  );
}
