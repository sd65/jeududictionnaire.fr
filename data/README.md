# `data/` — pack de mots et fichiers intermédiaires

Tout ce que produit le pipeline documenté dans [`scripts/README.md`](../scripts/README.md).
Seul `wordlist.json` est **embarqué dans le jeu** (servi en statique à chaque
téléphone) ; les autres fichiers servent au debugging et à la reprise du pipe.

| Fichier | Taille | Généré par | Re-générable ? |
|---|---|---|---|
| `Lexique383.tsv` | 25 Mo | téléchargé (cf. étape 0 du pipeline) | oui |
| `candidates.json` | 0,9 Mo | `build-candidates.mjs` | oui |
| `defs.jsonl` | 1,1 Mo | `fetch-definitions.mjs` | **incrémental** — à conserver |
| `no-definition.txt` | 28 Ko | `fetch-definitions.mjs` | oui |
| `wordlist.json` | 1,6 Mo | `fetch-definitions.mjs` | oui (via les deux précédents) |

## `Lexique383.tsv` (source, non modifié)
Export TSV brut de Lexique 383 : une ligne par forme fléchie, colonnes
`ortho, phon, lemme, cgram, genre, freqlemlivres, freqfilms2, …`. Licencié
pour un **usage de recherche** (lexique.org) — à vérifier avant tout usage
commercial. 25 Mo : ne pas versionner sur un dépôt public comme un fichier de
jeu.

## `candidates.json`
Sortie de l'étape de filtrage : entête `meta` (horodatage, arguments réglés,
stats du filtre : rangées analysées → lemmes → bonne catégorie → forme →
rareté) + liste des candidats retenus. Un lemme peut y figurer avec
plusieurs formes fléchies ; c'est l'étape suivante qui dédoublonne.

## `defs.jsonl` (cache incrémental — à conserver)
Une ligne JSON par mot définition récupérée :
`{"w":"abducteur","def":"Muscles produisant l'abduction."}`.
C'est le **journal de reprise** de `fetch-definitions.mjs` : les lots de
titres déjà présents dedans ne sont pas re-requêtés. Supprimer ce fichier =
refaire toute la collecte Wiktionnaire.

## `no-definition.txt`
Liste UTF-8 simple, un mot par ligne : les **2 285** candidats admis dans les
critères (longueur, rareté, catégorie) mais sans page Wiktionnaire
exploitable. Cible d'un futur complément (option `--retry-nulls`, pack
Littré). Trois sources : flexions sans lemme, lemmes rares sans article,
articles sans section de définition.

## `wordlist.json` — le pack final embarqué
```json
{
  "meta":  { "counts": { "candidats": 12833, "definis": 10548, "sansDefinition": 2285 }, … },
  "words": [ { "w": "abducteur", "p": "adj.", "d": "Muscles produisant l'abduction", "fL": 0, "fF": 0.01 }, … ]
}
```
- `w` : le mot (7–14 lettres, rare ≤ 0,3/million dans livres ET films) ;
- `p` : la catégorie grammaticale formatée pour l'affichage (`adj.`, `n.m.`, `v.`…) ;
- `d` : la vraie définition (Wiktionnaire, **CC BY-SA 4.0**) ;
- `fL` / `fF` : fréquence par million dans les corpus livres / films —
  tri du paquet de cartes, bouton « 🎴 Nouveau paquet » (les plus rares d'abord).

**Attribution obligatoire si le pack est diffusé** : Wiktionnaire CC BY-SA 4.0
(mention + lien licence, cf. l'écran « À propos » du jeu), fréquences Lexique.
