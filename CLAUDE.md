# CLAUDE.md — WappShop

## 1. Vision du projet

**WappShop** est un SaaS e-commerce de **Social Commerce** (MVP). Il permet à un commerçant de créer en quelques minutes un catalogue en ligne et de **recevoir les commandes de ses clients directement sur WhatsApp**.

- Pas de paiement en ligne dans le MVP : le paiement et la livraison se règlent entre vendeur et acheteur via WhatsApp.
- **Mobile-First obligatoire** : chaque écran est conçu d'abord pour un smartphone (360–430 px), puis adapté au desktop.
- Langue de l'interface : **français**. Le code (variables, fonctions, commentaires techniques) est en **anglais**.

## 2. Stack technique

| Couche | Choix |
|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript strict |
| UI | Tailwind CSS + composants shadcn/ui (minimalistes) + icônes lucide-react |
| Backend / BDD | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Auth | Supabase Auth : code à 6 chiffres par email (sans mot de passe) ; la connexion Google a été retirée |
| Formulaires | react-hook-form + zod |
| État panier | Zustand (persisté en `localStorage`, une clé par boutique) |
| Déploiement | Vercel |

> Si une autre stack est plus adaptée, demande confirmation avant de changer.

## 3. Commandes

```bash
npm install          # installer les dépendances
npm run dev          # serveur de dev (http://localhost:3000)
npm run build        # build de production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

Variables d'environnement (`.env.local`, ne jamais commiter ; modèle : `.env.example`) :

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=            # serveur uniquement, ne jamais exposer au navigateur
SUPABASE_JWKS_URL=              # optionnelle
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`next.config.ts` expose au navigateur uniquement `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` (sous les noms `NEXT_PUBLIC_*`). Ne jamais lire ni demander le contenu de `.env.local`.

## 4. Architecture de l'application

Deux espaces distincts dans un même projet :

```
src/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  └─ register/page.tsx
│  ├─ (dashboard)/dashboard/          # ESPACE VENDEUR (protégé)
│  │  ├─ layout.tsx                   # header + logo + navigation bas de page (mobile)
│  │  ├─ page.tsx                     # accueil + bouton "Copier le lien de ma boutique"
│  │  ├─ shop/page.tsx                # configuration boutique
│  │  ├─ categories/page.tsx
│  │  ├─ products/page.tsx            # liste
│  │  ├─ products/new/page.tsx
│  │  ├─ products/[id]/page.tsx       # édition
│  │  ├─ orders/page.tsx              # onglet Commandes
│  │  └─ stats/page.tsx               # onglet Statistiques
│  ├─ [slug]/page.tsx                 # ESPACE ACHETEUR (public) → wappshop.app/ma-boutique
│  └─ api/orders/route.ts             # enregistrement d'une commande avant redirection WhatsApp
├─ components/
│  ├─ ui/                             # shadcn
│  ├─ brand/Logo.tsx                  # logo WappShop (réutilisé partout)
│  ├─ dashboard/
│  └─ storefront/
├─ lib/
│  ├─ supabase/ (client.ts, server.ts, middleware.ts)
│  ├─ whatsapp.ts                     # génération du message + URL wa.me
│  ├─ format.ts                       # prix, devise
│  └─ validators.ts                   # schémas zod
└─ types/
public/
└─ logo.svg                           # logo WappShop (original, fourni)
```

Le middleware Next.js protège `/dashboard/*` (redirection vers `/login` si non connecté).

## 5. Espace Vendeur (tableau de bord sécurisé)

1. **Inscription / connexion sans mot de passe** (écran unique, inscription et connexion identiques) : bouton « Continuer avec Google », ou saisie de l'email puis **code à 6 chiffres reçu par email** (Supabase `signInWithOtp`). Un email inconnu crée le compte automatiquement. Code valable **10 minutes** (régler l'expiration dans Supabase), à usage unique, **5 essais maximum**, **60 secondes** minimum avant un renvoi. Aucun mot de passe : rien à oublier, donc pas de « mot de passe oublié » ; « code non reçu » = bouton « Renvoyer un code ». Session longue sur mobile. Le même email via Google ou via code mène au **même compte**. Option ultérieure : ajout d'un mot de passe dans les paramètres. **Production : brancher un service d'envoi d'emails (SMTP personnalisé, domaine de la marque avec SPF/DKIM)** pour éviter le spam. Après la première connexion, assistant en 3 étapes : nom et logo, numéro WhatsApp, premier produit.
2. **Configuration de la boutique** : nom, logo (upload), numéro WhatsApp. Génération automatique d'un `slug` unique à partir du nom (modifiable). Valider le numéro au format international (chiffres uniquement, indicatif pays inclus).
3. **Catégories** : créer, modifier, supprimer (confirmation avant suppression ; les produits liés passent à « sans catégorie »).
4. **Catalogue produits** : formulaire d'ajout/édition avec
   - Titre, Prix, Description
   - Catégorie (select)
   - **Photos multiples** : plusieurs images par produit, aperçu, suppression individuelle, image principale = la première (réorganisation possible)
   - **Variantes** : lignes dynamiques « Option (taille, couleur, pointure…) / Valeur / Supplément de prix (optionnel) »
5. **Lien public** : bouton « Copier le lien de ma boutique » (`navigator.clipboard`, avec fallback) et toast de confirmation.
6. **Commandes** : liste des commandes (plus récentes en premier) avec détail des articles, total, date et **statut modifiable : `Nouvelle` → `Confirmée` → `Livrée`**. Filtre par statut. Badge du nombre de commandes « Nouvelle » dans la navigation.

### ⚠️ Correction technique obligatoire : import d'images sur mobile

Le bouton d'import d'image doit être un **vrai bouton cliquable** qui ouvre le sélecteur de fichiers et **fonctionne parfaitement sur iOS Safari et Android Chrome** :

- Utiliser un `<input type="file" accept="image/*" multiple>` associé à un `<button type="button">` visible (zone tactile ≥ 44×44 px) qui appelle `inputRef.current?.click()` **directement dans le handler du clic** (aucun `await`/`setTimeout` avant).
- Ne pas masquer l'input avec `display: none` si cela pose problème sur iOS : utiliser une classe `sr-only` (visuellement caché mais présent dans le DOM), ou un `<label htmlFor>` stylé en bouton.
- Le bouton ne doit pas être imbriqué dans un élément qui intercepte les événements (pas de `pointer-events: none` sur le parent, pas de `<form>` qui se soumet au clic : toujours `type="button"`).
- Réinitialiser `input.value = ""` après la sélection pour pouvoir re-choisir le même fichier.
- Compresser/redimensionner côté client avant l'envoi (max ~1200 px, qualité ~0.8), limiter à 5 Mo et 8 images par produit, afficher une progression et les erreurs.
- Tester sur un vrai téléphone (ou émulateur) avant de considérer la tâche terminée.

## 6. Espace Acheteur (boutique publique `/[slug]`)

Page publique, **sans compte requis**, rendue côté serveur (SEO + rapidité) avec métadonnées Open Graph (nom + logo de la boutique pour un bel aperçu dans WhatsApp).

1. **En-tête** : logo et nom du vendeur en haut.
2. **Navigation catégories** : barre horizontale scrollable, collante (`sticky`), avec « Tout » + catégories ; filtre instantané des produits.
3. **Grille produits** : 2 colonnes sur mobile, 3–4 sur desktop ; carte épurée (image, titre, prix).
4. **Ajout au panier** : sur chaque carte, un bouton vert pleine largeur **« Ajouter au panier »** (libellé incitatif, jamais un simple « + »). Au clic : le produit est ajouté (ou la feuille de variantes s'ouvre pour choisir taille / couleur / pointure, avec le bouton « Ajouter au panier · {prix} »), un message « Ajouté au panier » s'affiche, puis le bouton est remplacé par un sélecteur **− quantité +** pour ajuster ; revenir à 0 remet le bouton. Prix final = prix de base + suppléments des variantes. La fiche produit affiche la galerie de photos (swipe).
5. **Panier flottant** : barre fixe en bas de l'écran (nombre d'articles + total) qui s'ouvre en tiroir : liste des articles, variantes choisies, quantités modifiables, **total calculé automatiquement**.
6. **Checkout WhatsApp** : bouton principal vert **« Valider ma commande sur WhatsApp »**. Au clic :
   1. (optionnel) demander le nom du client ;
   2. enregistrer la commande en base (statut `Nouvelle`) via `POST /api/orders` ;
   3. vider le panier et afficher un **écran de confirmation** avec un vrai lien `<a href="https://wa.me/<numero>?text=<message encodé>" target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a>` et un bouton **« Copier le message »** (secours si WhatsApp ne s'ouvre pas) ;
   4. sur le site déployé (hors cadre sandbox), tenter aussi l'ouverture automatique dans le handler du clic.

### Galerie photos swipeable (priorité)
- Chaque produit peut avoir jusqu'à 8 photos ; **l'acheteur les fait défiler au doigt** directement sur la carte de la grille et dans la fiche produit : CSS `scroll-snap-type: x mandatory`, une photo par « page », `overscroll-behavior-x: contain`, sans bibliothèque lourde.
- Indicateurs : points en bas (le point actif s'allonge) et compteur « 1/5 » en haut à droite, uniquement s'il y a plusieurs photos. Sur ordinateur : flèches gauche/droite et miniatures dans la fiche produit.
- Un clic sur la photo ouvre la fiche produit (galerie plus grande, ratio 4/3) ; prévoir ensuite un plein écran avec zoom au pincement.
- Performance : `next/image` avec `sizes`, première photo en chargement prioritaire, les suivantes en `loading="lazy"`, conversion en WebP, côté le plus long limité à 1200 px.
- Côté vendeur : réorganiser les photos (flèches ou glisser-déposer) ; la première est la principale ; suppression individuelle.

### Navigation et contact (catégories avec photo, recherche, WhatsApp flottant)
- **Catégories avec photo** : barre horizontale de pastilles rondes (60 px) avec le nom dessous, scrollable, collante. « Tout » en premier ; la catégorie active a un anneau vert. Photo choisie par le vendeur (bouton réel d'import, même règle mobile qu'en section 5) ; à défaut, photo du premier produit, sinon l'initiale.
- **Recherche** : champ « Rechercher un produit » au-dessus de la grille, filtre instantané sur le nom (insensible à la casse), cumulable avec la catégorie active ; ne pas perdre le focus pendant la frappe ; message « Aucun produit trouvé ».
- **Bouton WhatsApp flottant « Poser une question »** : lien `<a>` réel (`wa.me/<numero>?text=...`, `target="_blank"`), toujours visible en bas à droite, placé au-dessus de la barre du panier quand elle est affichée. Message pré-rempli sans emoji : « Bonjour, j'ai une question sur vos produits ({Nom_boutique}). »

### Livraison, paiement et liens produit (validés)
- **Configuration vendeur** (onglet Accueil, carte « Livraison et paiement ») : activer **Livraison** et/ou **Retrait en boutique** (+ adresse de retrait) ; **zones de livraison** avec frais (table `delivery_zones` : `id`, `shop_id`, `name`, `fee`) ; **modes de paiement acceptés** (Espèces à la livraison, Mobile Money, Virement bancaire) et une précision libre (ex. numéro Mobile Money).
- **Panier acheteur** : choix Livraison / Retrait (si les deux sont proposés), zone (frais ajoutés au total, « gratuit » si 0), adresse ou point de repère, nom (obligatoire), mode de paiement parmi ceux du vendeur. Validation avec messages clairs en français. Affichage : sous-total, livraison, total.
- **Calcul serveur** : le total, les frais de zone et le mode de paiement sont **recalculés et validés côté serveur** dans `/api/orders` (jamais de confiance au navigateur). La commande enregistre `fulfillment`, `delivery_zone`, `delivery_address`, `delivery_fee`, `payment_method`.
- **Onglet Commandes** : afficher le mode de réception, la zone, l'adresse et le paiement choisi.
- **Lien par produit** : `https://wappshop.app/{slug}/{product_slug}` (le prototype utilise `/produit/{id}`). Ouvre la boutique avec la fiche produit déjà affichée. Boutons « Copier le lien du produit » côté vendeur (liste du catalogue) et acheteur (fiche). **Aperçu de partage** : balises Open Graph (`og:title`, `og:image` = première photo, `og:description` avec le prix) générées côté serveur pour que WhatsApp affiche une carte photo + prix.

### URL publique professionnelle et personnalisée

- Format cible : **`https://wappshop.app/{slug}`** (domaine court de la marque, sans préfixe technique type `/s/` ni paramètres). Évolution possible : sous-domaine `{slug}.wappshop.app`, puis domaine propre au vendeur.
- Le vendeur **choisit l'adresse de sa boutique** (champ « Adresse personnalisée » dans la configuration), en minuscules, chiffres et tirets, 3 à 40 caractères, **unique** (contrainte en base + vérification en direct avec message clair si déjà prise).
- Mots réservés interdits comme slug : `dashboard`, `login`, `register`, `admin`, `api`, `app`, `www`, `_next`, etc. Le routeur `[slug]` doit être placé de sorte que ces routes aient priorité.
- Le bouton « Copier le lien » copie toujours cette URL propre ; la boutique expose des métadonnées Open Graph pour un aperçu soigné dans WhatsApp.

### Format du message WhatsApp (`lib/whatsapp.ts`)

**Aucun emoji dans le message** : texte brut professionnel uniquement (les caractères `*` pour le gras WhatsApp sont autorisés).


```
*Nouvelle commande - {Nom_boutique}*
Commande n° {order_number}
Client : {nom}
Livraison : {zone} - {adresse}        (ou : Retrait en boutique : {adresse_retrait})

1. {Nom produit} ({Variante: valeur, ...}) x{qte} - {sous_total}
2. ...

Sous-total : {sous_total}
Frais de livraison : {frais}          (seulement si > 0)
*Total : {total}*
Paiement : {mode_de_paiement}

Merci de confirmer la disponibilité et les modalités.
```

- Numéro : ne garder que les chiffres (retirer `+`, espaces, tirets).
- Toujours utiliser `encodeURIComponent` sur le texte.
- Ne jamais compter uniquement sur `window.open` : les pop-ups peuvent être bloqués (navigateurs mobiles, pages intégrées dans un cadre). Le lien cliquable de l'écran de confirmation est la voie fiable.
- Valider le numéro WhatsApp (8 à 15 chiffres) à l'enregistrement et avertir si c'est un numéro de démonstration : un numéro invalide fait afficher une erreur côté WhatsApp.

## 6 bis. Suivi, statistiques et avis clients

### Statistiques vendeur (onglet « Stats »)
- Périodes : aujourd'hui, 7 jours, 30 jours.
- Indicateurs : **visiteurs** (visites anonymes uniques par session), **commandes envoyées** (clic sur « Valider sur WhatsApp »), **commandes livrées** (statut passé en `Livrée` par le vendeur), **taux de conversion** (commandes ÷ visiteurs, plafonné à 100 %) et note moyenne.
- Précision à afficher : l'application ne peut pas savoir si le message WhatsApp a réellement été envoyé ; seul le statut du vendeur fait foi.
- Comptage respectueux de la vie privée : aucun cookie de suivi tiers, aucune donnée personnelle ; un identifiant de session anonyme suffit.

### Preuve de confiance et avis (boutique publique)
- **Version 1** : sous le nom de la boutique, afficher « N commandes livrées » (calculé depuis les commandes au statut `Livrée`).
- **Version 2** : vraies étoiles (1 à 5) données par les clients, plus un commentaire facultatif (300 caractères max). Aucune étoile n'est calculée automatiquement à partir des statistiques.
- Le vendeur copie, depuis une commande livrée, un message contenant un **lien d'avis à usage unique** (`/{slug}/avis/{review_token}`) et l'envoie lui-même au client sur WhatsApp.
- Règles anti-fraude : avis possible **uniquement si la commande est `Livrée`**, **un seul avis par commande**, jeton aléatoire non devinable (uuid), validation et limitation de débit côté serveur ; le vendeur ne peut ni créer, ni modifier, ni supprimer un avis (il peut seulement le signaler).
- Affichage : moyenne et nombre d'avis en haut de la boutique ; liste des derniers avis dans l'onglet Stats.

## 7. Base de données (PostgreSQL / Supabase)

> Le « Vendeur » correspond à `auth.users` de Supabase (email + mot de passe hashé gérés par Supabase Auth). Ne jamais stocker de mot de passe en clair ni créer de table de mots de passe.

| Table | Colonnes |
|---|---|
| `shops` | `id` (uuid, PK), `user_id` (FK → auth.users, unique), `shop_name`, `slug` (unique), `logo_url`, `whatsapp_number`, `delivery_enabled`, `pickup_enabled`, `pickup_address`, `payment_methods` (text[]), `payment_note`, `about`, `opening_hours`, `social_url`, `announcement`, `created_at` |
| `categories` | `id`, `shop_id` (FK), `category_name`, `image_url` (nullable ; si vide, photo du premier produit de la catégorie), `created_at` |
| `products` | `id`, `shop_id` (FK), `category_id` (FK, nullable, `on delete set null`), `name`, `price` (numeric), `badge` (`none` \| `new` \| `promo`), `old_price` (nullable), `sold_out` (bool), `description`, `created_at` |
| `images` | `id`, `product_id` (FK, `on delete cascade`), `image_url`, `position` (int) |
| `variants` | `id`, `product_id` (FK, `on delete cascade`), `variant_name` (ex : Couleur, Taille), `variant_value` (ex : Rouge, L), `price_supplement` (numeric, défaut 0) |
| `orders` | `id`, `shop_id` (FK), `order_number`, `items_details` (jsonb), `total_amount` (numeric), `status` (enum : `new` \| `confirmed` \| `delivered`), `customer_name`, `fulfillment` (`delivery` \| `pickup`), `delivery_zone`, `delivery_address`, `delivery_fee`, `payment_method`, `created_at` |

| `events` | `id`, `shop_id` (FK), `type` (`visit` \| `order_sent`), `session_id` (anonyme), `created_at` |
| `reviews` | `id`, `shop_id` (FK), `order_id` (FK, **unique**), `rating` (1 à 5), `comment`, `created_at` |

Notes :
- `orders` reçoit aussi `review_token` (uuid aléatoire) et `reviewed_at` (nullable).
- RLS : `reviews` lisible publiquement (sans données personnelles) mais créée uniquement via la route API avec jeton valide et commande `Livrée` ; `events` écrit via API, lu uniquement par le vendeur propriétaire.
- `items_details` stocke un **instantané** des articles (nom, variantes choisies, quantité, prix unitaire, sous-total) pour que la commande reste lisible même si le produit change ensuite.
- **Recalculer le total côté serveur** dans `/api/orders` à partir des prix en base : ne jamais faire confiance au total envoyé par le navigateur.
- Ajouter des index sur `shop_id`, `product_id`, `slug`.

### Sécurité (Row Level Security — obligatoire)

- Activer la RLS sur toutes les tables.
- Le vendeur ne peut lire/écrire que les lignes dont la boutique lui appartient (`shops.user_id = auth.uid()`).
- Lecture **publique** (anonyme) autorisée uniquement sur `shops`, `categories`, `products`, `images`, `variants` pour la boutique publique ; **jamais** sur `orders`.
- Création de commande : uniquement via la route API serveur (clé service role), avec validation zod et limitation de débit simple.
- Buckets Storage : `logos` et `product-images` en lecture publique ; écriture limitée au dossier `{user_id}/…` du vendeur connecté.

## 7b. Statistiques et avis clients

### Statistiques (onglet « Stats » du tableau de bord, réservé au vendeur)
- Table `events` : `id`, `shop_id`, `type` (`visit` ou `checkout`), `session_id` (identifiant anonyme aléatoire, aucune donnée personnelle), `created_at`. Écriture uniquement via une route API serveur ; lecture limitée au propriétaire de la boutique (RLS).
- Indicateurs sur 3 périodes (aujourd'hui, 7 jours, 30 jours) : **visiteurs** (1 par session), **commandes envoyées** (clics sur « Valider ma commande » : ne prouve pas que le message est parti), **commandes livrées** (statut `delivered` : seuls vrais achats confirmés), **taux de conversion** (commandes / visiteurs), **chiffre d'affaires livré**, **note moyenne et derniers avis**.
- Ne pas compter le propriétaire connecté ni les robots ; états vides explicites ; expliquer sous les chiffres ce que mesure chaque indicateur.

### Avis clients (espace acheteur)
- Table `reviews` : `id`, `order_id` (FK, **unique** : un avis par commande), `shop_id`, `rating` (1 à 5), `comment` (300 caractères max, facultatif), `created_at`. La table `orders` reçoit une colonne `review_token` (uuid unique, non devinable).
- Lien d'avis : `https://wappshop.app/{slug}/avis/{review_token}`. Il ne fonctionne **que si la commande est `delivered`** et qu'aucun avis n'existe déjà. Le vendeur le copie depuis la commande livrée (« Copier la demande d'avis ») et l'envoie au client sur WhatsApp, en texte brut sans emoji.
- Le vendeur **ne peut ni créer, ni modifier, ni supprimer** un avis (insertion uniquement via la route API avec le jeton, aucune politique d'écriture vendeur). Prévoir plus tard un signalement.
- Affichage honnête en haut de la boutique publique : note moyenne en étoiles et nombre d'avis **seulement s'il y a au moins un avis**, plus « N commandes livrées » s'il y en a. Rien ne s'affiche tant qu'il n'y a pas de données réelles.
- Dans le prototype, les visites de démonstration sont simulées ; la vraie application ne doit afficher que des données réelles.

## 7c. Finitions de la boutique (validées)

- **Badges produit** : « Nouveau », « Promo » (avec ancien prix barré, `old_price` > `price`) et « Épuisé ». Un produit épuisé affiche un bouton désactivé « Épuisé » et ne peut pas être ajouté au panier (vérifier aussi côté serveur dans `/api/orders`).
- **Bandeau d'annonce** configurable, affiché en haut de la boutique (ex. « Livraison offerte dès 20 000 FCFA »).
- **Page « À propos »** (bouton dans l'en-tête) : présentation, horaires, zones de livraison et frais, adresse de retrait, modes de paiement, lien réseaux sociaux (n'accepter que `https://`), QR code de la boutique.
- **QR code** : généré à partir du lien public, visible dans « À propos » et dans l'Accueil vendeur. Production : exporter en PNG/PDF imprimable.
- **Mentions légales** : lien en pied de la boutique ouvrant conditions d'utilisation et confidentialité (modèle à faire relire par un juriste avant le lancement).
- **Liste de démarrage vendeur** (Accueil) avec barre de progression : logo, vrai numéro WhatsApp, 1 catégorie, 5 produits, livraison ou retrait défini, lien copié. Disparaît quand tout est fait.

## 8. Design, UX et image de marque

- **Nom** : WappShop. **Logo** : `public/logo.svg` — logo original (sac de shopping bleu nuit + bulle de discussion verte carrée contenant un « W »), volontairement distinct de l'icône WhatsApp (pas de bulle ronde ni de combiné téléphonique). À afficher via `<Logo />` sur **toutes les interfaces** : connexion/inscription, header du tableau de bord, favicon, et un petit « Propulsé par WappShop » en pied de la boutique publique. Ne pas réutiliser le logo officiel WhatsApp.
- **Thème** : **fond blanc uniquement** (pas de mode sombre dans le MVP ; forcer `color-scheme: light`).
- **Style** : minimaliste, moderne, inspiré des standards de l'e-commerce actuels. Beaucoup d'espace blanc, coins arrondis (`rounded-xl`), ombres très légères, typographie sans-serif lisible (Inter).
- **Palette** (à définir comme variables Tailwind) :
  - Fond : `#FFFFFF` / `#F9FAFB`
  - Texte principal : `#111827` (bleu nuit, couleur du logo)
  - Texte secondaire / bordures : `#6B7280` / `#E5E7EB`
  - **Action principale (CTA) : vert WhatsApp `#25D366`** (hover `#1EBE5A`), réservé aux actions clés (« Valider ma commande sur WhatsApp », « Enregistrer », « Copier le lien »)
- **Mobile-First** : zones tactiles ≥ 44 px, navigation en bas dans le tableau de bord sur mobile, CTA toujours accessibles au pouce, images optimisées (`next/image`, lazy loading), états de chargement (skeletons), états vides explicites, messages d'erreur clairs en français.
- **Accessibilité** : contrastes suffisants (texte blanc sur `#25D366` → utiliser un vert plus foncé si le contraste est insuffisant), labels de formulaire, `aria-label` sur les boutons icônes.

## 9. Périmètre du MVP

**Inclus** : tout ce qui est décrit ci-dessus.

**Ajouts validés** : livraison/retrait avec zones et frais, modes de paiement, liens par produit (section 6), connexion sans mot de passe par code email, galerie photos swipeable (section 6), statistiques vendeur et avis clients (section 7b). Déjà dans le prototype : catégories avec photo, recherche, bouton WhatsApp flottant. Ajoutés aussi au prototype : badges Nouveau/Promo/Épuisé, page À propos, QR code, mentions légales, bandeau d'annonce, liste de démarrage (section 7c).

**Exclus pour l'instant** (ne pas développer sans demande explicite) : paiement en ligne, gestion de stock, codes promo, multi-boutiques par vendeur, domaine personnalisé, statistiques avancées, notifications push, multilingue.

## 10. Conventions de code

- TypeScript strict, pas de `any`. Validation zod aux frontières (formulaires + routes API).
- Composants serveur par défaut ; `"use client"` uniquement quand nécessaire (panier, formulaires interactifs).
- Petits composants réutilisables, un fichier = une responsabilité.
- Les montants sont formatés via `lib/format.ts` (devise configurable par constante).
- Commits courts et explicites (`feat:`, `fix:`, `chore:`).
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.

## 11. Plan de travail suggéré

1. Initialiser le projet (Next.js, Tailwind, shadcn, Supabase) + composant `Logo` + thème.
2. Schéma SQL + politiques RLS + buckets Storage.
3. Authentification (email + Google) + middleware de protection.
4. Configuration de la boutique + lien public copiable.
5. Catégories (CRUD).
6. Produits : CRUD, **upload multi-images mobile**, variantes.
7. Boutique publique : en-tête, catégories, grille, quantités, variantes.
8. Panier flottant + checkout WhatsApp + enregistrement de la commande.
9. Onglet Commandes + changement de statut.
10. Passe finale : tests sur mobile réel, accessibilité, performances, SEO/Open Graph.

## 12. Définition de « terminé »

Une fonctionnalité est terminée quand : elle fonctionne sur mobile (iOS Safari + Android Chrome), `npm run lint` et `npm run typecheck` passent, les règles RLS sont vérifiées, et les textes de l'interface sont en français.

## 13. Prototype de référence

Un prototype HTML fonctionnel (`wappshop.html`, données en `localStorage`, sans vraie authentification) valide le parcours et le design : espace vendeur, boutique publique, panier, checkout WhatsApp, commandes. Le reproduire fidèlement (écrans, textes français, couleurs, logo, fond blanc) dans l'application Next.js + Supabase, en remplaçant le stockage local par la base de données et l'authentification réelle.

## 14. Documents associés

- `PHASES.md` : plan de construction **par phases** et messages à donner à Claude Code. Travailler une phase à la fois, valider avant la suivante.
- `LANCEMENT.md` : plan de lancement (premiers vendeurs, offres, page d'accueil, domaine, légal).

