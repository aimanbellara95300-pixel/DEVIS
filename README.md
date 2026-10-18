# Devis Viviworks

Application React pour créer des devis, suivre les chantiers, facturer et télécharger les PDF. Les données sont enregistrées dans Supabase, pour le compte connecté.

## Base Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Ouvre SQL Editor et exécute `supabase/schema.sql`.
3. Dans Authentication → Providers → Email, tu peux désactiver la confirmation d'e-mail pour un usage interne.
4. Copie l'URL du projet et la clé `anon` dans un fichier `.env` (voir `.env.example`) :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ta_cle_anon
```

Sur Netlify, ajoute les mêmes noms dans Site configuration → Environment variables, puis relance le déploiement.

## Lancer en local

```bash
npm install
npm run dev
```

## Publier sur Netlify

1. Créer un site sur [Netlify](https://app.netlify.com) et relier ce dossier (glisser-déposer du dépôt Git, ou « Import an existing project »).
2. Le fichier `netlify.toml` indique déjà :
   - commande de build : `npm run build`
   - dossier publié : `dist`
   - redirection de toutes les adresses vers `index.html` (indispensable pour une application React).
3. Node 20 est demandé dans `netlify.toml`.
4. Lancer le déploiement. L'adresse du site sera du type `https://nom-du-site.netlify.app`.

Déploiement sans Git : `npm run build`, puis glisser le dossier `dist` dans Netlify Drop. Les redirections du fichier `public/_redirects` sont copiées dans `dist`.

## À savoir

- Devis, clients, fiches PDF et réglages sont dans Supabase. Au premier login, ce qui était encore enregistré dans ce navigateur est copié si le compte est vide.
- La lecture automatique des photos d'offres fournisseur n'est pas incluse. Les lignes et les montants se saisissent à la main. La photo d'une facture de dépense est enregistrée avec le devis.
