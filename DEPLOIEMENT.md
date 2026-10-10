# Mise en ligne de WappShop

## 1. Base de données (Supabase)
1. SQL Editor : lancer `supabase/schema.sql` (nouvelle base) **ou**, sur une base existante, les fichiers `supabase/phase3.sql` puis `supabase/phase5.sql`.
2. Authentication > URL Configuration : mettre l'adresse du site en « Site URL » et ajouter `https://VOTRE-DOMAINE/auth/callback` dans « Redirect URLs » (garder `http://localhost:3000/auth/callback` pour les tests).
3. Connexion : par email avec un code à 6 chiffres uniquement (pas de connexion Google).
4. Authentication > Emails : expiration du code à 10 minutes ; en production, brancher un SMTP personnalisé (domaine avec SPF/DKIM) pour éviter le spam.
5. Sauvegardes : le plan gratuit n'en fait pas. Prendre un plan avec sauvegardes quotidiennes (Pro) avant d'ouvrir aux clients, ou exporter régulièrement avec `pg_dump` (Project Settings > Database > Connection string).
6. Vérifier que le projet ne se met pas en pause (plan gratuit : pause après une semaine d'inactivité) et que le plan autorise un usage commercial.

## 2. Hébergement (Vercel)
1. Importer le dépôt GitHub (privé).
2. Variables d'environnement (Settings > Environment Variables) :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | adresse du projet Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | clé publiable |
| `SUPABASE_SECRET_KEY` | clé secrète (jamais dans le navigateur ni sur GitHub) |
| `NEXT_PUBLIC_APP_URL` | adresse du site, ex. `https://wappshop.app` (sans « / » final) |

3. Déployer. Chaque `git push` sur `main` redéploie.
4. Nom de domaine : Settings > Domains, puis mettre à jour `NEXT_PUBLIC_APP_URL` et les URL de redirection Supabase.

## 3. Vérifications après déploiement
- S'inscrire soi-même comme vendeur sur le site en ligne (code email reçu, vérifier aussi les spams).
- Créer boutique, catégorie, produit avec photos, livraison et paiement.
- Ouvrir la boutique depuis un autre téléphone, passer une commande : elle doit apparaître dans l'onglet Commandes.
- Passer la commande en « Livrée », copier le message d'avis, donner un avis depuis le lien (un second essai doit être refusé).
- Partager le lien d'un produit dans WhatsApp : l'aperçu doit montrer la photo et le prix.
- `https://VOTRE-DOMAINE/robots.txt` et `/sitemap.xml` répondent.
- Faire la checklist « deux vendeurs » de `PHASES.md`.

## 4. Mentions légales
Le texte des mentions légales (boutique publique) est un modèle : à faire relire par un juriste du pays avant le lancement.
