# Jeu du Dictionnaire

[![Licence : CC BY-SA 4.0](https://img.shields.io/badge/Licence-CC%20BY--SA%204.0-blue.svg)](LICENSE)

Jeu de bluff en français, mobile-first, joué entre téléphones sur un réseau local.

L'application est **en construction, étape par étape** : [`PLAN.md`](PLAN.md) est la
spécification complète *et* le plan de build. L'état d'avancement est en §8 de ce
document, et la première phase (l'outillage) est faite.

## Jouer

En ligne, sur le domaine du projet :

**https://jeududictionnaire.fr/**

Chaque joueur ouvre l'adresse sur son téléphone, crée une salle, et partage le
code de salle. Les téléphones se parlent **directement entre eux**, sans serveur
de jeu : le transport est pair à pair (WebRTC), et le code de salle est le mot de
passe de la partie.

Les sources du jeu sont sur GitHub : <https://github.com/sd65/jeududictionnaire>.

En local, sur un réseau Wi-Fi :

```bash
npm install

npm run dev        # serveur de dev, accessible par les téléphones du Wi-Fi
npm test           # les tests (Vitest)
npm run typecheck  # les types
npm run build      # le build dans dist/
npm run serve      # sert dist/ sur le réseau local et affiche l'URL à ouvrir
```

Pour jouer à plusieurs sur des téléphones : `npm run build && npm run serve`, puis
ouvrir l'URL affichée sur chaque téléphone.

## Contenu du dépôt

| Chemin | Rôle |
|---|---|
| [`PLAN.md`](PLAN.md) | spécification du jeu et plan de build (**source de vérité**) |
| [`src/game/`](src/game/) | les règles du jeu, en pur (aucun React, aucun réseau) |
| [`src/net/`](src/net/) | le transport (P2P) et le protocole |
| [`src/ui/`](src/ui/) | les écrans et tout le texte français |
| [`data/`](data/) | pack de mots et fichiers intermédiaires du pipeline ([`data/README.md`](data/README.md)) |
| [`scripts/`](scripts/) | pipeline de génération du pack + serveur local + harnais end-to-end ([`scripts/README.md`](scripts/README.md)) |
| [`public/fonts/`](public/fonts/) | police Patrick Hand auto-hébergée (SIL OFL) |

## Licence

Le jeu, son code source et les données qu'il embarque sont publiés sous
**Creative Commons Attribution – Partage dans les mêmes conditions 4.0**
(CC BY-SA 4.0) — texte intégral dans [`LICENSE`](LICENSE), détail des sources et
des modifications dans [`LICENSES.md`](LICENSES.md).

Le texte de la licence et les notices tierces sont **servis avec l'application** :
`/LICENSE.txt`, `/LICENSES.txt` et `/THIRD-PARTY-NOTICES.md`.

### Licences des données

- `data/Lexique383.tsv` (export Lexique 383) est sous **CC BY-SA 4.0**
  (lexique.org). Le fichier versionné est **identique à l'export officiel**
  (sha256 `637ba37a…52b`) : redistribution libre, avec attribution.
- Les définitions viennent du **Wiktionnaire français**, sous **CC BY-SA 4.0**
  également. Le pack de mots (`data/wordlist.json`) est une adaptation de ces
  deux sources : toute redistribution conserve l'attribution et respecte le
  partage à l'identique (l'écran « À propos » du jeu porte cette attribution).
- Les gros fichiers de `data/` sont versionnés via **Git LFS**. Leurs objets
  restent téléchargeables par quiconque possède l'URL — sans risque ici, tout
  étant sous licence libre et attribué.
- La police **Patrick Hand** est sous **SIL OFL 1.1** : `public/fonts/OFL.txt`.

Spécification : [`PLAN.md`](PLAN.md) — pack de mots : [`data/README.md`](data/README.md).
