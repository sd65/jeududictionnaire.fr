# Jeu du Dictionnaire

Jeu de bluff en français, mobile-first, joué entre téléphones sur un réseau local.

L'application est **en construction, étape par étape** : [`PLAN.md`](PLAN.md) est la
spécification complète *et* le plan de build. L'état d'avancement est en §8 de ce
document, et la première phase (l'outillage) est faite.

## Démarrer

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
| `src/game/` | les règles du jeu, en pur (aucun React, aucun réseau) |
| `src/net/` | le transport (P2P) et le protocole |
| `src/ui/` | les écrans et tout le texte français |
| `data/` | pack de mots et fichiers intermédiaires du pipeline ([`data/README.md`](data/README.md)) |
| `scripts/` | pipeline de génération du pack + serveur local + harnais end-to-end ([`scripts/README.md`](scripts/README.md)) |
| `public/fonts/` | police Patrick Hand auto-hébergée (SIL OFL) |

## Licences des données

- `data/Lexique383.tsv` (export Lexique 383) est sous **licence usage de recherche**
  (lexique.org) : ne pas versionner ce dépôt sur un remote public.
- Les gros fichiers de `data/` sont versionnés via **Git LFS**. Leurs objets restent
  téléchargeables par quiconque possède l'URL : utiliser un remote **privé**.
- La police **Patrick Hand** est sous **SIL OFL 1.1** : `public/fonts/OFL.txt`.

Spécification : [`PLAN.md`](PLAN.md) — pack de mots : [`data/README.md`](data/README.md).
