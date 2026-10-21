# Jeu du Dictionnaire — Game Design & Technical Plan

**Working title:** *Jeu du Dictionnaire* (French edition of the classic parlour game known as
**Call My Bluff** / **Balderdash**).
**Format:** mobile-first web app, played on a handful of phones over a Wi-Fi network,
with **no game server of our own**. Peer-to-peer via Trystero / Nostr relays (Internet required, see §6.1).
**Status:** the app is **not built yet** — this plan is the specification for what to build.
Decisions are recorded in §12.
**Distribution:** no PWA for now. Built as static assets, served from the host's Mac on the local network (§6.1).
**Source of truth:** this plan (PLAN.md) is the sole authoritative specification.
The existing code (`scripts/`, `data/`) is only a source of inspiration and must not drive
product or architecture decisions unless the plan explicitly says so.

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
| **Host** | The device that created the room. Technical and administrative role only; game-wise the host is a player like the others (Chooser or Writer according to the round) | Authoritative game state `S`; admin buttons per phase (manual advance only, never automatic). The host's *player* screen obeys the same projection as everyone else's (§4.2) — the admin bar is the only extra. Host leaving = game paused until it returns (§4.11) |
| **Chooser** | Rotates each round in join order. One **tour** = every seated player is Chooser exactly once (§5) | Secretly picks an obscure word and provides the **true definition**; **dictates all definitions aloud** during DICTATE in the stable ballot order (§4.3); writes **no** fake; **never votes**; alone validates the end of the reading (« Passer au vote ») |
| **Writer** | Every non-Chooser seated player (host included when not Chooser) | Writes **one** invented definition; then votes for the definition they believe is real |

A game needs **≥ 3 seated players** (one Chooser + at least two Writers; with fewer, voting is
meaningless).

---

## 3. The round, phase by phase

State machine: `LOBBY → PICK (round start) → DRAFT → DICTATE → VOTE → REVEAL → (next round) → END`.

**Seven phases, and the machine is identical in both modes.** The modes differ only in **what
the ballot looks like** and **when it becomes visible** (§3 DICTATE, §3 VOTE). One invariant
governs voting throughout: **votes are accepted exactly when the ballot is visible to that
Writer.** There is no mode-specific phase and no mode-specific branch in the phase machine.

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
  **case-insensitively** (« Léa » and « léa » clash). The **client** checks the pseudo against the
  seat list it already has (§4.2) and refuses locally if a *connected* seat already carries it;
  the host checks it again when the `hello` arrives and refuses the duplicate. A reclaim of a
  disconnected seat is not a duplicate (§4.9).
- The host configures the game for the whole table:
  - **« Mode vocal seul »** (§4.5), enabled by default.
  - **« Nombre de tours »**, default **2**, minimum **1**, no upper limit. One tour = every seated player chooses once.
    Total rounds = tours × seated players (fixed at start, see §4.1).
- **Start** is disabled until **≥ 3 seated players** *and* **every seated player is connected**.
  A disconnected seat counts as seated (it keeps its place) but blocks the start: the game
  would be stuck at the first phase (§4.12).
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
- **Exclusions:** the excluded set = the words already played on this device (`jdd.hist`) ∪ the
  union of the other devices' histories (§4.4). Words are compared case- and accent-insensitively.
  The words played **in this game** are already in the local history (the DRAFT broadcast adds
  them, §4.4), so there is only **one** exclusion set — no second "words played in this game"
  list to maintain.
  The excluded set is **never re-sent per round**: every client keeps its own copy of the union
  and adds the words it sees broadcast in DRAFT to its local history. The Chooser's phone draws
  the deck from **its own** `wordlist.json` minus its own excluded set — no round-trip needed.
  The host applies the same rule when validating a `pick` (§6.5).
- The word and the real definition **leave the Chooser's screen only in the `pick` message**,
  and that message is broadcast (§6.5) — so physically they reach every device. What no device
  *draws* before DRAFT is the word (the projection does not show it, §4.2). Accepted, §7.

### DRAFT (no timer, 100% host-manual advance)
- Now — and only now — is the word broadcast, with its category. Everyone sees it.
- Every Writer writes **one** fake definition (≤ 500 chars) and sends it.
- The Chooser waits; their screen shows who has submitted (names and counts, no texts).
- The host's **player screen follows the same projection as everyone else's** (§4.2): submission
  counts and names, never the fake texts and never the real definition — unless the host is the
  Chooser (then they see their own dictation card).
