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
| **Host** | The device that created the room. Technical and administrative role only; game-wise the host is a player like the others (Chooser or Writer according to the round) | Authoritative game state `S`; admin buttons per phase (manual advance only, never automatic). Admin view shows counts and names, never fake texts nor the real definition (§4.2). Host leaving = game over (§4.11) |
| **Chooser** | Rotates each round in join order. One **tour** = every seated player is Chooser exactly once (§5) | Secretly picks an obscure word and provides the **true definition**; **dictates all definitions aloud** during READ in the stable ballot order (§4.3); writes **no** fake; **never votes**; alone validates the end of the reading (« Passer au vote ») |
| **Writer** | Every non-Chooser seated player (host included when not Chooser) | Writes **one** invented definition; then votes for the definition they believe is real |

A game needs **≥ 3 seated players** (one Chooser + at least two Writers; with fewer, voting is
meaningless).

---

## 3. The round, phase by phase

State machine: `LOBBY → PICK (round start) → DRAFT → READ → VOTE → REVEAL → (next round) → END`

Chapter numbers below include deliberate subtleties that were corrected through playtesting —
they are constraints, not implementation details.

### LOBBY
- The room is a **4-letter code**, letters A–Z only (displayed uppercase, transported lowercase).
  Joining is a URL `?room=CODE` (link or manual code).
- Players choose a **pseudo** (persisted per device, overridable per tab for testing),
  **3 to 20 characters**, **letters (accents included) and digits only**. Leading and trailing
  spaces are removed. Pseudos must be **unique within the room**, **case-insensitively**
  (« Léa » and « léa » clash); uniqueness is **checked by the host** at join
  (duplicate → the guest is asked to pick another; a reclaim by the same device is not a duplicate, §4.9).
- The host configures the game for the whole table:
  - **« Mode vocal seul »** (§4.6), enabled by default.
  - **« Nombre de tours »**, default **2**, minimum **1**, no upper limit. One tour = every seated player chooses once.
    Total rounds = tours × seated players (fixed at start, see §4.1).
- **Start** is disabled until **≥ 3 seated players**.
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
  **per Chooser per round**, after exclusions below. Order is circular; no reshuffle mid-PICK.
- If the pack cannot supply 100 eligible cards, the deck is simply shorter. No special
  treatment: a short or empty deck is acceptable; manual entry is always available.
- Manual entry is always possible in a collapsed panel: word, gender/category (free text, optional),
  definition (required — the Chooser must be able to *vouch* for it). **No validation** beyond
  "required"; no length cap on the real definition.
- **Exclusions (union rule):** excluded = words already played on **any** seated device
  (`jdd.hist` union, exchanged at join, §4.4) + words already played in this game.
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
- **Scoring** (§5) is announced in deltas; then the host moves to the next round
  (next seated player in join order becomes Chooser, wrapping around).

---

## 4. Subtleties worth spelling out

These are the details that make the difference between “software with phases” and a game
that *works* at a dinner table.

### 4.1 The Chooser is excluded everywhere; the seat set is frozen at start
`expectedWriters()` = all seated players minus the Chooser. It drives: fake counting, vote
counting, “all submitted → can advance”, reveal conditions. The Chooser both writes **and**
votes never; their score for the round is 0 by design (§5).

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
| real index, votes detail, scoring | — | — | — | — | — | — | ✓ |

Chooser private view: during DRAFT/READ the Chooser holds a dictation card with the numbered
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
other transition. No countdowns anywhere. Waiting screens show counts only.

### 4.7 Guest waiting screen
Timeout on join: after **5 s** the screen says *« On dirait que cela prend plus de temps que
d'habitude. Pourquoi ne pas relancer un nouveau salon ? »* with a button that silently
**fails over to a fresh room** — the victim silently becomes the new host. At 15 s an extra
hint suggests checking the code / Wi-Fi / Internet.

### 4.8 No late join
Once the game has started, the room accepts no new seats. A newcomer sees
*« Partie en cours — rejoins la prochaine partie. »* (replaces the old `spectate` flow, §6.5).

### 4.9 Refresh ≠ lost seat (identity persistence)
Trystero regenerates the peer id on every page load, so a naive implementation turns every
refresh into a spectator. Each phone carries a persistent ID (`localStorage`) plus a
**per-tab nonce** (`sessionStorage`) so that:
- the user rejoining after a refresh **reclaims their seat** (name, score, half-written vote,
  submitted fake), and
- two tabs on the same phone remain two separate players (testing).

### 4.10 Host controls
The host title-bar is the admin bar: per-phase advance buttons and escape hatches (force
reveal; never past a disconnected seat, §4.12 — the only exit from a blocked game is « terminer la partie »).

