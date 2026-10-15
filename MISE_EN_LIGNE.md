# Mise en ligne de WappShop

## 1. Avant de publier (sur votre ordinateur)

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Les trois commandes doivent se terminer sans erreur. Corrigez-les avant de publier : un test de type ou de lint qui échoue peut bloquer le déploiement.

## 2. Variables d'environnement (Vercel > Settings > Environment Variables)

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | adresse du projet Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | clé publiable |
| `SUPABASE_SECRET_KEY` | clé secrète (serveur uniquement, jamais dans GitHub) |
| `NEXT_PUBLIC_APP_URL` | adresse du site, sans `/` final (ex. `https://wappshop.vercel.app`) |
| `ADMIN_EMAILS` | votre adresse email de connexion à WappShop (plusieurs : séparées par des virgules). Seules ces adresses accèdent à `/admin` |
| `ASSISTANT_API_KEY` | clé du fournisseur de l'assistant. Gratuit possible avec Google Gemini : clé créée sur aistudio.google.com (Get API key), offre gratuite limitée |
| `ASSISTANT_MODEL` | facultatif : nom du modèle (par défaut `gemini-2.5-flash-lite`). Les noms changent : en cas d'erreur, prendre un modèle « Flash » gratuit listé dans AI Studio |
| `ASSISTANT_BASE_URL` | facultatif : autre fournisseur compatible OpenAI (par défaut Gemini : `https://generativelanguage.googleapis.com/v1beta/openai`) |
| `ANTHROPIC_API_KEY` | facultatif : à la place de `ASSISTANT_API_KEY`, pour utiliser Claude (payant à l'usage) |
| `ASSISTANT_DAILY_LIMIT` | facultatif : messages par vendeur et par jour (par défaut 30) |

Après chaque changement de variable : Deployments > Redeploy.

## 3. Supabase

- **Script `supabase/phase9.sql`** : à coller dans Supabase > SQL Editor puis « Run » (une fois ; relançable sans danger). Il crée la messagerie administrateur/vendeurs et le compteur de l'assistant. Tant qu'il n'est pas lancé, la messagerie et l'assistant affichent « bientôt disponible ».
- **Script `supabase/phase8.sql`** : à coller dans Supabase > SQL Editor puis « Run » (une seule fois, sans danger s'il est relancé). Il active les produits en vedette, le numéro WhatsApp du client, l'origine des visiteurs et les statistiques par produit. Tant qu'il n'est pas lancé, le site fonctionne normalement : ces quatre fonctions restent simplement inactives.
- Authentication > URL Configuration : **Site URL** = adresse du site ; **Redirect URLs** = `{adresse}/auth/callback`.
- Authentication > Email Templates (« Magic Link » et « Confirm signup ») : afficher `{{ .Token }}`, pas `{{ .ConfirmationURL }}`.
- Authentication > Providers > Google : identifiant et secret OAuth ; dans Google Cloud, l'URI de redirection autorisé est la « Callback URL » indiquée par Supabase.
- Production : brancher un SMTP personnalisé (sinon les codes arrivent en spam et l'envoi est limité).
- Vérifier que les plans (Vercel, Supabase) acceptent l'usage commercial et ne se mettent pas en pause.

## 4. Sauvegardes de la base

- Supabase gratuit : pas de sauvegarde automatique téléchargeable. Faire un export régulier : Database > Backups (si disponible) ou, depuis votre ordinateur avec la commande `pg_dump` et l'adresse de connexion du projet (Settings > Database), au moins **une fois par semaine** et avant chaque changement important de la base.
- Supabase Pro : sauvegardes quotidiennes incluses (à activer avant l'ouverture aux clients).
- Les photos sont dans Storage (`logos`, `product-images`) : elles ne sont pas dans l'export de la base. Prévoir une copie périodique.
- Tester une restauration au moins une fois, sur un projet de test.

## 5. Checklist à deux vendeurs (créer deux comptes A et B)

- [ ] A ne voit ni les produits, ni les commandes, ni les statistiques de B.
- [ ] Modifier directement l'identifiant d'une commande ou d'un produit de B depuis le compte A est refusé.
- [ ] Les images de B ne peuvent pas être écrasées par A.
- [ ] Deux boutiques ne peuvent pas avoir la même adresse.
- [ ] Un visiteur non connecté voit les boutiques mais pas les commandes.
- [ ] Une commande passée chez A n'apparaît jamais chez B.
- [ ] Le lien d'avis d'une commande de A ne fonctionne pas pour une commande de B (essayer `/{boutique-B}/avis/{jeton de A}` : « Lien invalide »).
- [ ] Un client ne peut pas modifier le total ni le prix envoyé à l'API.

## 6. Tests de bout en bout (sur un vrai téléphone)

1. Boutique : ouvrir `/{boutique}`, ajouter des produits (avec et sans variantes) au panier.
2. Commande : livraison avec zone, puis retrait ; vérifier le message WhatsApp (sans emoji), le lien « Ouvrir WhatsApp » et « Copier le message ».
3. Depuis un **autre téléphone**, passer une commande : elle apparaît dans l'onglet Commandes du bon vendeur (pastille « Nouvelle »).
4. Passer la commande à « Livrée » : « N commandes livrées » apparaît sur la boutique (après au plus 1 minute).
5. « Copier la demande d'avis », ouvrir le lien : donner une note ; une deuxième tentative affiche « Avis déjà enregistré ».
6. Stats : visiteurs, commandes envoyées et livrées, chiffre d'affaires, avis.
7. Lien produit : coller `/{boutique}/{id}` dans WhatsApp : carte avec photo et prix.
8. Importer plusieurs photos depuis iPhone (Safari) et Android (Chrome).
9. Partage : depuis la fiche d'un produit, « Partager » ouvre la feuille avec l'image ; vérifier le menu natif du téléphone (WhatsApp, Instagram, TikTok, Facebook), le téléchargement de l'image et les boutons WhatsApp, Facebook, Telegram, X.
10. Origines : ouvrir un lien reçu par « Partager » (contient `?src=...`) depuis un autre téléphone ; la visite apparaît dans Stats sous le bon réseau (après `phase8.sql`).
11. Vedette : « Mettre en vedette » sur un produit ; il apparaît en premier dans la section « En vedette » de la boutique.
12. Téléphone client : passer une commande avec un numéro ; le bouton « Écrire au client sur WhatsApp » apparaît dans Commandes.
13. Espace administrateur : connecté avec l'email de `ADMIN_EMAILS`, ouvrir `/admin` ; avec un autre compte vendeur, `/admin` doit afficher « Page introuvable ». Envoyer un message à un vendeur ; il apparaît avec une pastille dans son onglet Messages ; sa réponse apparaît en « non lu » chez vous.
14. Annonce : envoyer une annonce à « Vendeurs sans produit » et vérifier la réception chez un vendeur de test.
15. Assistant administrateur : `/admin/assistant`, demander « Qui dois-je accompagner en priorité ? » ; vérifier la dictée, l'envoi automatique et le bouton Copier. Un compte non administrateur doit recevoir une erreur 403 sur `/api/admin-assistant`.
16. Assistant vendeur : poser une question (écrite puis dictée sur Chrome/Android) ; vérifier la limite quotidienne.
17. Affiche : `/{boutique}/affiche` s'imprime sur une page A4 avec le QR code.

## 7. Après la mise en ligne

- Vérifier `{adresse}/robots.txt` et `{adresse}/sitemap.xml`.
- S'inscrire soi-même comme vendeur sur le site en ligne et parcourir tout le parcours avant d'inviter quelqu'un.
- Ouvrir d'abord à 3 ou 4 vendeurs, puis à tous.
- Nom de domaine : quand il est prêt, l'ajouter dans Vercel (Domains), mettre à jour `NEXT_PUBLIC_APP_URL`, le Site URL et les Redirect URLs de Supabase, et l'écran de consentement Google.
