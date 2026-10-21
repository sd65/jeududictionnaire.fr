# Jeu du Dictionnaire

Jeu de bluff en français, mobile-first, joué entre téléphones sur un réseau local.

L'application n'est pas encore écrite : [`PLAN.md`](PLAN.md) est la spécification
de ce qui doit être construit.

## Contenu du dépôt

| Chemin | Rôle |
|---|---|
| [`PLAN.md`](PLAN.md) | spécification du jeu et de l'architecture (**source de vérité**) |
| `data/` | pack de mots et fichiers intermédiaires du pipeline ([`data/README.md`](data/README.md)) |
| `scripts/` | pipeline de génération du pack + serveur local ([`scripts/README.md`](scripts/README.md)) |
| `public/fonts/` | police Patrick Hand auto-hébergée (SIL OFL) |

## Licences des données

- `data/Lexique383.tsv` (export Lexique 383) est sous **licence usage de recherche**
  (lexique.org) : ne pas versionner ce dépôt sur un remote public.
- Les gros fichiers de `data/` sont versionnés via **Git LFS**. Leurs objets restent
  téléchargeables par quiconque possède l'URL : utiliser un remote **privé**.
- La police **Patrick Hand** est sous **SIL OFL 1.1** : `public/fonts/OFL.txt`.

Spécification : [`PLAN.md`](PLAN.md) — pack de mots : [`data/README.md`](data/README.md).
