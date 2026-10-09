import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/site";

// Les boutiques publiques sont indexables ; l'espace vendeur, l'API, la connexion et les liens d'avis ne le sont pas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/login", "/auth/", "/*/avis/"] }],
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
