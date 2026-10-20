# Jeu du Dictionnaire — Game Design & Technical Plan

**Working title:** *Jeu du Dictionnaire* (French edition of the classic parlour game known as
**Call My Bluff** / **Balderdash**).
**Format:** mobile-first web app, played on a handful of phones over a Wi-Fi network,
with **no game server of our own**. Peer-to-peer via Trystero / Nostr relays (Internet required, see §6.1).
**Status:** working prototype (see §8 for what exists and what remains).
**Distribution:** no PWA for now. Built as static assets, served from the host's Mac on the local network (§6.1).
**Source of truth:** this plan (PLAN.md) is the sole authoritative specification.
Existing code (`_old-prototype/`, `scripts/`, `data/`) is only a reference /
source of inspiration and must not drive product or architecture decisions
unless the plan explicitly says so.

---

## 1. The premise

One obscure French word. Multiple proposed definitions. Only one is real.
The real one was written — and is held — by the **Chooser**. Everyone else invents a
plausible fake. The Chooser reads all definitions aloud with a perfectly straight face
(N = writers + 1 definitions, not always five). Players must find the genuine definition;
the definitions themselves are the entertainment.

The game lives or dies on three qualities:

1. **Obscure but plausible words** — rare enough that nobody knows them, common enough that
   they *could* exist in everyday French.
2. **Inventive fakes** — the social comedy of the game is in the definitions people write.
3. **Zero friction** — a party game on phones must not feel like installing software.

---

## 2. Players and roles

| Role | Who | Privileges / duties |
|---|---|---|
| **Host** | The device that created the room. Technical and administrative role only; game-wise the host is a player like the others (Chooser or Writer according to the round) | Authoritative game state `S`; admin buttons per phase (manual advance only, never automatic). Admin view shows counts and names, never fake texts nor the real definition (§4.2). Host leaving = game paused until it returns (§4.11) |
| **Chooser** | Rotates each round in join order. One **tour** = every seated player is Chooser exactly once (§5) | Secretly picks an obscure word and provides the **true definition**; **dictates all definitions aloud** during READ in the stable ballot order (§4.3); writes **no** fake; **never votes**; alone validates the end of the reading (« Passer au vote ») |
| **Writer** | Every non-Chooser seated player (host included when not Chooser) | Writes **one** invented definition; then votes for the definition they believe is real |

A game needs **≥ 3 seated players** (one Chooser + at least two Writers; with fewer, voting is
meaningless).

---

## 3. The round, phase by phase

State machine: `LOBBY → PICK (round start) → DRAFT → READ → VOTE → REVEAL → (next round) → END`

The rules below include deliberate subtleties that were corrected through playtesting —
they are constraints, not implementation details.

### LOBBY
- The room is a **4-letter code**, letters A–Z only (displayed uppercase, transported lowercase).
  Joining is a URL `?room=CODE` (link or manual code).
- The host creates the room with « Créer une salle », which shows the code. Guests join with the
  code in a « Rejoindre » field, or with the link. An unknown code leaves the guest waiting,
  then the failover of §4.7 applies.
- Players choose a **pseudo** (persisted on the device as the default), **3 to 20 characters**,
  **letters (accents included) and digits only**. Leading and trailing spaces are removed.
  The pseudo is the player's identity. Pseudos must be **unique within the room**,
  **case-insensitively** (« Léa » and « léa » clash); uniqueness is **checked by the host** at join
  (duplicate → the guest is asked to pick another; a reclaim of a disconnected seat is not a duplicate, §4.9).
- The host configures the game for the whole table:
  - **« Mode vocal seul »** (§4.6), enabled by default.
  - **« Nombre de tours »**, default **2**, minimum **1**, no upper limit. One tour = every seated player chooses once.
    Total rounds = tours × seated players (fixed at start, see §4.1).
- **Start** is disabled until **≥ 3 seated players**. Disconnected seats count as seated.
- The host cannot remove a player, and there is no voluntary quit (§4.12).
- **No late join.** Once the game has started, the room is closed; anyone arriving waits for a
  new game (§4.8).
- Lobby has **« Effacer mon historique de mots »**: clears this device's `jdd.hist` so its
  played words become eligible again (§4.4).
- Lobby has a **small « À propos » button** (mandatory, §10).