- As soon as all Writers have submitted, the host may proceed (admin button). No auto-advance.
- Once sent, a fake is locked: no re-submission; the host-side map is keyed per player.
- No rule on identical fakes, or on a fake equal to the real definition: both are allowed.

### DICTATE — the Chooser reads the definitions aloud (no timer, 100% manual)
- Definitions are **shuffled once on the host** (§4.3) into a **stable 1…N ballot order**.
  The **Chooser dictates aloud**, once each, in a neutral voice, announcing
  **« définition n°1 », « définition n°2 », …** in that exact order.
- **What the phones show is the only difference between the modes:**
  - **Mode vocal seul:** phones show **only the ballot numbers** (1…N) — and the numbers are
    **votable immediately**, so a Writer can vote *while the Chooser is still reading*.
  - **Normal mode:** phones show **nothing** about the definitions (blank waiting screen, no
    texts, no numbers). The definitions only appear on screen in VOTE.
- Only when the Chooser has finished dictating do they press
  **« Passer au vote — tout le monde a entendu »**. The host's admin button only relays
  this transition → VOTE.
- The Chooser's **dictation card stays on screen from DICTATE through VOTE** (numbered stable
  order + REAL badge), so they can repeat a definition on request at any point before the
  reveal.

### VOTE (no timer — the same phase in both modes)
- The ballot is open. **Votes are accepted exactly when the ballot is visible to that Writer**
  — one invariant, both modes, no exceptions. In code that is a single expression (§4.2):
  `canVote = phase === 'VOTE' || (phase === 'DICTATE' && vocal)`.
- **What is on screen:**
  - **Mode vocal seul:** the **numbered buttons only** (1…N), never the texts. Writers who
    already voted during DICTATE keep their vote; the others vote now.
  - **Normal mode:** the **definitions on screen**, numbered 1…N in the stable ballot order,
    and the Writer taps the one they believe is real.
- One vote per Writer, irrevocable, guarded host-side.
- **A Writer may not vote for their own fake definition.** The state stores the ballot as a list
  of **authors** (§4.3), so the exact index of a Writer's own definition is known by the client
  (`myIdx`): their own option is **greyed out** on their phone, in **both** modes. The host
  rejects such a vote anyway (§6.5) — that is the guard, not the UX. The voter keeps their
  ballot and can pick another option; the message is
  « Tu ne peux pas voter pour ta propre définition. ».
- Votes are hidden until reveal — only the aggregate count of voters is shown.
- The Chooser sees that others are voting but does not vote.
- When all Writers have voted, the **host presses « Révéler »** to move to REVEAL. The host may
  also **force the reveal** at any time (§4.10) — the round is then scored with the votes
  received.

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

### 4.2 One state, one projection — what each device draws, and when
There is **one** game state `S` (host-authoritative) and **one** pure function that turns it into
what a given seat may draw: `project(S, me) -> View`, where `me` is the caller's pseudo, or
`null` for a device that is not seated. The **same** function runs on the host and on every
guest: the host projects for its own seat exactly like the others. The host's admin bar is a
separate, small derivation from `S.phase`.

The projection is the **only** place where "who may see what" is decided. **Nothing is filtered
on the wire** (§6.5): the state travels as it is, and each client draws from its own projection.
That is why the projection must be a pure function of `(S, me)` — it is the unit the tests cover
(§6.7).

