import { z } from "zod";
import { slugError } from "@/lib/slug";

// Messages d'erreur par défaut de zod en français (nos messages personnalisés restent prioritaires).
z.config(z.locales.fr());

export const OTP_LENGTH = 6;

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Saisissez votre email")
    .email("Adresse email invalide"),
});

export const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Le code contient 6 chiffres"),
});

/** Ne garde que les chiffres (retire +, espaces, tirets, parenthèses). */
export function normalizeWhatsapp(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const DEMO_WHATSAPP = "22900000000";

export const shopNameSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(80, "80 caractères maximum"),
});

export const whatsappSchema = z.object({
  whatsapp: z
    .string()
    .refine(
      (value) => /^\d{8,15}$/.test(normalizeWhatsapp(value)),
      "Numéro invalide : 8 à 15 chiffres, indicatif du pays inclus",
    ),
});

export function parsePrice(raw: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Number(value);
}

export const firstProductSchema = z.object({
  name: z.string().trim().min(1, "Saisissez le nom du produit").max(120, "120 caractères maximum"),
  price: z
    .string()
    .refine((value) => parsePrice(value) !== null, "Prix invalide (ex. 5000 ou 12,50)"),
});

// ---------------------------------------------------------------------------
// Phase 3 : espace vendeur. Les mêmes schémas servent au formulaire (navigateur)
// et à l'action serveur (jamais de confiance au navigateur).
// ---------------------------------------------------------------------------
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_VARIANTS = 40;
export const MAX_ZONES = 30;
export const PAYMENT_METHODS = ["Espèces à la livraison", "Mobile Money", "Virement bancaire"] as const;

const MAX_AMOUNT = 1_000_000_000; // reste largement sous la limite numeric(12,2) de la base

function isAmount(value: string): boolean {
  const amount = parsePrice(value);
  return amount !== null && amount < MAX_AMOUNT;
}

const priceField = (label: string) =>
  z.string().refine(isAmount, `${label} invalide (ex. 5000 ou 12,50)`);
const optionalPriceField = (label: string) =>
  z.string().refine((value) => value.trim() === "" || isAmount(value), `${label} invalide (ex. 5000)`);

/** Informations de la boutique : nom, adresse personnalisée, numéro WhatsApp. */
export const shopInfoSchema = z.object({
  shopName: shopNameSchema.shape.shopName,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((value, ctx) => {
      const message = slugError(value);
      if (message) ctx.addIssue({ code: "custom", message });
    }),
  whatsapp: whatsappSchema.shape.whatsapp,
});
export type ShopInfoValues = z.input<typeof shopInfoSchema>;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Saisissez un nom de catégorie")
  .max(60, "60 caractères maximum");

export const variantRowSchema = z.object({
  name: z.string().trim().min(1, "Indiquez l'option (ex. Taille)").max(40, "40 caractères maximum"),
  value: z.string().trim().min(1, "Indiquez la valeur (ex. L)").max(40, "40 caractères maximum"),
  supplement: optionalPriceField("Supplément"),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Le titre est obligatoire").max(120, "120 caractères maximum"),
    price: priceField("Prix"),
    badge: z.enum(["none", "new", "promo"]),
    oldPrice: optionalPriceField("Ancien prix"),
    soldOut: z.boolean(),
    featured: z.boolean(),
    description: z.string().trim().max(2000, "2 000 caractères maximum"),
    categoryId: z.string(),
    variants: z.array(variantRowSchema).max(MAX_VARIANTS, `${MAX_VARIANTS} variantes maximum`),
  })
  .superRefine((data, ctx) => {
    if (data.badge !== "promo") return;
    const price = parsePrice(data.price);
    const oldPrice = parsePrice(data.oldPrice);
    if (oldPrice === null) {
      ctx.addIssue({ code: "custom", path: ["oldPrice"], message: "Indiquez l'ancien prix pour une promo" });
    } else if (price !== null && oldPrice <= price) {
      ctx.addIssue({ code: "custom", path: ["oldPrice"], message: "L'ancien prix doit être supérieur au prix actuel" });
    }
  });
