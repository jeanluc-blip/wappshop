# PHASES.md — Construire WappShop avec Claude Code

Ce document complète `CLAUDE.md` (qui décrit **quoi** construire). Ici : **dans quel ordre** et **comment vérifier**.

## Règles de travail

1. Une seule phase à la fois. Ne pas commencer la suivante sans validation.
2. À la fin de chaque phase : `npm run lint`, `npm run typecheck`, test sur un vrai téléphone, puis un commit (`feat: phase N ...`).
3. Claude Code termine chaque phase par un résumé court et la liste des vérifications à faire.
4. Le fichier `wappshop.html` (prototype) est la référence visuelle : écrans, textes français, couleurs, logo, fond blanc.

## Préparation (à faire par vous, une seule fois)

| Compte | À faire |
|---|---|
| GitHub | Créer un dépôt privé `wappshop`. |
| Supabase | Créer un projet. Récupérer l'URL, la clé anonyme et la clé de service (à mettre dans `.env.local`, jamais dans GitHub). |
| Google Cloud | Créer des identifiants OAuth pour la connexion Google, puis les saisir dans Supabase (Authentication, Providers). |
| Envoi d'emails | Créer un compte chez un service d'envoi (SMTP) pour les codes de connexion, puis le brancher dans Supabase. Sans cela, les codes peuvent arriver en spam. |
| Hébergement | Compte Cloudflare (usage commercial autorisé en gratuit d'après mes recherches, à revérifier) ou Vercel Pro. Vercel gratuit : tests seulement. |
| Domaine | Plus tard. Une adresse gratuite `.pages.dev` ou `.vercel.app` suffit pour tester. |

## Message de départ à donner à Claude Code

> Lis `CLAUDE.md` et `PHASES.md`. Ouvre `wappshop.html` comme référence visuelle. Commence par la **phase 0** uniquement. Pose-moi une question seulement si une information est bloquante. À la fin, résume ce que tu as fait et ce que je dois vérifier.

Pour chaque phase suivante : « Réalise uniquement la **phase N** de `PHASES.md`. »

## Les phases

**Phase 0 — Initialisation.** Projet Next.js (TypeScript strict), Tailwind, shadcn/ui, structure de dossiers de `CLAUDE.md`, composant `Logo` avec `logo.svg`, thème **fond blanc uniquement**, `.env.example`, page d'accueil provisoire.
*Vérifier :* `npm run dev` fonctionne, le logo s'affiche, le fond est blanc même si le téléphone est en mode sombre.

**Phase 1 — Base de données et sécurité.** Script SQL de toutes les tables (`shops`, `categories`, `products`, `images`, `variants`, `orders`, `delivery_zones`, `events`, `reviews`), contraintes d'unicité (slug, un avis par commande), règles RLS, buckets Storage `logos` et `product-images`.
*Vérifier :* avec deux utilisateurs de test, chacun ne lit et n'écrit que ses propres lignes ; un visiteur anonyme ne peut **jamais** lire `orders`.

**Phase 2 — Connexion sans mot de passe.** Écran unique : Google ou code à 6 chiffres par email (10 minutes, 5 essais, renvoi après 60 secondes), middleware qui protège `/dashboard`, assistant de première connexion en 3 étapes.
*Vérifier :* un nouvel email crée un compte ; un code expiré ou faux est refusé ; Google et email sur la même adresse donnent le même compte ; les emails n'arrivent pas en spam.

**Phase 3 — Espace vendeur.** Configuration de la boutique (nom, logo, WhatsApp, adresse personnalisée unique avec mots réservés), catégories avec photo, produits (photos multiples avec **bouton d'import fonctionnel sur iPhone et Android**, variantes, badges, stock), livraison, retrait, zones, paiements, page À propos, bandeau, liste de démarrage.
*Vérifier :* import de plusieurs photos depuis un téléphone réel ; modification et suppression ; un vendeur ne voit pas les données d'un autre.

**Phase 4 — Boutique publique.** Page `/[slug]` rendue côté serveur : en-tête, annonce, catégories rondes, recherche, grille avec **galerie de photos swipeable**, bouton « Ajouter au panier », choix des variantes, fiche produit, À propos, QR code, mentions légales, comptage anonyme des visites.
*Vérifier :* fluidité sur téléphone d'entrée de gamme, chargement rapide des images (WebP, lazy-loading), produit épuisé non commandable.

**Phase 5 — Panier, commande et WhatsApp.** Panier, choix livraison ou retrait, zone, adresse, paiement, route `/api/orders` qui **recalcule tout côté serveur** (prix, suppléments, frais, stock), écran de confirmation avec lien « Ouvrir WhatsApp » et « Copier le message » (sans emoji), onglet Commandes avec statuts, lien par produit avec aperçu de partage (Open Graph : photo + prix).
*Vérifier :* une commande envoyée depuis un autre téléphone arrive dans l'onglet Commandes du bon vendeur ; un total falsifié dans le navigateur est ignoré.

**Phase 6 — Statistiques et avis.** Onglet Stats (visiteurs, commandes envoyées, livrées, conversion, chiffre d'affaires livré), lien d'avis à usage unique valable seulement pour une commande livrée, étoiles et nombre de commandes livrées affichés sur la boutique **uniquement s'il y a des données réelles**.
*Vérifier :* le vendeur ne peut pas écrire ni modifier un avis ; un seul avis par commande ; pas de visites fictives.

**Phase 7 — Finitions et mise en ligne.** SEO et Open Graph, accessibilité, performances, pages d'erreur en français, sauvegardes de la base, déploiement, variables d'environnement, adresse de redirection Google et Supabase, nom de domaine si prêt.
*Vérifier :* toute la checklist ci-dessous.

## Checklist des tests avec deux vendeurs

Créer deux comptes (A et B) avec chacun une boutique, des produits et une commande.

- [ ] A ne voit ni les produits, ni les commandes, ni les statistiques de B.
- [ ] Modifier directement l'identifiant d'une commande ou d'un produit de B depuis le compte A est refusé.
- [ ] Les images de B ne peuvent pas être écrasées par A.
- [ ] Deux boutiques ne peuvent pas avoir la même adresse.
- [ ] Un visiteur non connecté voit les boutiques mais pas les commandes.
- [ ] Une commande passée chez A n'apparaît jamais chez B.
- [ ] Le lien d'avis d'une commande de A ne fonctionne pas pour une commande de B.
- [ ] Un client ne peut pas modifier le total ni le prix envoyé à l'API.

## Mise en ligne en deux temps (les vendeurs d'abord)

**Principe :** ouvrir d'abord le site aux vendeurs, puis aux clients. Les vendeurs s'inscrivent et préparent leur catalogue pendant que la partie commande est terminée.

**Étape 1 : accès vendeurs (phases 0 à 3, plus une mise en ligne courte).**
- Les vendeurs peuvent : s'inscrire (code email ou Google), créer leur boutique, leurs catégories, leurs produits avec photos et variantes, et régler livraison et paiement.
- Ajouter dès cette étape un **aperçu de la boutique** (la page publique minimale de la phase 4, sans panier) pour que chacun voie le résultat.
- Ce que les vendeurs **ne peuvent pas encore faire** : recevoir de vraies commandes. Le dire clairement : « accès anticipé : préparez votre boutique, les commandes arrivent bientôt ».
- Avant d'ouvrir : test avec deux comptes vendeurs (checklist ci-dessous), codes email reçus hors spam, hébergement et Supabase sur des plans qui acceptent l'usage commercial et ne se mettent pas en pause.

**Étape 2 : accès clients (phases 4 et 5).**
- Boutique publique complète, panier, commande sur WhatsApp, onglet Commandes.
- Ouvrir d'abord à 3 ou 4 vendeurs de l'étape 1, puis à tous.

**Mise en ligne courte, à refaire à chaque étape :**
1. Envoyer le dossier sur le dépôt GitHub privé de la vraie application.
2. Dans Vercel (ou Cloudflare), importer le dépôt, ajouter les variables d'environnement du fichier `.env.local`, puis déployer.
3. Dans Supabase, ajouter l'adresse du site dans les URL de redirection ; configurer la connexion Google avec la même adresse.
4. S'inscrire soi-même comme vendeur sur le site en ligne et vérifier tout le parcours avant d'inviter quelqu'un.
