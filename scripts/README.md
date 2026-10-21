# Pipeline du pack de mots rares

Ces scripts tournent une seule fois (à la génération du pack), hors navigateur.

```bash
# 0) Une fois : télécharger Lexique 383 (25 Mo, licence CC BY-SA 4.0)
curl -sL -o data/Lexique383.tsv \
  "http://www.lexique.org/databases/Lexique383/Lexique383.tsv"
# sha256 attendu : 637ba37a767a66679c48371d673ece50cbf541b49a4e40e598963d4f3fbce52b

# 1) Filtrer : lemmes NOM/ADJ/VER, 7-14 lettres,
#    fréquence <= 0.3 par million dans les corpus livres ET films
node scripts/build-candidates.mjs                 # -> data/candidates.json

# 2) Définitions depuis le Wiktionnaire (lots de 50 titres, poliment)
node scripts/fetch-definitions.mjs                # -> data/wordlist.json (pack final)
node scripts/fetch-definitions.mjs --limit 200    # essai partiel

# 3) Contrôle visuel
node scripts/preview.mjs 20
```

(Équivalents npm : `npm run lexique`, `npm run defs`, `npm run preview` — une fois
le `package.json` de la racine en place, cf. §6.8 de [`PLAN.md`](../PLAN.md).)

## Réglages de l'étape 1

| Option | Défaut | Rôle |
|---|---|---|
| `--maxFreq` | `0.3` | rareté maximale par million (0.3/m = très rare) |
| `--minLen` / `--maxLen` | `7` / `14` | fourchette de longueur lisible en jeu |
| `--maxWords` | `30000` | garde-fou sur la taille du lot |
| `--cats` | `NOM,ADJ,VER` | catégories grammaticales admises |
| `--batch` | `50` | titres par requête Wiktionnaire |
| `--sleep` | `500` ms | tempo entre lots (courtoisie API) |

La reprise est gérée : `data/defs.jsonl` est incrémental, une exécution
interrompue ne refait pas les lots déjà traités.

## Résultat actuel du pack (`data/wordlist.json`)

**10 548 mots rares** avec vraie définition, ~1,6 Mo
(stade de génération suivant : 12 833 candidats, dont 706 exemples de
flexion rejetés et 2 285 mots sans page Wiktionnaire, listés dans
`data/no-definition.txt` pour un éventuel complément Littré).

Il est embarqué tel quel dans l'application (`/data/wordlist.json` est servi
en statique à chaque téléphone) : chaque téléphone le charge en visitant le
site. Voir `scripts/serve-lan.mjs` pour le serveur local.

## Licences

- **Fréquences et formes** : Lexique 383 (lexique.org), **CC BY-SA 4.0**.
- **Définitions** : Wiktionnaire français, **CC BY-SA 4.0** — le jeu embarque une page
  « À propos » avec attribution, conformément à la licence, et le pack est une
  adaptation dont les modifications sont indiquées (cf. [`LICENSES.md`](../LICENSES.md)).

---

## Harnais end-to-end (`scripts/e2e/`)

Il pilote un **vrai Google Chrome** au Chrome DevTools Protocol — jamais Chromium, jamais
Firefox, et jamais le profil de l'utilisateur (le harnais crée son propre répertoire
jetable). Aucun paquet supplémentaire : le protocole est dans Chrome, et Node a un WebSocket
dans sa bibliothèque standard.

```bash
npm run e2e -- --smoke    # une page : l'app démarre, la console est propre
npm run e2e               # trois joueurs, une partie entière (arrive à E8)
```

| Fichier | Rôle |
|---|---|
| `e2e/cdp.mjs` | le client CDP minimal |
| `e2e/chrome.mjs` | le pilote : lance Chrome, ouvre des contextes isolés, évalue, clique, capture la console, fait une capture d'écran |
| `e2e/run.mjs` | le point d'entrée (`--smoke`) |

Le harnais **ne gratte jamais le DOM** : il lit la phase dans `window.__jdd` et clique les
boutons **par leur libellé français**. Il vérifie donc au passage que le texte du plan est
bien celui de l'écran.

Trois joueurs = trois `Target.createBrowserContext`, chacun avec son propre stockage et sa
propre fenêtre visible.