export type ProductFormValues = z.input<typeof productFormSchema>;

export const zoneRowSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nom de zone obligatoire").max(80, "80 caractères maximum"),
  fee: optionalPriceField("Frais"),
});

/** Livraison, retrait, zones et paiements. */
export const deliverySettingsSchema = z
  .object({
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    pickupAddress: z.string().trim().max(200, "200 caractères maximum"),
    zones: z.array(zoneRowSchema).max(MAX_ZONES, `${MAX_ZONES} zones maximum`),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)),
    paymentNote: z.string().trim().max(200, "200 caractères maximum"),
  })
  .refine((data) => data.deliveryEnabled || data.pickupEnabled, {
    path: ["deliveryEnabled"],
    message: "Activez au moins un mode de réception : livraison ou retrait.",
  });
export type DeliverySettingsValues = z.input<typeof deliverySettingsSchema>;

/** Seules les adresses https:// sont acceptées pour le lien réseaux sociaux. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Page « À propos » et bandeau d'annonce. */
export const aboutSettingsSchema = z.object({
  announcement: z.string().trim().max(120, "120 caractères maximum"),
  about: z.string().trim().max(1000, "1 000 caractères maximum"),
  openingHours: z.string().trim().max(120, "120 caractères maximum"),
  socialUrl: z
    .string()
    .trim()
    .max(200, "200 caractères maximum")
    .refine((value) => value === "" || isHttpsUrl(value), "Le lien doit commencer par https://"),
});
export type AboutSettingsValues = z.input<typeof aboutSettingsSchema>;

// ---------------------------------------------------------------------------
// Phase 5 : commande. Le navigateur n'envoie QUE des identifiants et des choix ;
// prix, suppléments, frais et total sont recalculés par le serveur (les champs en trop sont ignorés).
// ---------------------------------------------------------------------------
export const orderInputSchema = z.object({
  slug: z.string().min(3).max(40),
  customerName: z
    .string()
    .trim()
    .min(2, "Saisissez votre nom")
    .max(80, "80 caractères maximum"),
  fulfillment: z.enum(["delivery", "pickup"]),
  zoneId: z.guid().optional().nullable(),
  address: z.string().trim().max(200, "200 caractères maximum").optional().nullable(),
  paymentMethod: z.string().trim().max(80).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.guid(),
        selection: z.record(z.string().max(40), z.string().max(40)),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Votre panier est vide")
    .max(50, "Trop d'articles dans le panier"),
});
export type OrderInput = z.input<typeof orderInputSchema>;

export const reviewInputSchema = z.object({
  token: z.guid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(300, "300 caractères maximum").optional().nullable(),
});

// ---------------------------------------------------------------------------
// Code secret du vendeur (créé après le premier code reçu par email)
// ---------------------------------------------------------------------------
export const SECRET_CODE_MIN = 8;
const WEAK_CODES = ["12345678", "123456789", "1234567890", "11111111", "00000000", "password", "motdepasse", "azertyui", "azerty123"];

export const secretCodeSchema = z
  .object({
    code: z
      .string()
      .min(SECRET_CODE_MIN, `Au moins ${SECRET_CODE_MIN} caractères`)
      .max(72, "72 caractères maximum")
      .refine((value) => !WEAK_CODES.includes(value.toLowerCase()) && new Set(value).size > 2, "Ce code est trop simple : choisissez-en un autre."),
    confirm: z.string(),
  })
  .refine((data) => data.code === data.confirm, { path: ["confirm"], message: "Les deux codes ne sont pas identiques." });

export const signInCodeSchema = z.object({
  email: emailSchema.shape.email,
  code: z.string().min(1, "Saisissez votre code secret").max(72),
});

/** Titre de la bannière de la boutique (la bannière s'affiche dès qu'un titre ou une image est défini). */
export const bannerTitleSchema = z.string().trim().max(80, "80 caractères maximum");