It returns: `phase`; `isHost` / `isChooser` / `isSeated`; `canVote` (= `phase === 'VOTE' ||
(phase === 'DICTATE' && vocal)`, the one voting invariant, §3 VOTE); `showTexts` (= `phase ===
'VOTE' && !vocal`); `options` (the N definitions in the stable ballot order); `authors` (the
author of each option); `myIdx` (the index of the caller's own definition, or −1); `realIdx`
(the index of the real definition, drawn only by the Chooser); `waitingFor` (the pseudos of the
disconnected seats); `myError` (the message addressed to the caller's own seat, if any).

What each role is allowed to **see** per phase. The columns are those of a **guest**; the host's
player screen obeys the same column (the host's admin bar is separate):

| Drawn | LOBBY | PICK | DRAFT | DICTATE vocal | DICTATE normal | VOTE vocal | VOTE normal | REVEAL |
|---|---|---|---|---|---|---|---|---|
| word + category | — | — | ✓ | — | — | — | — | ✓ |
| submitted names / counts | — | — | ✓ (no texts) | — | — | — | ✓ (counts) | — |
| fake texts | — | — | — | — (never in vocal) | — | — (never in vocal) | ✓ (numbered, stable order) | ✓ |
| ballot numbers 1…N | — | — | — | ✓ (votable immediately) | — | ✓ (still votable) | ✓ | ✓ |
| "voted" counts (aggregate only) | — | — | — | ✓ | — | ✓ | ✓ | — |
| real index, votes detail, round points and total score | — | — | — | — | — | — | — | ✓ |

The Chooser's screen adds one thing: from DICTATE on, a **dictation card** — the numbered stable
order with a REAL badge — drawn on the Chooser's screen only. During DICTATE (normal mode), a
guest's phone *displays* no playable information.

**Transport reality (accepted, §7):** no targeted sends (§6.5), so every device physically
receives the whole state — the fake texts, the real definition, the authors, the REAL badge. The
**UI never draws** them outside the phase that allows it. A determined player could dig the data
out of their own device; for a friends' game that is an accepted trade-off, not a defect to
engineer away.

### 4.3 Dictation order
The real definition is shuffled among the fakes with a Fisher–Yates shuffle on the host,
producing a **stable 1…N order frozen for the round** (same numbers in DICTATE, VOTE, REVEAL).
The ballot is stored as a list of **authors** — `(seatPseudo | 'real')[]` — so that a single list
yields the texts, the author of each option, the index of the real one, and the index of each
Writer's own definition (§4.2). Nobody else — not even the host's player screen — sees the real
one marked during dictation: only the Chooser's projection draws the dictation card.

### 4.4 History is a union across devices, stored per *device*
Words played are remembered in `localStorage` (FIFO cap 3000) on every phone — because the same
household replays the game on different hosts. Deck exclusion uses the **union of all seated
devices' histories**.

- Each client sends its own history in `hello`; the host merges them into one union and
  **broadcasts it every time a seat joins** (§6.5) — once per seat, therefore never per round.
  The union only changes when a seat joins, so a separate broadcast "at game start" would send
  the same thing twice. A client that joins or reconnects therefore always receives a current
  union. The union is kept **in memory** (it is refetched at every join).
- The union is **not re-sent per round**. Once the game starts, every client sees the word of
  each round broadcast in DRAFT and **appends it to its own `jdd.hist`** — so all clients
  converge on the same exclusions without further traffic, and the word stays excluded on that
  device for every future game.
- The **excluded set** = the local `jdd.hist` ∪ the union received from the host. The words
  played in the current game are already in the local `jdd.hist` (the DRAFT broadcast adds
  them), so this is the **only** exclusion set — there is no separate "words played in this
  game" list to maintain.
- Lobby offers **« Effacer mon historique »** to reset the local device only. A word becomes
  eligible again only if no other seated device still has it in its own history.

### 4.5 Mode vocal seul (numbers-first voting)
Designed for the scenario where phones are face-down on the table:
- Texts are **never** shown during DICTATE or VOTE — phones show N numbered buttons.
- The numbers are votable **from the start of DICTATE**: Writers vote *while the Chooser is
  still reading*, which is the whole point of the mode.
- Writers who have not voted when the Chooser validates simply keep voting in VOTE (same
  numbered buttons) — REVEAL follows once the last vote lands, or when the host forces it
  (§4.10).
- The Chooser keeps their dictation card (§3 DICTATE) so they can repeat a definition.
- This mode leans the burden onto the Chooser's voice — the “purest” rendition of the game.

### 4.6 Timeouts
**No phase timer, ever.** All phase transitions are manual: the Chooser validates DICTATE → VOTE;
the host advances every other transition. No countdowns in the game. Waiting screens show
counts, except the list of disconnected players (§4.12), which shows names.
The only timer in the app is the **join timeout** of the guest waiting screen (§4.7).

### 4.7 Guest waiting screen
Timeout on join: after **5 s** a single message appears, carrying the diagnosis and one way out:
*« On dirait que cela prend plus de temps que d'habitude. Vérifie le code, le Wi-Fi et la
connexion Internet — ou lance un nouveau salon. »* The button **« Créer un nouveau salon »**
silently **fails over to a fresh room**: the player becomes the new host of it. One message, one
button, one timer.

### 4.8 No late join
Once the game has started, the room accepts no new seats. A newcomer reads it from the state
(`phase !== 'LOBBY'`) and sees *« Partie en cours — rejoins la prochaine partie. »* — it replaces
the old `spectate` flow.

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

**Every guest re-sends `hello` when a peer joins the room.** This is not noise: it is what makes
the host's own reload work (§4.11). After the host comes back with a new peer id, the guests
must find it again to re-attach their seats. The `hello` is idempotent, so sending it on every
peer join is harmless.

Guests accept the state broadcast from any peer in the room. The room code is the password, so
this is the same trust level as the room itself.

### 4.10 Host controls
The host title-bar is the admin bar: per-phase advance buttons and escape hatches (force
reveal; never past a disconnected seat, §4.12). The only exit from a blocked game is
« terminer la partie », which only the host can press (§4.12).
**Force reveal** is available in VOTE: it ends the round with the votes received so far.

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
Screen wake-lock is requested on **every** device, not only the host. It needs a secure context,
which plain `http://<LAN-IP>` is not — so it is **phase 2** work (§6.8).

### 4.14 Home screen and « Accueil »
- The home screen offers « Créer une salle » and « Rejoindre » (§3).
- If a stored room (`jdd.host`) exists and its **last activity** was less than **1 hour** ago, the
  home screen also offers « Reprendre la salle XXXX » and « Nouvelle salle ». Last activity means
  the last applied action, phase changes included. A stored room inactive for more than 1 hour
  is discarded at launch, and the home screen is shown without any offer to resume it.
- Every player has « Accueil » in a burger menu, always reachable but not prominent. Leaving to the
  home screen disconnects the device: its seat is disconnected and blocks the game until the
  player returns by pseudo (§4.12). It is a way to unstick oneself, not a quit.
- A guest's device keeps the code of the last room it received a state from (`jdd.room`). If
  that room was seen less than 1 hour ago, the home screen offers « Revenir dans la salle XXXX ».
  Otherwise it is discarded.

### 4.15 Screens by phase
The host's admin buttons appear on the host's device, next to its own player screen.
« Terminer la partie » is available to the host in every phase (§4.12).

| Phase | Host buttons | Chooser | Writer | Other players |
|---|---|---|---|---|
| LOBBY | « Démarrer » (enabled at ≥ 3 seated **and** all connected), options (« Mode vocal seul », « Nombre de tours ») | seat list | seat list | seat list, options read-only |
| PICK | none | swipeable deck, « ✓ Choisir ce mot », manual entry | « Le Chooser choisit un mot » | same waiting text |
| DRAFT | « Lecture » (enabled when every Writer has submitted) | list of who has submitted | 500-character field, « Envoyer », locked after sending | word shown |
| DICTATE | none (the Chooser validates) | dictation card, « Passer au vote — tout le monde a entendu » | normal: waiting screen; vocal: numbered vote buttons | same as Writer |
| VOTE | « Révéler » (enabled when every Writer has voted; force reveal always available) | dictation card stays, may repeat a definition | normal: numbered definitions and vote; vocal: numbered vote buttons | same as Writer |
| REVEAL | « Manche suivante » (last round: « Voir le classement ») | round points, total scores | round points, total scores | same |
| END | « Rejouer » | ranking | ranking | ranking, waiting for the host |

### 4.16 Messages
Every message is shown **to one device only** (§4.2). The last column says where it comes from:
*local* = the device decides on its own, *state* = it is read from the broadcast state, *seat* =
it is a per-seat error recorded by the host.

| Situation | Text | Source |
|---|---|---|
| Pseudo length or characters invalid | « Pseudo : 3 à 20 caractères, lettres et chiffres. » | local |
| Pseudo already taken | « Ce pseudo est déjà pris dans cette salle. » | state (a connected seat carries that pseudo) |
| Join during a game | « Partie en cours — rejoins la prochaine partie. » | state (`phase !== 'LOBBY'`) |
| Word already played | « Ce mot a déjà été joué. » | local check, or *seat* |
| Voting for your own fake | « Tu ne peux pas voter pour ta propre définition. » | seat (the option is greyed out anyway) |
| Waiting for a seat | « En attente de <pseudo> » | state |
| Host disconnected | « Hôte déconnecté — en attente de son retour » | state |
| Reconnecting | « Reconnexion… » | local |
| Send failed twice | « Connexion instable » | local |
| Word list failed to load | « Impossible de charger la liste de mots. Saisie manuelle uniquement. » | local |

---

## 5. Scoring

Per round:

| Event | Points |
|---|---|
| A Writer's fake collects one vote | Author +1 per vote |
| A Writer votes for the real definition | Writer +1 |
| The Chooser | 0 by design — their reward is social, not points |

A Writer **cannot vote for their own fake** (§3 VOTE), so a Writer can never score a point for
their own definition.

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
  context, so wake-lock is not reliable on phones (§6.8, phase 2).
- Room code lowercased = the room password.
- The **host** owns `S` (the authoritative state: phases, secrets, scores, seat list).
  Guests own nothing but the last state they received. All game logic — scoring, reveal,
  disconnection gating — runs on the host device; guests are dumb screens.
- Consequence: if the host leaves, the game pauses until it returns (§4.11).

### 6.2 Phase machine (host side, 100% manual — no timers)

```
LOBBY ──(host Start, ≥3 seated AND all connected)──▶ PICK ──(Chooser pick, host relays)──▶ DRAFT
      LOBBY ◀──(« Rejouer »: scores and round reset)── END ◀──(all rounds played)─── REVEAL
      PICK: chooser = next seat in join order (wraps); rounds = tours × N, frozen at start
      DRAFT ──(all fakes in AND host advance)──▶ DICTATE ──(Chooser "tout le monde a entendu")──▶ VOTE
      VOTE ──(all Writers voted AND host reveals)──▶ REVEAL
      The machine is identical in both modes; only the ballot rendering differs (§3, §4.5)
      A vote is accepted iff  phase === 'VOTE' || (phase === 'DICTATE' && vocal)   (§4.2)
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
| `jdd.hist` | localStorage | words played on this device (FIFO cap 3000; sent in `hello`; the word of each round is appended when it is broadcast in DRAFT; clearable from Lobby) |
| `jdd.name` | localStorage | default pseudonym |
| `jdd.host` | localStorage | host's game state backup, written after each action and restored on reload; cleared when a new room is created or when inactive for more than 1 hour (§4.14, §6.6) |
| `jdd.draft` | localStorage | unsent text of the current fake or definition, keyed by room; cleared on send (§4.9) |
| `jdd.room` | localStorage | `{ code, seenAt }` for the last room this device received a state from; `seenAt` is refreshed on each state broadcast (§4.14) |

### 6.5 Wire protocol (single channel `g`)

Every message is a JSON object with a discriminator `k`. Direction is fixed per message.

**Broadcast model.** There is **one action channel and no targeted sends**: a message sent by
anyone reaches every peer in the room. Direction is enforced by *what each client draws*
(§4.2), not by the transport. This is the simplest thing that works, and the privacy cost it
carries is listed in §7. Consequences to keep in mind while implementing:
- The host broadcasts the **whole state**. Every device therefore physically holds the fake
  texts, the real definition, the authors and the Chooser's REAL badge. The UI never draws them
  outside the phase that allows it (§4.2).
- A `def` / `vote` / `pick` sent by a guest reaches the other guests too. Guests ignore inbound
  `k` values that are not addressed to the host — the host is the only one that acts on them.

**Guest → host**

| `k` | Payload | Host behaviour |
|---|---|---|
| `hello` | `{ name, hist: string[] }` | Seat new player (LOBBY only), or reclaim a disconnected seat by `name`. A duplicate pseudo or a late join is **refused silently** — the device concludes it from the state (§4.2, §4.16). Merge `hist` into the host-side union, broadcast the union (§4.4), and broadcast the state whether the seat was taken or not. |
| `pick` | `{ w, p, d }` (`p` may be empty for manual entry) | Accept only from the current Chooser, in PICK. If `w` was already played, record the error on that seat (« Ce mot a déjà été joué. ») and change nothing. Otherwise store, go to DRAFT. |
| `def` | `{ text }` (≤ 500 chars) | Accept only from a non-Chooser seated player, in DRAFT, once per round. |
| `vote` | `{ idx }` (1…N) | Accept from a non-Chooser seated player, **when the ballot is visible to them**: `phase === 'VOTE' \|\| (phase === 'DICTATE' && vocal)`. Once per round. Irrevocable. If `idx` is the voter's own fake, record the error on that seat and change nothing. |
| `valid` | `{}` | Chooser only, in DICTATE: « tout le monde a entendu » → VOTE (both modes). |

**Host → guests**

| `k` | Payload | Notes |
|---|---|---|
| `state` | the whole game state `S` (§6.6) | Broadcast on every state change, and after every `hello`. The state is the single source of truth: every client derives what it draws from it (§4.2). |
| `union` | `{ words: string[] }` | The **union of the seated devices' histories** (§4.4). Broadcast **every time a seat joins** — once per seat, never per round. |

Notes:
- **Idempotency is free.** `def` and `vote` fill a per-seat slot (`fakes[seat]`, `votes[seat]`)
  that is written once per round: a second message for the same seat and the same round is
  simply ignored. No dedup key is needed.
- The union is merged host-side from the `hist` arrays of the `hello` messages; the host sends
  the merged set back on every join (§4.4). It is not re-sent per round.
- **No rejection message exists.** A join failure is read locally from the state (a connected
  seat already carries that pseudo, or `phase !== 'LOBBY'`); an action failure is recorded as a
  per-seat error and comes back with the next state broadcast.
- Trystero's peer id changes on reload; identity is always the pseudo, never the peer id.
- On a peer join, each guest re-sends `hello` (idempotent, needed for the host's own reload,
  §4.9). After a host restore, every seat starts as disconnected until its owner's `hello`
  arrives. While reconnecting, a guest shows « Reconnexion… » over its last state.
- A failed send is retried once, then « Connexion instable » is shown.
- **Message size:** Trystero frames messages at ~16 KB but chunks and reassembles larger
  payloads by itself, and accepts them automatically when only `onMessage` is used. The union
  can therefore travel as a single message; no chunking code is needed.

### 6.6 Front-end architecture (decided)
- **Stack:** React + TypeScript + JSX, built with Vite. Base URL is `/`; a custom domain is planned for phase 2.
- **Authority:** only the host runs `reduce()`. Guests never compute game state: they send
  intents (§6.5) and draw the last state they received.
- **One state, one projection.** The state `S` is a plain JSON object; `project(S, me)` (§4.2)
  turns it into everything a seat may draw. Both are pure functions, and both are what the
  tests cover (§6.7). There is no second, "wire-level" filter, and no per-recipient payload.
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
- **Structure:** one folder per phase for screens (`Lobby`, `Pick`, `Draft`, `Dictate`, `Vote`,
  `Reveal`, `End`), plus `game/` (rules, pure), `net/` (transport), `store/`. No router:
  the room is read from `?room=` and the « À propos » screen is a state value.
- **Validation:** incoming actions are validated in `reduce()` (phase, player, value ranges).
  No schema library.
- **Loading:** the app renders first. `wordlist.json` loads in the background and is needed
  from the first PICK; until it is ready, the Chooser sees a loading message and manual entry.
  If it fails to load, an error message is shown and only manual entry is offered.
- **All the user-facing text is French** and lives in one module (`ui/text.ts`), so the wording
  of §4.16 can be reviewed in one place and never drifts between screens.

The state has exactly these fields — nothing else:

```ts
type Phase = 'LOBBY' | 'PICK' | 'DRAFT' | 'DICTATE' | 'VOTE' | 'REVEAL' | 'END'

type State = {
  phase: Phase
  seats: string[]                     // pseudos, in join order (seats[0] is the host)
  connected: Record<string, boolean>  // per seat
  errors: Record<string, string>      // per seat: a message for that seat only
  chooser: string | null
  round: number
  tours: number
  vocal: boolean
  word: string
  category: string
  realDef: string
  fakes: Record<string, string>       // pseudo → the fake it submitted
  ballot: (string | 'real')[]         // the frozen 1…N order, by author
  votes: Record<string, number>       // pseudo → the index it voted for
  scores: Record<string, number>
}
```

### 6.7 Tests
- Automated tests cover: `reduce` (phase guards, scoring, the Chooser's exclusion), `ranking`
  (dense ranking), `shuffle`, the exclusion union (case- and accent-insensitive), and
  `project` (what each role may draw, per phase — §4.2).
- Also covered: the **own-vote rejection** (§3 VOTE), the **ballot-visibility rule** (a vote is
  accepted iff the ballot is visible to that Writer — vocal mode in DICTATE, both modes in
  VOTE), and the **VOTE → REVEAL** transition (all votes in, and host-forced).
- `project` is tested as a pure function of `(state, me)`: the host's screen and a guest's
  screen are the same code path, so one set of tests covers both.
- No component tests. Tests run with Vitest, without a browser.

### 6.8 Build and local tooling
The repo has no `package.json` yet; the build creates one at the root.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on the Mac, `--host` so the phones on the same Wi-Fi can reach it. Useful while developing; the reload behaviour differs from the built app. |
| `npm run build` | Vite production build into `dist/` (the app shell + hashed assets). |
| `npm run serve` | **LAN server**: serves `dist/` on the Mac's LAN address and prints the URL to open on the phones. |
| `npm test` | Vitest, no browser (§6.7). |
| `npm run lexique` / `npm run defs` / `npm run preview` | The existing word-pack pipeline (§6.3), unchanged. |

- **The LAN server** is a small dependency-free Node script (`scripts/serve-lan.mjs`) that
  serves the built `dist/` over `0.0.0.0` on a chosen port and prints the machine's LAN URL
  (e.g. `http://192.168.1.24:8080/?room=XXXX`). The phones open that URL. It is a *static file
  server only* — the game itself has no server (§6.1); it exists purely to hand the HTML/JS/JSON
  to the phones, and to serve `data/wordlist.json` alongside the app.
- `data/wordlist.json` is **copied into `dist/` at build time** (or served alongside it by the
  LAN server), so a phone fetches it from the same origin as the app.
- Wake-lock does not work over plain `http://<LAN-IP>` (not a secure context, §4.13): the
  screens may dim during a long round. **Phase 2** fixes this with HTTPS (GitHub Pages).
- **Word-list caching:** `wordlist.json` is ~1.6 MB. It is fetched once per device and kept in
  memory; it is *not* stored in `localStorage` (the 5 MB budget is better spent on game state).
  A device that has already loaded it in this session does not re-download it.
- **Fonts:** Patrick Hand is self-hosted as a woff2 under `public/fonts/`, referenced from the
  app's CSS. Caveat is dropped, so only one font file is needed.

---

## 7. Anti-cheat posture (accepted trade-offs)

The threat model is “friends at a table”, not adversarial security:

- **Read-phase leak vector:** neutralized at the *rendering* level — during normal-mode DICTATE a
  guest's phone displays no playable information (§4.2).
- **No targeted sends (§6.5).** Every device physically receives the whole state: the fake
  texts, the authors, the Chooser's dictation card with its REAL badge, and the `pick` payload
  with the real definition. The UI never draws them outside the phase that allows it, but a
  determined player could dig them out of their own device. Accepted: this is a family game,
  not a competitive one.
- **Every device holds the whole word list.** Also deliberate: every player will be Chooser in
  some round, and the Chooser draws the 100-card deck locally from `wordlist.json`, so the pack
  must be on every phone. **Consequence, accepted:** a player who knows the word can look up
  its real definition in the pack they already have — the single most effective cheat, and it
  is available to everyone equally.
- **Known, accepted hole:** the word travels in the `pick` message when it is chosen, and that
  message is broadcast — so every device physically holds it, as described above. The deck
  itself is client-local, but a determined player could inspect the JS. Fine for a friend group.
- **Vote peeking:** the state carries the authors, so a guest could in principle match a fake to
  its author before REVEAL. The UI does not draw it. Accepted, for the same reason.
- **Self-voting:** a Writer cannot vote for their own fake (§3 VOTE) — the host rejects it.
- **Future hardening ideas** (roadmap): targeted sends, encrypting the pick message,
  per-option commitment-hash voting, host-signed reveals, definition-less packs for
  non-Choosers.

---

## 8. Status

**Nothing is built yet.** This plan describes the whole target application: the React +
TypeScript + Vite app (§6.6), the LAN server tooling (§6.8), and the seven-phase game loop
(§6.2). The word pack and its pipeline (`scripts/`, `data/`) already exist and are ready
(§6.3).

**Features that are new in this plan** (i.e. not yet implemented anywhere): the seven-phase
machine with a single code path for both modes (§6.2), the one-state / one-projection model
(§4.2, §6.6), the union history exchanged once per seat (§4.4), tours-based round count (§5),
unique pseudos and seat reclaim (§3, §4.9), disconnection gating (§4.12), the own-vote
rejection (§3 VOTE), a disconnected seat blocking Start (§3 LOBBY), and the refusal of a late
join replacing spectate (§4.8).

---

## 9. Visual theme

- **Look:** school notebook paper. Cream sheet with horizontal blue ruled lines and one
  magenta margin line on the right.
- **Cards** (deck, definitions, dictation card): sheets of paper laid on the sheet, with a
  slight shadow, a slight random rotation (a few degrees), and a subtle paper grain on the sheet.
- **Typography:** **Patrick Hand everywhere** (titles, buttons, body), self-hosted (woff2).
  Caveat is dropped. Minimum text size **18 px** on phones.
- **Colours:**
  - Title: red pen (`#d8505f`).
  - Buttons and accents: blue pen (`#1f7ac0`).
  - Margin: magenta (`#f28ac6`).
  - Ink text: dark blue (`#2e3d54`). Secondary text: pencil grey (`#7b889c`).
  - Error states: red pen.
  - Sheet: cream `#fbf9f2`, ruled lines `#c3e2f1`, card paper `#fffdf6`, card border `#d9e3ec`.
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
- Font: **Patrick Hand** by Patrick Wagesreiter, **SIL Open Font License 1.1** — self-hosted at
  `public/fonts/patrick-hand.woff2`, with the licence text alongside it in
  `public/fonts/OFL.txt` (required by the OFL). The font may be bundled and redistributed with
  the app.
- The « À propos » entry point is **mandatory and visible on the Lobby** (small button).

---

## 11. Open decisions

None. The only remaining work is phase 2 (wake-lock and HTTPS), see §6.8.

---

## 12. Decision log

Decisions taken during the plan review, recorded so the reasoning is not lost.

| # | Decision | Consequence in the plan |
|---|---|---|
| 1 | **The word list ships to every device.** Players may look up a definition and cheat; accepted, because the game is for friends and every player must be able to be Chooser (they draw the deck locally). | §3 PICK, §6.3, §7 |
| 2 | **No targeted sends.** One broadcast channel, simple. The privacy cost is accepted and documented: every device receives the whole state; only the *drawing* is filtered per role. | §6.5, §4.2, §7 |
| 3 | **One phase machine for both modes.** `PENDING` is gone: DICTATE and VOTE are shared by vocal and normal mode, and differ only in what the ballot looks like (numbers vs. numbers + texts) and when it becomes visible. One invariant governs voting: **votes are accepted exactly when the ballot is visible to that Writer** — in code, `canVote = phase === 'VOTE' \|\| (phase === 'DICTATE' && vocal)`. The reveal trigger is the same in both modes: the **host presses « Révéler »** once every Writer has voted (force-reveal always available). The Chooser's dictation card stays up from DICTATE through VOTE, so they can repeat a definition. | §3 DICTATE/VOTE, §4.2, §4.5, §6.2, §4.15 |
| 4 | **A Writer cannot vote for their own fake.** The host rejects it; the option is greyed out on the voter's phone, in both modes, using the exact index published by the host. | §3 VOTE, §4.3, §6.5, §4.16 |
| 5 | **A disconnected seat blocks Start** (it still counts as seated). | §3 LOBBY, §6.2 |
| 6 | **The history union is broadcast on every seat join**, once per seat — not re-sent per round. During the game each client adds the words it sees broadcast in DRAFT to its own list. | §4.4, §6.5 |
| 7 | **The data README is subordinate to this plan.** The « 🎴 Nouveau paquet » button and the rarity-sorted deck described in `data/README.md` are not plan features: the deck is 100 cards sampled uniformly at random, browsed circularly, with no reshuffle. | §3 PICK, §6.3 |
| 8 | **Tooling is added to the plan**: root `package.json` (Vite + React + TS + Vitest), and a LAN server script (`scripts/serve-lan.mjs`) that serves the built app to the phones over the local network. | §6.8 |
| 9 | **One state, one projection.** The host broadcasts the whole state; there is no wire-level filtering and no `reject` message. What a device may draw is decided by a single pure function `project(state, me)`, run by the host and the guests alike. A join failure is read locally from the state; an action failure is recorded as a per-seat error and comes back with the next broadcast. | §4.2, §6.5, §6.6 |
| 10 | **The ballot is stored as a list of authors.** `(seatPseudo \| 'real')[]` yields the texts, the author of each option, the index of the real definition and the index of each Writer's own definition — so the own-vote rule is exact on both sides, with no text matching and no second "dictation" payload. | §3 VOTE, §4.3 |
| 11 | **One exclusion set.** The words played in the current game are already in each device's local history (the DRAFT broadcast adds them), so the excluded set is simply the local `jdd.hist` ∪ the union — no separate "played in this game" list to maintain. | §3 PICK, §4.4 |
