# Licences

Le jeu, son code source et les données qu'il embarque sont publiés sous
**Creative Commons Attribution – Partage dans les mêmes conditions 4.0**
(CC BY-SA 4.0).

- Texte intégral : [`LICENSE`](LICENSE)
- Le même texte est **servi avec l'application** : `/LICENSE.txt` (le jeu est
  distribué avec sa licence, comme l'exige le partage à l'identique).
- Les notices des bibliothèques tierces sont dans
  [`public/THIRD-PARTY-NOTICES.md`](public/THIRD-PARTY-NOTICES.md), également
  servi avec l'application (`/THIRD-PARTY-NOTICES.md`).

Copyright © les auteurs de *Jeu du Dictionnaire*.

## Sources tierces et adaptations

CC BY-SA 4.0 demande d'**indiquer les modifications** apportées aux matériaux
réutilisés : cette table les liste.

| Source | Ce qui en est repris | Licence | Modifications |
|---|---|---|---|
| [Lexique 383](http://www.lexique.org/databases/Lexique383/) | formes, lemmes, catégories grammaticales, fréquences | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | filtrage par rareté et par longueur, dédoublonnage des flexions, reformatage |
| [Wiktionnaire français](https://fr.wiktionary.org/) | définitions | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (également GFDL) | extraction de la première définition de la section française, nettoyage du wikitext, reformatage |
| [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) | police de l'interface | [SIL OFL 1.1](https://scripts.sil.org/OFL) | aucune |
| [Trystero](https://github.com/dmotz/trystero) | transport pair à pair | MIT | aucune |
| [React](https://react.dev/) / [React DOM](https://react.dev/) | interface | MIT | aucune |

### Lexique 383

Base de données lexicale du français de Boris New et Christophe Pallier.
Licence : [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — la
page d'accueil de lexique.org indique « Lexique est distribuée sous une licence
Creative Commons Attribution – Partage dans les mêmes conditions 4.0 », et le
fichier `README-Lexique.txt` de l'archive officielle porte la même mention.

Le fichier `data/Lexique383.tsv` versionné dans ce dépôt est **identique à
l'export officiel** :

```
sha256  637ba37a767a66679c48371d673ece50cbf541b49a4e40e598963d4f3fbce52b
taille  25 850 780 octets
```

### Wiktionnaire français

Les définitions proviennent de l'API MediaWiki du Wiktionnaire français. Les
textes de ce dictionnaire sont publiés sous **CC BY-SA 4.0** (et GFDL) ; le
choix de CC BY-SA 4.0 est compatible avec GFDL dans ce sens.

Le pack de mots (`data/wordlist.json`) est une **adaptation** de ces deux
sources : toute redistribution doit conserver cette attribution et respecter le
partage à l'identique. L'écran « À propos » du jeu porte cette attribution.

### Police Patrick Hand

Police de Patrick Wagesreiter, sous **SIL Open Font License 1.1**. Le texte de
la licence est fourni avec la police : `public/fonts/OFL.txt` (copié dans
`dist/` par le build, donc servi avec l'application). La police est
auto-hébergée, sans modification.

### Bibliothèques

Trystero, React et React DOM sont sous licence MIT. Leurs notices complètes
sont dans `public/THIRD-PARTY-NOTICES.md`, distribué avec l'application comme
l'exige la licence MIT.
