# WappShop

Boutique en ligne avec commandes sur WhatsApp. Voir `CLAUDE.md` (quoi construire) et `PHASES.md` (dans quel ordre).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs (jamais commiter ce fichier)
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

## Réglages Supabase requis pour la connexion (phase 2)

- Authentication > URL Configuration : ajouter `http://localhost:3000/auth/callback` (et l'adresse de production + `/auth/callback`) dans les URL de redirection.
- Authentication > Providers > Google : activer, avec l'identifiant et le secret OAuth Google.
- Authentication > Email : durée de validité du code à 600 secondes ; longueur du code : 6.
- Authentication > Email Templates (« Confirm signup » et « Magic Link ») : le corps doit afficher le code avec `{{ .Token }}`.
- Production : brancher un SMTP personnalisé (sinon les codes arrivent en spam et l'envoi est limité).

## Phases 3 et 4 : espace vendeur et boutique publique

- Supabase > SQL Editor : lancer `supabase/phase3.sql` (colonne `position` des variantes et des zones) si la base existait déjà.
- `.env.local` : `SUPABASE_SECRET_KEY` est nécessaire pour compter les visites (`/api/visit`) ; sans elle, rien n'est compté.

## Phases 5 à 7 : commandes, statistiques, avis, mise en ligne

- Aucun nouveau script SQL : `supabase/schema.sql` contient déjà `orders`, `events` et `reviews`.
- `SUPABASE_SECRET_KEY` est **obligatoire** (Vercel > Settings > Environment Variables) : sans elle, `/api/orders`, `/api/reviews` et le comptage des visites ne fonctionnent pas.
- `src/lib/features.ts` : `CHECKOUT_ENABLED = true` ouvre la commande aux clients. Repasser à `false` pour revenir à l'« accès anticipé » (panier visible, commande fermée).
- Commande : `POST /api/orders` recalcule prix, suppléments, frais de livraison, disponibilité et paiement à partir de la base ; tout total envoyé par le navigateur est ignoré.
- Avis : lien `/{boutique}/avis/{jeton}`, valable seulement pour une commande « Livrée », un seul avis par commande.
- Liens produit : `/{boutique}/{id du produit}` (aperçu Open Graph : photo et prix).
- Mise en ligne et sauvegardes : voir `MISE_EN_LIGNE.md`.

