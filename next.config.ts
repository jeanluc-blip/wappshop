import type { NextConfig } from "next";

// Photos des boutiques : uniquement le stockage public de NOTRE projet Supabase (pas n'importe quel site).
function supabaseImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  try {
    const { protocol, hostname, port } = new URL(process.env.SUPABASE_URL ?? "");
    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        port,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePatterns(),
    qualities: [60, 75],
    formats: ["image/webp"],
  },
  // Les variables du projet (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) n'ont pas le préfixe NEXT_PUBLIC_.
  // On expose au navigateur uniquement l'URL et la clé publiable (publique par conception).
  // SUPABASE_SECRET_KEY ne doit JAMAIS apparaître ici : elle reste côté serveur.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  async redirects() {
    // Connexion sans mot de passe : un seul écran pour s'inscrire et se connecter.
    return [{ source: "/register", destination: "/login", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
