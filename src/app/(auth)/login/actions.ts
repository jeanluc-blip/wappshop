"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRateLimiter } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, otpSchema, secretCodeSchema, signInCodeSchema } from "@/lib/validators";

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
  // Après un code reçu par email (première connexion ou code oublié), le vendeur crée son code secret.
  redirect("/login/code");
}

// Limites de tentatives de connexion par code secret : par adresse IP, et par email.
const ipLimiter = createRateLimiter(10, 60_000);
const emailLimiter = createRateLimiter(8, 10 * 60_000);

async function callerIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Connexion habituelle : email + code secret. Le message d'erreur ne dit jamais lequel des deux est faux. */
export async function signInWithCode(emailInput: string, codeInput: string): Promise<ActionResult> {
  const parsed = signInCodeSchema.safeParse({ email: emailInput, code: codeInput });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Informations invalides." };
  const { email, code } = parsed.data;

  if (ipLimiter(`signin-ip:${await callerIp()}`) || emailLimiter(`signin-email:${email}`)) {
    return { ok: false, message: "Trop de tentatives. Patientez quelques minutes ou recevez un code par email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: code });
  if (error) {
    return { ok: false, message: "Email ou code secret incorrect. Si vous l'avez oublié, recevez un code par email." };
  }
  redirect("/dashboard");
}

/** Crée (ou remplace) le code secret du vendeur connecté. */
export async function createCode(codeInput: string, confirmInput: string): Promise<ActionResult> {
  const parsed = secretCodeSchema.safeParse({ code: codeInput, confirm: confirmInput });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Code invalide." };

  const supabase = await createClient();
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return { ok: false, message: "Votre session a expiré. Reconnectez-vous avec votre email." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.code, data: { has_code: true } });
  if (error) {
    if (error.code === "same_password") {
      // Même code qu'avant : on marque simplement le code comme créé.
      const { error: flagError } = await supabase.auth.updateUser({ data: { has_code: true } });
      if (flagError) return { ok: false, message: "Impossible d'enregistrer le code. Réessayez." };
    } else if (error.code === "weak_password") {
      return { ok: false, message: "Ce code est trop faible : ajoutez des lettres et des chiffres." };
    } else {
      return { ok: false, message: "Impossible d'enregistrer le code. Réessayez." };
    }
  }

  // Nouveau jeton de session : il contient maintenant « has_code », sinon le tableau de bord le redemanderait.
  await supabase.auth.refreshSession();
  redirect("/dashboard");
}
