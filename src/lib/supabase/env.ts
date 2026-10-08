function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

// Dans le navigateur, ces deux valeurs sont injectées au build par next.config.ts
// à partir de SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY.
export function getSupabaseConfig() {
  return {
    url: required(process.env.NEXT_PUBLIC_SUPABASE_URL, "SUPABASE_URL"),
    publishableKey: required(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}