### 4.11 Host leaves = game over
If the host closes or leaves, the game is dead. Guests are told so; they can start a new room
or join another. Host migration is a roadmap item (state `S` is serializable).

### 4.12 Disconnection blocks progress
- A **disconnected Writer or Chooser blocks the game**: nobody can advance past the current
  phase until that player reconnects.
- Reconnecting (reopening the tab with the same device identity, §4.9) drops them **straight
  back into the current phase** with their seat, score and submitted data intact.
- Guests see *« En attente de <pseudo> »*; the host sees the same list.
- If a player never returns, **the host may end the game** (→ END screen with scores as they
  stand). No seat removal, no skipping past the missing player.

### 4.13 Screen stays awake on every device
Screen wake-lock is requested on **every** device, not only the host. Requires a secure
context on phones, so it is part of **phase 2** (§6.1, §11).

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
**« Rejouer »** keeps the room, the seated players and their pseudos. It resets scores and
the round counter. Per-device histories (`jdd.hist`) are kept.

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
- **Phase 2:** hosting on **GitHub Pages**, which serves HTTPS. This would also make
  the wake-lock on phones work (§4.13). Until then, plain `http://<LAN-IP>` is not a secure
  context, so wake-lock is not reliable on phones (§11, phase 2).
- Room code lowercased = the room password.
- The **host** owns `S` (the authoritative state: phases, secrets, scores, seat list).
  Guests own nothing but the last `view` they received. All game logic — scoring, reveal,
  disconnection gating — runs on the host device; guests are dumb screens.
- Consequence: if the host leaves, the game dies (§4.11).

### 6.2 Phase machine (host side, 100% manual — no timers)

```
LOBBY ──(host Start, ≥3 seated)──▶ PICK ──(Chooser pick, host relays)──▶ DRAFT
      RESET scores ◀─── END ◀──(all rounds played)─── REVEAL
      PICK: chooser = next seat in join order (wraps); rounds = tours × N, frozen at start
      DRAFT ──(all fakes in AND host advance)──▶ READ ──(Chooser “tout le monde a entendu”)──▶ VOTE
      READ (vocal mode): votes may arrive during the dictation; REVEAL after Chooser validation
      VOTE (normal only) ──(all votes in AND host advance)──▶ REVEAL
      Any phase: blocked while a seated player is disconnected (§4.12)
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
| `jdd.pid` | localStorage | persistent device identity (seat reclaim on refresh) |
| `jdd.tn` | sessionStorage | per-tab nonce (multi-tab testing stays multi-player) |

### 6.5 Wire protocol (single channel `g`)

Every message is a JSON object with a discriminator `k`. Direction is fixed per message.

**Guest → host**

| `k` | Payload | Host behaviour |
|---|---|---|
| `hello` | `{ pid, tn, name, hist: string[] }` | Seat new player (LOBBY only) or reclaim seat by `pid`+`tn`. Reject duplicate pseudo (`reject`) or late join (`reject`). Merge `hist` into the union. Reply with `view`. |
| `pick` | `{ w, p, d }` (`p` may be empty for manual entry) | Accept only from the current Chooser, in PICK. Reject if `w` already played in this game or on a seated device (`reject`, reason « mot déjà joué »). Otherwise store, go to DRAFT broadcast. |
| `def` | `{ text }` (≤ 500 chars) | Accept only from a non-Chooser seated player, in DRAFT, once per round. |
| `vote` | `{ idx }` (1…N) | Accept from a non-Chooser seated player, in READ (vocal) or VOTE, once per round. Irrevocable. |
| `valid` | `{}` | Chooser only, in READ: « tout le monde a entendu » → VOTE (or REVEAL if vocal votes complete). |

**Host → guests**

| `k` | Payload | Notes |
|---|---|---|
| `view` | filtered state (§4.2) | Sent on every state change and in reply to `hello`. Includes `waitingFor: pseudo[]` when a seat is disconnected. During PICK, the Chooser's copy includes `excluded: string[]` (§3). |
| `reject` | `{ reason }` | Replaces the old `spectate` and `repick`. Reasons: duplicate pseudo, game in progress, room closed, word already played (sent to the Chooser only). |

Notes:
- Idempotency: the host dedupes by `(pid, round, phase, k)`. Duplicates are ignored.
- The union history is exchanged once in `hello` and merged host-side; it is not re-sent per round.
- Trystero's peer id changes on reload; identity is always `pid`, never the peer id.

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

- **OPEN-2 — Stack.** Framework: vanilla, React + Vite, or other?
- **Phase 2 — Wake-lock and HTTPS.** Wake-lock on phones needs a secure context. Planned with
  GitHub Pages hosting (HTTPS). Until then, wake-lock is best-effort only. Not part of the local build.