### PICK (no timer, 100% host-manual advance)
- Only the Chooser acts. They get a **swipeable deck of 100 cards** (word, category `p`,
  definition `d`), browsed circularly via swipe or ‹ › buttons, with **✓ Choisir ce mot**
  under the card.
- Deck = **100 cards sampled uniformly at random from `wordlist.json`** (§6.3), freshly drawn
  **per Chooser per round**, after exclusions below. Algorithm: shuffle the eligible words, take the first 100. Order is circular; no reshuffle mid-PICK.
- If the pack cannot supply 100 eligible cards, the deck is simply shorter. No special
  treatment: a short or empty deck is acceptable; manual entry is always available.
- Manual entry is always possible in a collapsed panel: word, gender/category (free text, optional),
  definition (required — the Chooser must be able to *vouch* for it). **No validation** beyond
  "required"; no length cap on the real definition.
- **Exclusions (union rule):** excluded = words already played on **any** seated device
  (`jdd.hist` union, exchanged at join, §4.4) + words already played in this game.
  Words are compared case- and accent-insensitively.
  The host computes this set and sends it to the Chooser in `view` when PICK starts (§6.5);
  the Chooser's phone draws the deck from `wordlist.json` minus that set.
- Nothing is broadcast to the other phones — the word does not leave the Chooser's screen
  until DRAFT (only the `pick` message carries it to the host, §6.5).

### DRAFT (no timer, 100% host-manual advance)
- Now — and only now — is the word broadcast, with its category. Everyone sees it.
- Every Writer writes **one** fake definition (≤ 500 chars) and sends it.
- The Chooser waits; their screen shows who has submitted (names and counts, no texts).
- The host's **admin view shows submission counts/names only, never fake texts and never the
  real definition** — unless the host is the Chooser (then they see their own dictation card).
- As soon as all Writers have submitted, the host may proceed (admin button). No auto-advance.
- Once sent, a fake is locked: no re-submission; the host-side map is keyed per player.
- No rule on identical fakes, or on a fake equal to the real definition: both are allowed.

### READ — the dictation (no timer, 100% manual)
- Definitions are **shuffled once on the host** (§4.3) into a **stable 1…N ballot order**.
  The **Chooser dictates aloud**, once each, in a neutral voice, announcing
  **« définition n°1 », « définition n°2 », …** in that exact order.
- **Normal mode: guest phones show nothing about the definitions during READ**
  (blank waiting screen, no texts, no numbers).
- **Mode vocal seul exception:** phones show **only the ballot numbers** (1…N) and Writers
  may vote *while the Chooser is still reading*.
- Only when the Chooser has finished dictating do they press
  **« Passer au vote — tout le monde a entendu »**. The host's admin button only relays
  this transition. If all vocal votes are already in, REVEAL fires right after validation.

### VOTE (no timer, normal mode only; vocal mode has no separate VOTE — voting happened in READ)
- All phones (Chooser excepted) see the definitions **on screen**, numbered 1…N in the stable
  ballot order, and tap the one they believe is real. One vote, irrevocable, guarded host-side.
- Votes are hidden until reveal — only the aggregate count of voters is broadcast.
- The Chooser sees that others are voting but does not vote.
- When all Writers have voted, the host advances manually to REVEAL.

### REVEAL
- Every definition is shown with its author's name; the real one is tagged **“vraie”**.
- Votes cast on each line are displayed.
- **Round points and total scores** (§5) are shown. Then the host moves to the next round
  (next seated player in join order becomes Chooser, wrapping around).

---

## 4. Subtleties worth spelling out

These are the details that make the difference between “software with phases” and a game
that *works* at a dinner table.

### 4.1 The Chooser is excluded everywhere; the seat set is frozen at start
`expectedWriters()` = all seated players minus the Chooser. It drives: fake counting, vote
counting, “all submitted → can advance”, reveal conditions. The Chooser neither writes
nor votes; their score for the round is 0 by design (§5).

The seat set is **frozen at game start** (no late join, §3). A disconnected seat stays in
`expectedWriters()` and blocks progression (§4.12). Therefore the total round count is
`tours × N` computed once at start.

### 4.2 Information never leaks ahead of its phase
What is broadcast per phase (host → everyone). The host device holds `S` in full, but the
host's *player UI* obeys the same guest column unless the host is the Chooser:

