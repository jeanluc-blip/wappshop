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
- `src/lib/features.ts` : `CHECKOUT_ENABLED` reste à `false` jusqu'à la phase 5 (le panier affiche alors « commande bientôt »).
