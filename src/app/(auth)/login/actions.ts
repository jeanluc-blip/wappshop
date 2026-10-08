"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, otpSchema } from "@/lib/validators";

const OTP_COOKIE = "ws_otp";
const MAX_TRIES = 5;
const RESEND_SECONDS = 60;
const OTP_TTL_SECONDS = 600; // 10 minutes (régler la même valeur dans Supabase)

type OtpState = { e: string; t: number; n: number };

export type ActionResult =
  | { ok: true; retryIn: number }
  | { ok: false; message: string; retryIn?: number; locked?: boolean };

async function readState(): Promise<OtpState | null> {
  const raw = (await cookies()).get(OTP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" && value !== null &&
      typeof (value as OtpState).e === "string" &&
      typeof (value as OtpState).t === "number" &&
      typeof (value as OtpState).n === "number"
    ) {
      return value as OtpState;
    }
  } catch {
    // cookie illisible : ignoré
  }
  return null;
}

async function writeState(state: OtpState) {
  (await cookies()).set(OTP_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
}

/** Envoie (ou renvoie) un code à 6 chiffres. Un email inconnu crée le compte automatiquement. */
export async function sendOtp(emailInput: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({ email: emailInput });
  if (!parsed.success) return { ok: false, message: "Adresse email invalide." };
  const email = parsed.data.email;

  const state = await readState();
  if (state && state.e === email) {
    const elapsed = Math.floor((Date.now() - state.t) / 1000);
    if (elapsed < RESEND_SECONDS) {
      const retryIn = RESEND_SECONDS - elapsed;
      return { ok: false, message: `Patientez ${retryIn} secondes avant un nouveau code.`, retryIn };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { ok: false, message: "Trop de demandes d'envoi. Réessayez dans quelques minutes." };
    }
    return { ok: false, message: "Impossible d'envoyer le code. Vérifiez l'adresse et réessayez." };
  }

  await writeState({ e: email, t: Date.now(), n: 0 });
  return { ok: true, retryIn: RESEND_SECONDS };
}

/** Vérifie le code (5 essais maximum par code). En cas de succès : redirection vers /dashboard. */
export async function verifyOtp(emailInput: string, codeInput: string): Promise<ActionResult> {
  const parsedEmail = emailSchema.safeParse({ email: emailInput });
  const parsedCode = otpSchema.safeParse({ code: codeInput });
  if (!parsedEmail.success) return { ok: false, message: "Adresse email invalide." };
  if (!parsedCode.success) return { ok: false, message: "Le code contient 6 chiffres." };
  const email = parsedEmail.data.email;

  const expired: ActionResult = {
    ok: false,
    message: "Code expiré : demandez-en un nouveau.",
    locked: true,
  };
  const state = await readState();
  if (!state || state.e !== email) return expired;
  if (Date.now() - state.t > OTP_TTL_SECONDS * 1000) return expired;
  if (state.n >= MAX_TRIES) {
    return { ok: false, message: "Trop d'essais : demandez un nouveau code.", locked: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: parsedCode.data.code,
    type: "email",
  });

  if (error) {
    const tries = state.n + 1;
    await writeState({ ...state, n: tries });
    if (tries >= MAX_TRIES) {
      return { ok: false, message: "Trop d'essais : demandez un nouveau code.", locked: true };
    }
    const left = MAX_TRIES - tries;
    return {
      ok: false,
      message: `Code incorrect ou expiré. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`,
    };
  }

  (await cookies()).delete(OTP_COOKIE);
  redirect("/dashboard");
}

/** Connexion Google : redirige vers Google, puis vers /auth/callback. */
export async function signInWithGoogle() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