| Field | LOBBY | PICK | DRAFT | READ normal (guest) | READ vocal (guest) | VOTE (normal only) | REVEAL |
|---|---|---|---|---|---|---|---|
| word + category | — | — | ✓ | — | — | — | ✓ |
| submitted names / counts | — | — | ✓ (no texts) | — | — | ✓ (counts) | — |
| fake texts | — | — | — | — | — (never in vocal) | ✓ (numbered, stable order) | ✓ |
| ballot numbers 1…N | — | — | — | — | ✓ (votable immediately) | ✓ | ✓ |
| “voted” counts (aggregate only) | — | — | — | — | ✓ | ✓ | — |
| real index, votes detail, round points and total score | — | — | — | — | — | — | ✓ |

Chooser private view: from READ on, the Chooser holds a dictation card with the numbered
stable order and a REAL badge visible to Chooser eyes only.
During READ (normal mode), a guest's phone contains *no* playable information.
Hiding UI is not enough — the data is not on their device.

### 4.3 Dictation order
The real definition is shuffled among the fakes with a Fisher–Yates shuffle on the host,
producing a **stable 1…N order frozen for the round** (same numbers in READ, VOTE, REVEAL).
The shuffle result is sent privately to the Chooser's device only (dictation card).
Nobody else — not even the host's player screen — marks the real one during dictation.

### 4.4 History is a union across devices, stored per *device*
Words played are remembered in `localStorage` (FIFO cap 3000) on every phone — because the same
household replays the game on different hosts. Deck exclusion uses the **union of all seated
devices' histories**, exchanged in `hello` (§6.5). Lobby offers **« Effacer mon historique »**
to reset the local device only.

### 4.5 Mode vocal seul (numbers-first voting)
Designed for the scenario where phones are face-down on the table:
- Texts are **never** shown during READ or VOTE — phones show N numbered buttons.
- Voting is allowed **during** the dictation, and if everyone votes before the Chooser
  finishes, reveal waits only for the Chooser's « tout le monde a entendu » validation.
- This mode leans the burden onto the Chooser's voice — the “purest” rendition of the game.

### 4.6 Timeouts
None. All phase transitions are manual: Chooser validates READ → VOTE; host advances every
other transition. No countdowns anywhere. Waiting screens show counts, except the list of disconnected players (§4.12), which shows names.

### 4.7 Guest waiting screen
Timeout on join: after **5 s** the screen says *« On dirait que cela prend plus de temps que
d'habitude. Pourquoi ne pas relancer un nouveau salon ? »* with a button that silently
**fails over to a fresh room** — the victim silently becomes the new host. At 15 s an extra
hint suggests checking the code / Wi-Fi / Internet.

### 4.8 No late join
Once the game has started, the room accepts no new seats. A newcomer sees
*« Partie en cours — rejoins la prochaine partie. »* (replaces the old `spectate` flow, §6.5).

### 4.9 Refresh ≠ lost seat (identity = pseudo)
The pseudo is the only identity. Trystero regenerates the peer id on every page load, so the
host matches a returning player by **pseudo**, not by peer id. A player rejoining after a refresh
with a pseudo whose seat is disconnected **reclaims that seat** (name, score, votes,
submitted fake). Two players cannot share a pseudo (§3), and multiple seats per browser are not supported.

Known trade-off: anyone who types a seated player's pseudo while that player is disconnected
takes over the seat. Acceptable for a friends' table.

Guest refresh: the guest reloads, reads its pseudo from `jdd.name`, and sends `hello` again.
The host re-attaches the seat. A `hello` that arrives before the host has noticed the old peer
leaving is still a reclaim, not a duplicate. Text typed but not yet sent is restored from
`jdd.draft` (§6.4).

Guests accept `view` messages from any peer in the room. The room code is the password, so this
is the same trust level as the room itself.

