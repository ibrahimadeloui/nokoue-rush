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
- La bourse, le meilleur score, la planche équipée et le son coupé restent dans `localStorage` (clé `nokoue-rush-v1`).

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

Le script joue une partie en 390×844 : voies, saut, glissade, cauris, faux pas, collision frontale, planche, boutique, et rechargement pour la persistance.

## Limites

- Le rendu est low-poly et stylisé, pas une scène Pixar cinématographique.
- La musique et les bruitages sont générés en WebAudio, pas des fichiers enregistrés.
- Sènou est vu de trois-quarts arrière, sur sa moto verte et or. Son portrait (moustache, casquette, sifflet) est sur l’écran de fin.
- Le navigateur décide s’il verrouille le portrait.
- Pas de compte en ligne ni de classement : tout reste sur l’appareil.
