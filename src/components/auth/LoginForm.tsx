"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtp, verifyOtp } from "@/app/(auth)/login/actions";
import { emailSchema, OTP_LENGTH } from "@/lib/validators";

type EmailValues = { email: string };

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function requestCode(target: string, isResend = false) {
    setError(null);
    startTransition(async () => {
      const result = await sendOtp(target);
      if (result.ok) {
        setEmail(target.trim().toLowerCase());
        setStep("code");
        setCode("");
        setLocked(false);
        setCooldown(result.retryIn);
        if (isResend) toast.success("Nouveau code envoyé");
      } else {
        if (result.retryIn) setCooldown(result.retryIn);
        setError(result.message);
      }
    });
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyOtp(email, code);
      // En cas de succès, l'action redirige vers /dashboard : on ne revient ici qu'en cas d'erreur.
      if (result && !result.ok) {
        setError(result.message);
        if (result.locked) setLocked(true);
        setCode("");
      }
    });
  }

  const errorBox = error ? (
    <p role="alert" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
      {error}
    </p>
  ) : null;

  if (step === "email") {
    return (
      <div className="mt-2">
        <p className="mb-5 text-center text-muted">
          Créez votre boutique ou connectez-vous. Aucun mot de passe à retenir.
        </p>
        {errorBox}
        <form onSubmit={handleSubmit((values) => requestCode(values.email))} noValidate>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            aria-invalid={errors.email ? true : undefined}
            className="mb-1"
            {...register("email")}
          />
          {errors.email && <p className="mb-2 text-sm text-danger">{errors.email.message}</p>}
          <Button type="submit" size="full" className="mt-3" disabled={pending}>
            {pending ? "Envoi du code…" : "Recevoir mon code"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-5 text-center text-muted">
        Un code à 6 chiffres a été envoyé à <b className="text-foreground">{email}</b>.
      </p>
      {errorBox}
      <form onSubmit={submitCode}>
        <Label htmlFor="code">Code de connexion (valable 10 minutes)</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
          disabled={locked}
          className="mb-3 text-center text-[22px] tracking-[6px]"
        />
        <Button type="submit" size="full" disabled={pending || locked || code.length !== OTP_LENGTH}>
          {pending ? "Vérification…" : "Se connecter"}
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || cooldown > 0}
          onClick={() => requestCode(email, true)}
        >
          {cooldown > 0 ? `Renvoyer un code (${cooldown} s)` : "Renvoyer un code"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setStep("email");
            setError(null);
            setCode("");
          }}
        >
          Changer d&apos;email
        </Button>
      </div>
    </div>
  );
}
