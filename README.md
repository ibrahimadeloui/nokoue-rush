# Nokoué Rush

Course sans fin à trois voies dans les rues et les marchés de Cotonou et Porto-Novo, autour du lac Nokoué. Aïcha Dossou file devant l’inspecteur Sènou. Le jeu tourne dans le navigateur, pensé d’abord pour un téléphone en portrait, et se déploie comme un site statique.

Créé par **Ibrahim ADELOUI**, développeur à Porto-Novo, Bénin.

## Lancer en local

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvre [http://127.0.0.1:47321](http://127.0.0.1:47321). Le serveur écoute sur toutes les interfaces, tu peux donc le joindre depuis un téléphone sur le même réseau.

## Build et déploiement

```bash
npm run build
npm run preview
```

Le dossier `dist/` est un site statique (HTML, JS, CSS, polices). Tu peux le publier tel quel :

- Netlify, Cloudflare Pages ou Vercel : indique `npm run build` et le dossier `dist`
- GitHub Pages : publie le contenu de `dist`
- n’importe quel hébergeur de fichiers statiques

Les chemins sont relatifs (`base: './'`), le jeu fonctionne aussi dans un sous-dossier.

## Contrôles

| Action | Tactile | Clavier |
| --- | --- | --- |
| Changer de voie | balayer à gauche ou à droite | flèches, A/D ou Q/D |
| Sauter | balayer vers le haut | flèche haut, W, Z ou espace |
| Glisser | balayer vers le bas | flèche bas ou S |
| Planche | double tape, ou le bouton Planche | F ou Maj |
| Pause | bouton pause | P ou Échap |
| Son | bouton haut-parleur | M |

ZQSD et WASD sont tous les deux pris en compte.

## Règles

- Trois voies. La vitesse monte avec la distance.
- Les caisses et les tonneaux se sautent. Les banderoles (Tissus, Glisse) se passent en glissant. On peut aussi changer de voie.
- Un taxi ou un keke, c’est une collision de plein fouet : la course s’arrête, sauf si une planche encaisse le choc.
- Le premier faux pas (caisse, tonneau, banderole) rapproche Sènou. Un second faux pas pendant qu’il est proche termine la partie. Il a toujours une réplique.
- Les cauris dorés remplissent la bourse et font grimper le multiplicateur. Un gros cauri vaut 5.
- Deux bonus : l’aimant à cauris et le multiplicateur ×2.
- La bourse, le meilleur score, la planche, les missions, le pseudo, la série quotidienne et le son restent dans `localStorage` (clé `nokoue-rush-v1`).

## Quartiers

La course enchaîne quatre zones. Le ciel, le sol et les décors changent, et une pastille annonce le lieu.

1. **Marché Dantokpa** — rues de Cotonou, étals, tissus, palmiers, arche, taxi jaune et vert.
2. **Lac Nokoué** — ponton de Ganvié, cases sur pilotis, pirogues, eau, banderole Filet.
3. **Quartier du patrimoine** — Porto-Novo, façades afro-brésiliennes, silhouette de la Grande Mosquée, palais.
4. **Route de Fidjrosse** — sable, océan, parasols, palmiers.

Puis la boucle reprend. Les taxis sont plus rares sur le lagon, plus présents à Porto-Novo.

## Missions et défi du jour

Trois missions sont actives, par exemple « Ramasse 300 cauris », « Esquive 10 taxis », « Glisse sous 5 banderoles ». Le bouton Récupérer verse les cauris et de l’expérience. Le rang monte : Coursier, Éclaireur, Pilote du lagon, et au-delà.

Le défi du jour change à minuit (heure de l’appareil). Le terminer plusieurs jours de suite augmente la série et le bonus de cauris.

## Classement

À la fin d’une course, entre un pseudo (2 à 16 lettres, chiffres, espaces, points, tirets). Le jeu publie le score s’il est cohérent avec la durée :

- course d’au moins 3 secondes ;
- le score ne dépasse pas environ 900 points par seconde ;
- les cauris ne dépassent pas environ 12 par seconde ;
- la distance reste possible à la vitesse du jeu.

Sans configuration, le top 50 est gardé sur l’appareil. Avec Supabase, le même écran lit le top 50 mondial et ton record pour ce pseudo.

### Activer le classement en ligne

1. Crée un projet gratuit sur [supabase.com](https://supabase.com).
2. Ouvre **SQL Editor** et exécute :

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 16),
  score integer not null check (score >= 0 and score < 2000000),
  cauris integer not null default 0 check (cauris >= 0),
  zone text not null default '',
  duration real not null check (duration > 0.4),
  distance real not null default 0 check (distance >= 0),
  created_at timestamptz not null default now(),
  constraint score_pace check (score < duration * 900 + 80),
  constraint cauris_pace check (cauris < duration * 12 + 10)
);

alter table public.scores enable row level security;

create policy "lecture publique"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "insertion contrôlée"
  on public.scores for insert
  to anon, authenticated
  with check (
    char_length(name) between 2 and 16
    and score >= 0
    and score < duration * 900 + 80
    and duration > 0.4
    and cauris >= 0
    and cauris < duration * 12 + 10
  );
```

Il n’y a pas de politique `update` ni `delete` : un visiteur anonyme ne peut ni modifier ni effacer les scores.

3. Dans **Project Settings → API**, copie l’URL du projet et la clé **anon public** (pas la clé `service_role`).
4. À la racine du jeu, copie `.env.example` vers `.env` :

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ta_cle_anon_publique
```

5. Relance `npm run dev`, ou `npm run build` avant de publier `dist/`. Les variables `VITE_` sont inscrites dans le build. Sans `.env`, le jeu reste jouable et le classement reste local.

## Musique

Les pistes sont originales et synthétisées dans le navigateur, sans échantillon protégé. Le menu, Dantokpa, le lagon, Porto-Novo et Fidjrosse ont chacun un rythme : cloche façon gankogui, tambour parlant, basse et balafon, avec une variante afrobeat pour le patrimoine et une variante plus claire pour la plage. Le sifflet de Sènou, le klaxon du taxi et le carillon des cauris sont aussi générés. Tout boucle sur la grille rythmique.

## Planches

La Pirogue Bleue est offerte. Les autres s’achètent avec les cauris, dans la boutique.

| Planche | Prix | Tant qu’elle encaisse |
| --- | --- | --- |
| Pirogue Bleue | incluse | sauts plus hauts |
| Wax Rouge | 90 | multiplicateur +1 |
| Taxi-Brousse | 220 | la course accélère |
| Palais | 460 | aimant à cauris, qui reste un moment après le choc |

Une seule activation par course.

## Vérifier

Avec Chrome installé :

```bash
npm run dev
node scripts/playthrough.mjs
```

Le script joue une partie en 390×844 : voies, saut, glissade, cauris, faux pas, collision frontale, planche, boutique, missions, classement local, rejet d’un score incohérent, et les quatre quartiers.

## Limites

- Le rendu reste low-poly, plus chaud et plus lisible, mais pas une image Pixar filmée.
- Sènou est vu de trois-quarts arrière. Son portrait (moustache, casquette, sifflet) est sur l’écran de fin.
- La musique est synthétisée, pas enregistrée avec des instruments.
- Le classement en ligne dépend de Supabase. Sans clés, il reste sur l’appareil.
- Les contrôles anti-triche sont des bornes de vraisemblance, pas une signature serveur.
- Le navigateur décide s’il verrouille le portrait.