### 4.10 Host controls
The host title-bar is the admin bar: per-phase advance buttons and escape hatches (force
reveal; never past a disconnected seat, §4.12. The only exit from a blocked game is « terminer la partie », which only the host can press (§4.12).

### 4.11 Host leaves = pause, not death
If the host leaves (closes the tab, loses its connection, or reloads), the game is **paused**
like a disconnected seat (§4.12). Guests see « Hôte déconnecté — en attente de son retour ».
When the host comes back, the game resumes exactly where it was: a reload restores the host
from `jdd.host` (§6.6). If the host never returns, the game stays blocked indefinitely.
Host migration is a roadmap item (state `S` is serializable).

### 4.12 Disconnection blocks progress
- A **disconnected Writer, Chooser or host blocks the game**: nobody can advance past the current
  phase until that player reconnects. A page refresh is a disconnection followed by a reconnection.
- Reconnecting (rejoining with the same pseudo, §4.9) drops them **straight
  back into the current phase** with their seat, score and submitted data intact.
- Guests see *« En attente de <pseudo> »*; the host sees the same list.
- If a player never returns, **the host may end the game** (→ END screen with scores as they
  stand; points of an unfinished round are not counted). No seat removal, no skipping past the missing player.
- Detection: Trystero emits a peer-leave when the WebRTC connection fails, or after 5 s in the
  disconnected state (§6.1). Behaviour with sleeping phones must be checked on real devices.
- There is no voluntary quit, and the host cannot remove a player.

### 4.13 Screen stays awake on every device
Screen wake-lock is requested on **every** device, not only the host. Requires a secure
context on phones, so it is part of **phase 2** (§6.1, §11).

### 4.14 Home screen and « Accueil »
- The home screen offers « Créer une salle » and « Rejoindre » (§3).
- If a stored room (`jdd.host`) exists and its **last activity** was less than **1 hour** ago, the
  home screen also offers « Reprendre la salle XXXX » and « Nouvelle salle ». Last activity means
  the last applied action, phase changes included. A stored room inactive for more than 1 hour
  is discarded at launch, and the home screen is shown without any offer to resume it.
- Every player has « Accueil » in a burger menu, always reachable but not prominent. Leaving to the
  home screen disconnects the device: its seat is disconnected and blocks the game until the
  player returns by pseudo (§4.12). It is a way to unstick oneself, not a quit.
- A guest's device keeps the code of the last room it received a `view` from (`jdd.room`). If
  that room was seen less than 1 hour ago, the home screen offers « Revenir dans la salle XXXX ».
  Otherwise it is discarded.

### 4.15 Screens by phase
The host's admin buttons appear on the host's device, next to its own player screen.
« Terminer la partie » is available to the host in every phase (§4.12).

| Phase | Host buttons | Chooser | Writer | Other players |
|---|---|---|---|---|
| LOBBY | « Démarrer » (enabled at ≥ 3 seated), options (« Mode vocal seul », « Nombre de tours ») | seat list | seat list | seat list, options read-only |
| PICK | none | swipeable deck, « ✓ Choisir ce mot », manual entry | « Le Chooser choisit un mot » | same waiting text |
| DRAFT | « Lecture » (enabled when every Writer has submitted) | list of who has submitted | 500-character field, « Envoyer », locked after sending | word shown |
| READ | none (the Chooser validates) | dictation card, « Passer au vote — tout le monde a entendu » | normal: waiting screen; vocal: numbered vote buttons | same as Writer |
| VOTE | « Révéler » (enabled when every Writer has voted) | waiting for votes | numbered definitions and vote | same as Writer |
| REVEAL | « Manche suivante » (last round: « Voir le classement ») | round points, total scores | round points, total scores | same |
| END | « Rejouer » | ranking | ranking | ranking, waiting for the host |

### 4.16 Messages
| Situation | Text |
|---|---|
| Pseudo length or characters invalid | « Pseudo : 3 à 20 caractères, lettres et chiffres. » |
| Pseudo already taken | « Ce pseudo est déjà pris dans cette salle. » |
| Join during a game | « Partie en cours — rejoins la prochaine partie. » |
| Word already played | « Ce mot a déjà été joué. » |
| Waiting for a seat | « En attente de <pseudo> » |
| Host disconnected | « Hôte déconnecté — en attente de son retour » |
| Reconnecting | « Reconnexion… » |
| Send failed twice | « Connexion instable » |
| Word list failed to load | « Impossible de charger la liste de mots. Saisie manuelle uniquement. » |

---

## 5. Scoring

Per round:

| Event | Points |
|---|---|
| A Writer's fake collects one vote | Author +1 per vote |
| A Writer votes for the real definition | Writer +1 |
| The Chooser | 0 by design — their reward is social, not points |

A **tour** = every seated player is Chooser exactly once. Total rounds = tours × N (default
tours = 2). Chooser rotates in join order, wrapping around.

END screen ranks players by score. **Ties share the same place, and the next place follows
immediately** (dense ranking: 1, 1, 2).
**« Rejouer »** returns the room to the LOBBY with the same players and pseudos. Scores and the
round counter are reset, the host can edit the options, and new players can join. Per-device
histories (`jdd.hist`) are kept. The END screen has no other button: no « Quitter », no « Nouvelle salle ».

---

## 6. Architecture

### 6.1 Host-authoritative, server-free (P2P over Internet relays)
- **Networking:** [Trystero](https://github.com/zaevror/trystero) over the **Nostr relay**
  strategy (WebRTC DataChannels bootstrapped via Nostr relays). **Decided:** no custom
  signalling, no manual WebRTC, no LAN WebSocket.
- Consequence: **Internet access is required** on the phones, even on the same Wi-Fi. This is
  an accepted constraint and must be stated in the lobby / About text.
- **Hosting (decided):** the app is compiled to static assets (`dist/`, including
  `data/wordlist.json`) and served from the host's Mac on the local network.
  The phones open the Mac's LAN address. Not a PWA (no manifest, no service worker) for now.
- **Phase 2:** hosting on **GitHub Pages** with a custom domain at the root (`/`), which serves HTTPS. This would also make
  the wake-lock on phones work (§4.13). Until then, plain `http://<LAN-IP>` is not a secure
  context, so wake-lock is not reliable on phones (§11, phase 2).
- Room code lowercased = the room password.
- The **host** owns `S` (the authoritative state: phases, secrets, scores, seat list).
  Guests own nothing but the last `view` they received. All game logic — scoring, reveal,
  disconnection gating — runs on the host device; guests are dumb screens.
- Consequence: if the host leaves, the game pauses until it returns (§4.11).

### 6.2 Phase machine (host side, 100% manual — no timers)

```
LOBBY ──(host Start, ≥3 seated)──▶ PICK ──(Chooser pick, host relays)──▶ DRAFT
      LOBBY ◀──(« Rejouer »: scores and round reset)── END ◀──(all rounds played)─── REVEAL
      PICK: chooser = next seat in join order (wraps); rounds = tours × N, frozen at start
      DRAFT ──(all fakes in AND host advance)──▶ READ ──(Chooser “tout le monde a entendu”)──▶ VOTE
      READ (vocal mode): votes may arrive during the dictation; REVEAL after Chooser validation
      VOTE (normal only) ──(all votes in AND host advance)──▶ REVEAL
      Any phase: blocked while a seated player or the host is disconnected (§4.11, §4.12)
```

### 6.3 Content pipeline (offline pack, shipped with the app)
- `scripts/build-candidates.mjs` — Lexique 383 frequency data → ~12,833 rare-word candidates.
- `scripts/fetch-definitions.mjs` — French Wiktionary API → `data/wordlist.json`;
  `data/no-definition.txt` tracks candidates without a definition.
- `scripts/preview.mjs` — sampling/QC console for the pack.
- Manual word entry is a first-class citizen, independent of the pack.

**Observed format of `data/wordlist.json`** (inspected, 10,548 entries):

```json
{ "meta": { "generated", "source", "counts": { "candidats", "definis", "sansDefinition" } },
  "words": [ { "w": "abducteur", "p": "adj.", "d": "Muscles produisant l’abduction", "fL": 0, "fF": 0.01 } ] }
```

| Field | Meaning | Observed values |
|---|---|---|
| `w` | the word | string |
| `p` | category / gender | `n.m.` (4230), `n.f.` (2768), `adj.` (2358), `v.` (802), `n.` (390) |
| `d` | real definition | non-empty for all entries, max 498 chars |
| `fL`, `fF` | Lexique frequencies | numbers (used by the build, not by the game) |

Derived: gender M/F comes from `p` (`n.m.` → masculin, `n.f.` → féminin); `adj.`, `v.`, `n.`
have no gender in the data. Card display uses `p` as-is.
Note for QC: the pack contains some foreign-looking entries (e.g. `acetabulum`); the pack
should be reviewed with `scripts/preview.mjs` before release (not a spec blocker).

### 6.4 Device storage map

| Key | Store | Purpose |
|---|---|---|
| `jdd.hist` | localStorage | words played on this device (FIFO cap 3000; exchanged in `hello`; clearable from Lobby) |
| `jdd.name` | localStorage | default pseudonym |
| `jdd.host` | localStorage | host's game state backup, written after each action and restored on reload; cleared when a new room is created or when inactive for more than 1 hour (§4.14, §6.6) |
| `jdd.draft` | localStorage | unsent text of the current fake or definition, keyed by room, pseudo, round and phase; cleared on send (§4.9) |
| `jdd.room` | localStorage | `{ code, seenAt }` for the last room this device received a `view` from; `seenAt` is refreshed on each `view` (§4.14) |

### 6.5 Wire protocol (single channel `g`)

Every message is a JSON object with a discriminator `k`. Direction is fixed per message.

**Guest → host**

| `k` | Payload | Host behaviour |
|---|---|---|
| `hello` | `{ name, hist: string[] }` | Seat new player (LOBBY only), or reclaim a disconnected seat by `name`. Reject duplicate pseudo or late join (`reject`). Merge `hist` into the union. Reply with `view`. |
| `pick` | `{ w, p, d }` (`p` may be empty for manual entry) | Accept only from the current Chooser, in PICK. Reject if `w` already played in this game or on a seated device (`reject`, reason « mot déjà joué »). Otherwise store, go to DRAFT broadcast. |
| `def` | `{ text }` (≤ 500 chars) | Accept only from a non-Chooser seated player, in DRAFT, once per round. |
| `vote` | `{ idx }` (1…N) | Accept from a non-Chooser seated player, in READ (vocal) or VOTE, once per round. Irrevocable. |
| `valid` | `{}` | Chooser only, in READ: « tout le monde a entendu » → VOTE (or REVEAL if vocal votes complete). |

**Host → guests**

| `k` | Payload | Notes |
|---|---|---|
| `view` | filtered state (§4.2) | Sent on every state change and in reply to `hello`. Includes `waitingFor: pseudo[]` when a seat is disconnected. During PICK, the Chooser's copy includes `excluded: string[]` (§3). From READ on, the Chooser's copy includes `dictation`: the shuffled ballot with texts and a REAL marker (§4.3). |
| `reject` | `{ reason }` | Replaces the old `spectate` and `repick`. Reasons: duplicate pseudo, game in progress, word already played (sent to the Chooser only). |

Notes:
- Idempotency: the host dedupes by `(name, round, phase, k)`. Duplicates are ignored.
- The union history is exchanged once in `hello` and merged host-side; it is not re-sent per round.
- Trystero's peer id changes on reload; identity is always the pseudo, never the peer id.
- On a peer join, each guest re-sends `hello` (idempotent). After a host restore, every seat
  starts as disconnected until its owner's `hello` arrives. While reconnecting, a guest shows
  « Reconnexion… » over its last view.
- A failed send is retried once, then « Connexion instable » is shown.

### 6.6 Front-end architecture (decided)
- **Stack:** React + TypeScript + JSX, built with Vite. Base URL is `/`; a custom domain is planned for phase 2.
- **Authority:** only the host runs `reduce()`. Guests never compute game state: they send
  intents (§6.5) and render the last `view` they received.
- **Store:** game state lives in an external store (plain TypeScript, subscribe / getSnapshot),
  read in components with `useSyncExternalStore`. Network events update the store directly,
  outside React's render cycle. No React context for game state.
- **Host persistence:** after every applied action, including the host's own (applied locally,
  no network), the host writes its state to `jdd.host`. On reload, the host restores from it and
  rejoins the room with a new peer id. Each guest then re-sends `hello` with its pseudo, and the
  host re-attaches the seat (§4.9).
  The snapshot stores the time of the last applied action. Cleared when a new room is created,
  or when a stored room is found inactive for more than 1 hour at launch (§4.14).
- **Network mapping (host):** a `peerId → pseudo` map, filled by `hello`. On a peer leave, the
  matching seat is marked disconnected (§4.12). A `hello` with a known pseudo replaces the old peer id.
- **Settings:** `vocal` (default true) and `tours` (default 2, minimum 1) are part of the game
  state `S`. They are editable in LOBBY only.
- **Structure:** one folder per phase for screens (`Lobby`, `Pick`, `Draft`, `Read`, `Vote`,
  `Reveal`, `End`), plus `game/` (rules, pure), `net/` (transport), `store/`. No router:
  the room is read from `?room=` and the « À propos » screen is a state value.
- **Validation:** incoming actions are validated in `reduce()` (phase, player, value ranges).
  No schema library.
- **Loading:** the app renders first. `wordlist.json` loads in the background and is needed
  from the first PICK; until it is ready, the Chooser sees a loading message and manual entry.
  If it fails to load, an error message is shown and only manual entry is offered.

### 6.7 Tests
- Automated tests cover: `reduce` (phase guards, scoring, the Chooser's exclusion), `ranking`
  (dense ranking), `shuffle`, the exclusion union (case- and accent-insensitive), and the
  per-recipient view filter (§4.2).
- No component tests. Tests run with Vitest, without a browser.

---

## 7. Anti-cheat posture (accepted trade-offs)

The threat model is “friends at a table”, not adversarial security:

- **Read-phase leak vector:** neutralized by design — nothing about definitions is on
  guest phones during normal-mode READ.
- **Known, accepted hole:** the word travels to the host inside a `pick` message only when
  chosen, and the deck itself is client-local — but a determined player could inspect JS.
  Fine for a friend group.
- **Vote peeking:** options carry no author until REVEAL; only aggregate voter counts ship.
- **Future hardening ideas** (roadmap): encrypt the pick message, per-option
  commitment-hash voting, host-signed reveals.

---

## 8. Status

**Built and playable (prototype):** full round loop, deck swiping, per-device word history,
vocal mode with dictation voting, host dictation panels, guest waiting/failure overlay with
silent failover, seat reclaim on refresh, scoring + END screen, « À propos » licensing screen,
paper-cahier visual theme (self-hosted handwriting fonts).

**Prototype differs from this plan (to be aligned in the rebuild):** timers (removed, §4.6),
spectate flow (replaced by `reject`, §4.8), disconnection gating (new, §4.12), unique pseudos
(new, §3), tours-based round count (new, §5), union history (new, §4.4).

---

## 9. Visual theme

- **Look:** school notebook paper. Cream sheet with horizontal blue ruled lines and one
  magenta margin line on the right.
- **Cards** (deck, definitions, dictation card): sheets of paper laid on the sheet, with a
  slight shadow, a slight random rotation (a few degrees), and a subtle paper grain on the sheet.
- **Typography:** **Patrick Hand everywhere** (titles, buttons, body), self-hosted (woff2).
  Caveat is dropped. Minimum text size **18 px** on phones.
- **Colours:**
  - Title: red pen (`#d8505f`, from the prototype).
  - Buttons and accents: blue pen (`#1f7ac0`).
  - Margin: magenta (`#f28ac6`).
  - Ink text: dark blue (`#2e3d54`). Secondary text: pencil grey (`#7b889c`).
  - Error states: red pen.
- **Responsive:** mobile portrait is the primary target. On larger screens, a single centred
  column of max 480 px, with the sheet visible around it. Touch targets at least **44 px**.
- **Motion:** sober only: short fades or slides between phases, no looping or decorative animation.
- **Modes:** light only, no dark mode.
- **Language:** French only.

## 10. Licensing notes

- Word list & frequencies: **Lexique** (lexique.org) — research-use licence; verify before
  any commercial deployment.
- Definitions: **French Wiktionary**, **CC BY-SA 4.0**. The bundle is a compliant
  adaptation; the in-app « À propos » screen attributes the source with the licence link and
  the share-alike notice. Any redistribution of the pack must keep this attribution.
- Trystero: MIT.
- The « À propos » entry point is **mandatory and visible on the Lobby** (small button).

---

## 11. Open decisions (must resolve before build)

No open decisions remain. The only pending item is the phase 2 work below.
- **Phase 2 — Wake-lock and HTTPS.** Wake-lock on phones needs a secure context. Planned with
  GitHub Pages hosting (HTTPS). Until then, wake-lock is best-effort only. Not part of the local build.
