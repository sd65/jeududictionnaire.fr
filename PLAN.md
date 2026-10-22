# Jeu du Dictionnaire — Game Design & Technical Plan

**Working title:** *Jeu du Dictionnaire* (French edition of the classic parlour game known as
**Call My Bluff** / **Balderdash**).
**Format:** mobile-first web app, played on a handful of phones over a Wi-Fi network,
with **no game server of our own**. Peer-to-peer via Trystero / Nostr relays (Internet required, see §6.1).
**Status:** the app is **not built yet** — this plan is the specification for what to build.
Decisions are recorded in §13.
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

**Seven phases, and the machine is identical in both settings.** The two settings differ only in
**what the ballot looks like** and **when it becomes visible** (§3 DICTATE, §3 VOTE). One
invariant governs voting throughout: **votes are accepted exactly when the ballot is visible to
that Writer.** There is no setting-specific phase and no setting-specific branch in the phase
machine.

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
  - **« Afficher à tous les définitions pendant le vote »** (§4.5), **unchecked** by default: the
    definitions are heard, never read — the phones show numbers only (§4.5).
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
- The **burger menu** of the header holds « Accueil » and « À propos » (mandatory, §10); it is
  always there, on every screen, and it never takes the place.

### PICK (no timer, 100% host-manual advance)
- Only the Chooser acts. They get a **swipeable deck of 100 cards** (word, category `p`,
  definition `d`), browsed circularly via swipe or ‹ › buttons, with **✓ Choisir ce mot**
  under the card.
- Deck = **100 cards sampled uniformly at random from the word list** (§6.3), freshly drawn
  **per Chooser per round**, after exclusions below. Algorithm: shuffle the eligible words, take the first 100. The eligible words are the ones the device has **loaded** — one shard of the pack, which is shuffled, so a shard is an unbiased sample of the pack (§6.3). Order is circular; no reshuffle mid-PICK.
- If the loaded words cannot supply 100 eligible cards, the device loads another shard (up to three, §6.3); after that the deck is simply shorter. No special
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
- **What the phones show is the only difference between the two settings:**
  - **Definitions not displayed (the default — the option is unchecked):** phones show **only the
    ballot numbers** (1…N) — and the numbers are **votable immediately**, so a Writer can vote
    *while the Chooser is still reading*.
  - **Definitions displayed (the option is checked):** phones show **nothing** about the
    definitions (blank waiting screen, no texts, no numbers). The definitions only appear on
    screen in VOTE.
- Only when the Chooser has finished dictating do they press
  **« Passer au vote — tout le monde a entendu »**. The host's admin button only relays
  this transition → VOTE.
- The Chooser's **dictation card stays on screen from DICTATE through VOTE** (numbered stable
  order + REAL badge), so they can repeat a definition on request at any point before the
  reveal.

### VOTE (no timer — the same phase in both settings)
- The ballot is open. **Votes are accepted exactly when the ballot is visible to that Writer**
  — one invariant, both settings, no exceptions. In code that is a single expression (§4.2):
  `canVote = phase === 'VOTE' || (phase === 'DICTATE' && !showDefinitions)`.
- **What is on screen:**
  - **Definitions not displayed (the default):** the **numbered buttons only** (1…N), never the
    texts. Writers who already voted during DICTATE keep their vote; the others vote now.
  - **Definitions displayed:** the **definitions on screen**, numbered 1…N in the stable ballot
    order, and the Writer taps the one they believe is real.
- One vote per Writer, irrevocable, guarded host-side.
- **A Writer may not vote for their own fake definition.** The state stores the ballot as a list
  of **authors** (§4.3), so the exact index of a Writer's own definition is known by the client
  (`myIdx`): their own option is **greyed out** on their phone, in **both** settings. The host
  rejects such a vote anyway (§6.5) — that is the guard, not the UX. The voter keeps their
  ballot and can pick another option; the message is
  « Tu ne peux pas voter pour ta propre définition. ».
- Votes are hidden until reveal — only the aggregate count of voters is shown. The **Chooser**
  additionally sees **which** seats have voted, and who has not voted yet: **who**, never **what**
  — the content of a vote stays hidden until REVEAL (§4.2). He needs it: when the definitions are
  not displayed the votes come in while he is still dictating, and he is the one who has to know
  whether to wait or to hand over (§4.5).
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

It returns: `phase`; `isHost` / `isChooser` / `isSeated`; `chooserPseudo` (the pseudo of the
Chooser, to name the player in the messages); `canVote` (= `phase === 'VOTE' ||
(phase === 'DICTATE' && !showDefinitions)`, the one voting invariant, §3 VOTE); `showTexts` (= `phase ===
'VOTE' && showDefinitions`); `options` (the N definitions in the stable ballot order); `authors` (the
author of each option); `myIdx` (the index of the caller's own definition, or −1); `realIdx`
(the index of the real definition, drawn only by the Chooser); `voterSeats` (the seats that have
voted, and their state — for the Chooser only, §3 VOTE); `waitingFor` (the pseudos of the
disconnected seats); `myError` (the message addressed to the caller's own seat, if any).

What each role is allowed to **see** per phase. The columns are those of a **guest**; the host's
player screen obeys the same column (the host's admin bar is separate):

| Drawn | LOBBY | PICK | DRAFT | DICTATE (no texts) | DICTATE (texts) | VOTE (no texts) | VOTE (texts) | REVEAL |
|---|---|---|---|---|---|---|---|---|
| word + category | — | — | ✓ | — | — | — | — | ✓ |
| submitted names / counts | — | — | ✓ (no texts) | — | — | — | ✓ (counts) | — |
| fake texts | — | — | — | — (never, unchecked) | — | — (never, unchecked) | ✓ (numbered, stable order) | ✓ |
| ballot numbers 1…N | — | — | — | ✓ (votable immediately) | — | ✓ (still votable) | ✓ | ✓ |
| "voted" counts (aggregate only) | — | — | — | ✓ | — | ✓ | ✓ | — |
| "voted" names (the Chooser only) | — | — | — | ✓ (Chooser) | — | ✓ (Chooser) | ✓ (Chooser) | — |
| real index, votes detail, round points and total score | — | — | — | — | — | — | — | ✓ |

The Chooser's screen adds two things. From DICTATE on, a **dictation card** — the numbered stable
order with a REAL badge — drawn on the Chooser's screen only. During DRAFT, the **fakes as they
arrive**: the Chooser reads the definitions aloud, so it sees each one as it is sent, with its
author. The Writers still never see each other's texts, in any phase. During DICTATE (normal
mode), a guest's phone *displays* no playable information.

And one more, from the vote: the **list of the voters** — who has voted, who has not. The Chooser
alone sees it (§3 VOTE): the names only, never the choice each name made. It is empty for
everyone else, and empty too when the ballot is not visible.

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

### 4.5 The definitions on screen or not (numbers-first voting)
The host's option is **« Afficher à tous les définitions pendant le vote »**, and it is
**unchecked by default**: the definitions are heard, never read.
- **Unchecked (the default):** texts are **never** shown during DICTATE or VOTE — phones show N
  numbered buttons.
- The numbers are votable **from the start of DICTATE**: Writers vote *while the Chooser is
  still reading*, which is the whole point of the setting.
- Writers who have not voted when the Chooser validates simply keep voting in VOTE (same
  numbered buttons) — REVEAL follows once the last vote lands, or when the host forces it
  (§4.10).
- The Chooser keeps their dictation card (§3 DICTATE) so they can repeat a definition.
- This setting leans the burden onto the Chooser's voice — the “purest” rendition of the game.
- **Checked:** the definitions are displayed, numbered 1…N, at VOTE; during DICTATE the phones
  show a blank waiting screen, and the vote opens at VOTE only.

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
Screen wake-lock is requested on **every** device, not only the host, as soon as the device is
**in a room** (§4.9). The request is a request and nothing more: it never throws, never fails,
and shows nothing to the player (§13, decision 30).

The browser **releases** the lock as soon as the tab goes to the background, so the request is
made **again** when the page comes back to the foreground — otherwise the screen would dim
again after a glance at another application, which is exactly when the player is watching the
table.

It needs a **secure context**, which plain `http://<LAN-IP>` is not: over the LAN there is no
lock, and the screens may dim during a long round (§6.8). On the deployed site the context is
secure — HTTPS (§6.1) — so the lock is taken there.

### 4.14 Home screen and « Accueil »
- The home screen offers « Créer une salle » and « Rejoindre » (§3).
- If a stored room (`jdd.host`) exists and its **last activity** was less than **1 hour** ago, the
  home screen also offers « Reprendre la salle XXXX ». There is no second button for it: « Créer
  une salle » already starts a fresh room, and two buttons that do the same thing only confuse.
  The offer is the **most recent** of the two (host's own game, or the last room this device
  heard from) — **one at a time** — and it sits **above everything else**, as a **dashed** box
  drawn in another ink: it is a different kind of action from creating or joining.
  Last activity means
  the last applied action, phase changes included. A stored room inactive for more than 1 hour
  is discarded at launch, and the home screen is shown without any offer to resume it.
- A stored game belongs to **its** room: it is restored only for the same room code, the same
  host, and the same hour. A **new** room therefore starts from scratch — the ranking of the
  previous game must never appear in a room where nobody has ever played (§4.11).
- Every player has « Accueil » in a burger menu, always reachable but not prominent. Leaving to the
  home screen disconnects the device: its seat is disconnected and blocks the game until the
  player returns by pseudo (§4.12). It is a way to unstick oneself, not a quit. Leaving a game in
  progress **asks for confirmation**, and the URL then returns to the root — otherwise a reload
  would drop the device back into the game it has just left (§4.9).
- A guest's device keeps the code of the last room it received a state from (`jdd.room`). If
  that room was seen less than 1 hour ago, the home screen offers « Revenir dans la salle XXXX ».
  Otherwise it is discarded.

### 4.15 Screens by phase
The host's admin buttons appear on the host's device, next to its own player screen.
« Terminer la partie » is available to the host in every phase (§4.12). It is **not a game
command** but the way out of a stuck game: it is therefore **small and discreet**, and it **asks
for confirmation** — cutting the round in progress loses its points. The same goes for « Accueil »
in the burger menu: leaving a game in progress asks first (§4.14).

**The screens name the players, never the roles.** No French word says everything the Chooser
does — picks the word, holds the true definition, dictates it, never votes — and a role label on
a phone screen is cold anyway. The screens therefore call a player by their **pseudo**: « <pseudo>
est en train de choisir un mot… ». The role names (Chooser, Writer) stay in the plan and in the
code, where they name a rule, not a person.

| Phase | Host buttons | Chooser | Writer | Other players |
|---|---|---|---|---|
| LOBBY | « Démarrer » (enabled at ≥ 3 seated **and** all connected), options (« Afficher à tous les définitions pendant le vote », « Nombre de tours ») | seat list | seat list | seat list, options read-only |
| PICK | none | swipeable deck, « ✓ Choisir ce mot », manual entry | « <pseudo> est en train de choisir un mot… » | same waiting text |
| DRAFT | « Lecture » (enabled when every Writer has submitted) | list of who has submitted, **and the fakes as they arrive** | 500-character field, « Envoyer », locked after sending | word shown |
| DICTATE | none (the Chooser validates) | dictation card, « Passer au vote — tout le monde a entendu », **the list of those who have voted** (definitions not displayed) | definitions displayed: waiting screen; not displayed: numbered vote buttons | same as Writer |
| VOTE | « Révéler » (enabled when every Writer has voted; force reveal always available) | dictation card stays, may repeat a definition, **the list of those who have voted** | definitions displayed: numbered definitions and vote; not displayed: numbered vote buttons | same as Writer |
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
- **Hosting:** the app is compiled to static assets (`dist/`, including `data/wordlist.json`) and
  served by **GitHub Pages** at `https://jeududictionnaire.fr/` — the apex, `www` redirecting
  to it. **HTTPS is enforced**: `http://` answers 301. The phones open that URL. Not a PWA (no
  manifest, no service worker) for now.
- The **LAN server** (`scripts/serve-lan.mjs`) remains, for a game without Internet (§6.8): the
  phones open the Mac's LAN address. There the context is **not secure**, so the wake lock is
  simply absent (§4.13).
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

**The pack is loaded in pieces, not whole.** The pack is 1.6 MB raw (393 623 B gzipped) and a
round needs **100** cards out of the 10 548 (§3 PICK). A device therefore fetches a **shard**,
not the pack.

The obvious tool — HTTP `Range` — does not work on the deployed site, and the plan says so
rather than pretending otherwise. Measured on `jeududictionnaire.fr` (2026-10-21):

| Request | Answer |
|---|---|
| `GET /data/wordlist.json` | `200`, `accept-ranges: bytes`, `content-length: 1637718` |
| `Range: bytes=0-1023` **with** `Accept-Encoding: gzip` (what a browser sends) | `206`, `content-encoding: gzip`, `content-range: bytes 0-1023/**393623**` — the range is applied to the **compressed** representation, so those 1 024 bytes are a truncated gzip stream: **undecodable** |
| `Range: bytes=0-1023` with `Accept-Encoding: identity` | `206`, `content-range: bytes 0-1023/**1637718**`, no `content-encoding` — the raw JSON prefix, **usable** |

`Range` only ever applies to the representation the server chose, and GitHub Pages compresses.
A browser **cannot** ask for an uncompressed answer either: `Accept-Encoding` is a forbidden
header name, the user agent always sends `gzip, deflate, br`. The LAN server
(`scripts/serve-lan.mjs`) ignores `Range` altogether — it answers `200` with the whole file.

So the pack is made **sharded**, and `Range` is supported where it can be:

- **The pack is shuffled when it is generated** (seeded PRNG, the seed written in `meta.seed`).
  The rarity order stays in `data/candidates.json`, where the pipeline needs it; the order of
  `wordlist.json` is no longer meaningful. Consequence: **any subset of the pack is an unbiased
  sample of it**. Without the shuffle — the pack is sorted by increasing frequency — every subset
  would be the *rarest* words, and every game would propose the same cards.
- **The pack is published in shards**: `data/shards/00.json` … `31.json` — 32 shards, ~330 words
  each, ~50 KB raw and ~13 KB gzipped — written by the pipeline next to the pack. The build
  copies the **shards** into `dist/data/`, and stops copying the whole pack.
- **A device fetches one shard per round** — a *random* one, so the cards differ every round —
  and draws its deck from it (§3 PICK). If the shard does not yield 100 eligible cards (the
  exclusions), the device fetches another shard, up to **three**; after that the deck is simply
  shorter, as the rule already says.
- **`Range` is supported end to end, with a fallback.** The client asks with a `Range` header and
  **checks the answer**: a `206` that carries `Content-Encoding` is a truncated gzip stream, so
  it is refused, and the client reads the response stream instead, **stopping as soon as it has
  enough words** (`reader.cancel()`) — which works on every server, compressed or not. A server
  that answers a range with an uncompressed body — the LAN server, once **G4** teaches it to —
  lets the client transfer exactly the bytes it needs.

### 6.4 Device storage map

| Key | Store | Purpose |
|---|---|---|
| `jdd.hist` | localStorage | words played on this device (FIFO cap 3000; sent in `hello`; the word of each round is appended when it is broadcast in DRAFT; clearable from Lobby) |
| `jdd.name` | localStorage | default pseudonym |
| `jdd.host` | localStorage | host's game state backup (`{ state, code, at }`), written after each action and restored on reload; cleared when a new room is created or when inactive for more than 1 hour (§4.14, §6.6) |
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
- **Stack:** React + TypeScript + JSX, built with Vite. Base URL is `/`; the custom domain is
  `jeududictionnaire.fr`, served over HTTPS (§6.1, §12.14).
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
- **Loading:** the app renders first. The word list loads in the background — **one shard at a
  time** (§6.3), not the whole pack — and is needed from the first PICK; until it is ready, the
  Chooser sees a loading message and manual entry. If it fails to load, an error message is
  shown and only manual entry is offered.
- **All the user-facing text is French** and lives in one module (`ui/text.ts`), so the wording
  of §4.16 can be reviewed in one place and never drifts between screens.
- **Debug hook:** the app exposes its current projection as `window.__jdd` (the `View` of
  §4.2). It is what the end-to-end harness reads to know which phase a player is in, instead
  of scraping the DOM. Read-only, no game logic behind it.

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
- **Screens are checked by a server render** (`renderToString`), not by a browser: each screen is
  rendered from a projection fixture and must not crash. No DOM, no jsdom, no snapshots.
- **The transport is an interface** (§12.1): the in-memory implementation lets a whole game run
  inside a test file, so the end-to-end flow is covered without a network.
- **The end-to-end harness is outside Vitest** (§12.12): it drives a real Chrome over the
  Chrome DevTools Protocol and needs a browser, a network and the Nostr relays. It is a script
  (`npm run e2e`), not a unit test.
- No browser, no component-testing library. Tests run with Vitest, in Node.

### 6.8 Build and local tooling
The repo has no `package.json` yet; step **A1** of the build plan (§12) creates one at the root.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on the Mac, `--host` so the phones on the same Wi-Fi can reach it. Useful while developing; the reload behaviour differs from the built app. |
| `npm run build` | Vite production build into `dist/` (the app shell + hashed assets + `data/wordlist.json`). |
| `npm run serve` | **LAN server**: serves `dist/` on the Mac's LAN address and prints the URL to open on the phones. |
| `npm test` | Vitest, no browser (§6.7). |
| `npm run test:watch` | Vitest in watch mode, while developing. |
| `npm run typecheck` | `tsc --noEmit` — the types are checked without emitting. |
| `npm run e2e` | The end-to-end harness on a real Chrome (§12.12): `--smoke` for a single page, no argument for the 3-player game. Needs the Internet: it uses the real Nostr/Trystero transport. |
| `npm run lexique` / `npm run defs` / `npm run preview` | The existing word-pack pipeline (§6.3), unchanged. |

- The `package.json` scripts are the contract of the build plan: every step of §12 ends with
  `npm test`, `npm run typecheck` and `npm run build` all green (§12.3).
- **Chrome for the harness:** the end-to-end scenario drives a **real Google Chrome**, launched
  by the harness itself with a throwaway `--user-data-dir` (never the user's own profile).
  Chrome ≥136 refuses remote debugging on the default profile anyway.

- **The LAN server** is a small dependency-free Node script (`scripts/serve-lan.mjs`) that
  serves the built `dist/` over `0.0.0.0` on a chosen port and prints the machine's LAN URL
  (e.g. `http://192.168.1.24:8080/?room=XXXX`). The phones open that URL. It is a *static file
  server only* — the game itself has no server (§6.1); it exists purely to hand the HTML/JS/JSON
  to the phones, and to serve `data/wordlist.json` alongside the app.
- `data/wordlist.json` is **copied into `dist/` at build time** (or served alongside it by the
  LAN server), so a phone fetches it from the same origin as the app.
- Wake-lock does not work over plain `http://<LAN-IP>` (not a secure context, §4.13): the
  screens may dim during a long round. Over the deployed site, which serves HTTPS (§6.1), the
  lock is taken — and taken again when the page comes back to the foreground.
- **Word-list caching:** the pack is ~1.6 MB, so the device fetches **one shard** (~50 KB raw,
  ~13 KB gzipped) instead of the whole list (§6.3). It is kept in memory; it is *not* stored in
  `localStorage` (the 5 MB budget is better spent on game state). A device that has already
  loaded its shards in this session does not re-download them. Where the server honours `Range`
  (§6.3), only the bytes the deck needs are transferred.
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

**Phases A, B, C, D and E are done** (§12.5, §12.6, §12.7, §12.8, §12.9). The tooling exists — `package.json`
(Vite + React + TS + Vitest), the Vite skeleton, the theme CSS, the font, the word list
copied into `dist/`, the LAN server. The **pure core of the game** is written and covered by
tests: the state, the reducer (the seven-phase machine), the scoring, the words, the
projection. The **transport** exists too, in two implementations — one in memory (a whole
game runs inside a test file) and one real (Trystero over Nostr) — along with the protocol,
the session, the store and the end-to-end harness.

**The game is playable, and it survives the real world.** Every screen of §4.15 is there.
The disconnection blocks the game and the returning player takes their seat back; the host
can reload and finds the table where it left it; the history of the played words is kept on
each device, unioned across the table, and clearable; the text typed but not sent is kept
too. The « À propos » screen attributes the sources and their licences, and the screen stays
awake on the deployed site (§4.13).

**Three players really play a whole game.** `npm run e2e` opens three isolated Chrome
contexts, has them find each other through the relay, and plays three rounds on the real
transport: the game reaches END on the three devices, the points match §5 to the point, and
the consoles stay clean. That is the **T5** check of §12.2.

**The game is online, over HTTPS.** It is served by **GitHub Pages** at
`https://jeududictionnaire.fr/` — the apex, `www` redirecting to it — and **HTTPS is
enforced** (`http://` answers 301). The certificate covers both names, and the sources, the
licence and the word pack are public too (§10). The screen therefore stays awake on a phone:
the wake lock is taken in a secure context, and taken again when the page comes back to the
foreground (§4.13, §12.14).

**What is not built yet** is the acceptance phase — the plan's own checklist, on real phones
(§12.10) — and the light pack (§12.11).

**The word pack is the next piece of work (§6.3, §12.11).** The pack is 1.6 MB and a round
needs 100 cards out of 10 548: it becomes shuffled and sharded, the device loads one shard per
round, and `Range` is supported where the server can serve an uncompressed answer.

**Nothing else is built yet.** This plan describes the whole target application: the
seven-phase game loop (§6.2) and everything around it. The word pack and its pipeline
(`scripts/`, `data/`) already exist and are ready (§6.3). The execution order is **§12**.

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
  - Buttons and accents: blue pen (`#1f7ac0`). The buttons are **drawn boxes**, never blocks of
    colour: the main action is a box with a firm blue line, a secondary action is a **written
    word** (underlined), and the offer to resume a game is a **dashed** box in another ink.
  - Margin: magenta (`#f28ac6`).
  - Ink text: dark blue (`#2e3d54`). Secondary text: pencil grey (`#7b889c`).
  - Error states: red pen.
  - Sheet: cream `#fbf9f2`, ruled lines `#c3e2f1`, card paper `#fffdf6`, card border `#d9e3ec`.
- **Responsive:** mobile portrait is the primary target. On larger screens, a single centred
  column of max 480 px, with the sheet visible around it. The column is at least as tall as the
  screen, so the magenta margin runs down to the bottom of the screen on a computer too.
  Touch targets at least **44 px**.
- **Motion:** sober only: short fades or slides between phases, no looping or decorative animation.
- **Modes:** light only, no dark mode.
- **Language:** French only.

## 10. Licensing notes

- **The project itself** — code, build and data are published under **Creative Commons
  Attribution – ShareAlike 4.0** (CC BY-SA 4.0): full text in `LICENSE`, sources and
  modifications in `LICENSES.md`. The licence text and the third-party notices are
  **served with the app** (`/LICENSE.txt`, `/LICENSES.txt`, `/THIRD-PARTY-NOTICES.md`),
  because the app ships the adapted word pack.
- Word list, grammatical categories & frequencies: **Lexique 383** (lexique.org) —
  **CC BY-SA 4.0** (the site's own licence statement; the `README-Lexique.txt` of the
  official archive says the same). The `data/Lexique383.tsv` kept in this repository is
  byte-identical to the official export (sha256 `637ba37a…52b`).
- Definitions: **French Wiktionary**, **CC BY-SA 4.0** (also GFDL). The pack is a
  compliant **adaptation**: the in-app « À propos » screen attributes the sources with the
  licence links, states the **modifications** (selection of the rare forms, extraction and
  cleaning of the definitions, reformatting) and carries the share-alike notice. Any
  redistribution of the pack must keep this attribution.
- Trystero, React and React DOM: MIT — their full notices are in
  `public/THIRD-PARTY-NOTICES.md`, shipped with the app.
- Font: **Patrick Hand** by Patrick Wagesreiter, **SIL Open Font License 1.1** — self-hosted at
  `public/fonts/patrick-hand.woff2`, with the licence text alongside it in
  `public/fonts/OFL.txt` (required by the OFL). The font may be bundled and redistributed with
  the app.
- The « À propos » entry point is **mandatory and always visible**: the burger menu in the
  header, on every screen. It opens a sheet that comes up from the bottom, over the game.

---

## 11. Open decisions

None. The game is online over HTTPS (§6.1, §12.14), and the wake lock works there (§4.13).
What remains is the acceptance on real phones (§12.10) and the light pack (§12.11).

---

## 12. Build plan (iterative)

### 12.1 The rules of the build
- **Small steps.** Each step below is small enough to finish in one sitting. Each one ends with
  a green `npm test`, a green `npm run typecheck`, a green `npm run build`, and a commit.
- **Every step has a test.** A step that cannot be tested is split until it can. "It works on my
  phone" is the acceptance of the last phase only, never of an intermediate step.
- **Logic away from the screen.** Everything decidable without a DOM lives in `game/` (pure) and
  is tested with Vitest, in Node, without a browser (§6.7).
- **The transport is an interface.** `net/` exposes a small interface with two implementations:
  the real one (Trystero) and an in-memory one used by the tests. A whole game can therefore be
  played inside a test file, with no network and no browser.
- **The screens decide nothing.** A screen reads the `View` (§4.2) and draws it. That is what
  keeps the game rules in one file, and what lets a screen be checked with a server render.
- **The order matters.** A step builds on the previous one. No step is started before the
  previous is committed and green.
- **How a step is checked is written in the step.** The next section lists the six checkers;
  every row of the phases below names the one it uses.

### 12.2 The six ways to check something
Every step of this plan is verified the same way: with one of these six checkers. The column
"Cost" is what it takes, so a step is never blocked on something slow.

| # | Checker | Command | What it proves | Cost |
|---|---|---|---|---|
| **T1** | the unit tests | `npm test` | the rules of `game/`, the protocol, the store — pure logic, in Node, no browser, no network | ~1 s |
| **T2** | the types | `npm run typecheck` | the contracts between the modules: a wrong `State` field or a wrong message type is caught here | ~2 s |
| **T3** | the build | `npm run build` | the app assembles, and the assets (`dist/`, the font, the word list) are where the plan says they are | ~3 s |
| **T4** | the smoke run | `npm run e2e -- --smoke` | the app **really boots in a real Google Chrome**, the console stays clean, a screenshot is written to `dist/e2e/` | ~10 s |
| **T5** | the whole game | `npm run e2e` | **three real players** play a whole game, over the real transport and the real Nostr relays | ~1 min, plus the relay discovery |
| **T6** | the human eye | `npm run serve`, then a phone | the theme, the ergonomics, the real relay on a real device | manual |

**T1–T3 are the floor of every step.** T4 comes with the harness (step **C7**), T5 only once the
screens exist (step **E8**), T6 only at the end.

The harness opens a **visible** Chrome: the game is watched, not just asserted. `--headless` makes
it invisible for a quieter run.

### 12.3 The loop of a step
No step is finished until this has been run, from the repository root:

```bash
npm test && npm run typecheck && npm run build
```

and, from **C7** on:

```bash
npm run e2e -- --smoke
```

Then: one commit, whose message says what the step changed and **how it was checked**.
`npm run test:watch` runs T1 continuously while the step is being written.

### 12.4 Which checker for which change
When in doubt, this table says what to run before committing.

| What you touched | Run |
|---|---|
| a rule in `game/` (the reducer, the scoring, the words, the projection) | T1 + T2 |
| a component or a screen | T1 (the server render) + T4 |
| the transport or the protocol | T1 + T5 |
| the store | T1 + T4 |
| the local storage | T1 + T5 |
| the build config, the assets, the CSS | T3 + T4 (+ T6 for the CSS) |
| anything that could change what a player sees | T1 + T4 + T5 |

### 12.5 Phase A — the tooling (nothing playable yet)
*Environment: Node and npm only. No browser needed before C7.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| A1 | `package.json` | Vite + React + TS + Vitest, and the scripts of §6.8 | `npm install`, then `npm test` → 1 passing test; `npm run typecheck` → no error; `npm run build` → `dist/` created |
| A2 | The Vite skeleton | `index.html`, `src/main.tsx`, `src/App.tsx`, the theme CSS, the font, **and the `<meta name="viewport">` tag** (without it the layout is wrong on a phone: the emulated viewport stays at 980 px) | `npm run build` → `dist/index.html` and `dist/fonts/patrick-hand.woff2` both exist; **from C7 on**, `npm run e2e -- --smoke` → Chrome opens the app, the console is clean, a screenshot lands in `dist/e2e/` |
| A3 | The word list in the build | `data/wordlist.json` copied to `dist/data/` at build time (a small plugin in `vite.config.ts`) | `npm run build` then `test -f dist/data/wordlist.json`; `npm run serve` then `curl -sf http://127.0.0.1:8080/data/wordlist.json \| head -c 40` |
| A4 | The LAN server | `scripts/serve-lan.mjs` serves `dist/` and prints the URL to open on the phones | `npm run serve` → `curl` 200 on `/` and on `/data/wordlist.json`, 404 on `/../etc/passwd`; then open the printed URL on a phone |

### 12.6 Phase B — the pure core (`src/game/`, no React, no network)
*Environment: T1 only. This phase is invisible from the outside, and that is deliberate: the
rules are the part that must be exactly right, and they are the part that can be tested
without a phone, a browser or a network.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| B1 | `src/game/state.ts` | the `State` type (§6.6) and `initialState()` | `npm test` → `src/game/state.test.ts`: the initial state is the LOBBY, no seat, no Chooser, no score |
| B2 | `src/game/reduce.ts` — LOBBY | `join`, `setOptions`, `start` | `npm test` → `reduce.test.ts` ▸ *LOBBY*: Start is refused under 3 seats and when a seat is disconnected; the seat set is frozen at start; the total rounds = `tours × N` |
| B3 | `src/game/reduce.ts` — PICK | `pick` | `npm test` → `reduce.test.ts` ▸ *PICK*: accepted only from the current Chooser and only in PICK; a word already played is refused |
| B4 | `src/game/reduce.ts` — DRAFT | `def` | `npm test` → `reduce.test.ts` ▸ *DRAFT*: only from a Writer, only in DRAFT, **once** per round — a second `def` from the same seat changes nothing |
| B5 | `src/game/reduce.ts` — DICTATE and VOTE | `valid`, `vote` | `npm test` → `reduce.test.ts` ▸ *VOTE*: the ballot-visibility rule (vocal mode in DICTATE, both modes in VOTE); a vote for one's own fake is refused; a vote is irrevocable |
| B6 | `src/game/reduce.ts` — REVEAL and END | `advance`, `end`, `replay` | `npm test` → `reduce.test.ts` ▸ *REVEAL*: the Chooser moves to the next seat and wraps around; the last round goes to END; « Rejouer » resets the scores and the round counter |
| B7 | `src/game/scoring.ts` | the points of §5 and the dense ranking | `npm test` → `src/game/scoring.test.ts`: the points table; the ties (1, 1, 2); the Chooser scores 0 |
| B8 | `src/game/words.ts` | the normalisation, the shuffle, the exclusion, the deck | `npm test` → `src/game/words.test.ts`: `Éléphant` ≡ `elephant`; the shuffle is a permutation; the deck is at most 100 cards and excludes the played words; a short pack is accepted |
| B9 | `src/game/project.ts` | the projection (§4.2) | `npm test` → `src/game/project.test.ts`: the whole table of §4.2, phase by phase and role by role; `canVote`, `showTexts`, `myIdx`, `waitingFor`, `myError` |

Beyond the plan's file list, phase B also produced: the **admin bar** as a pure derivation
(`adminBar(state)`, next to the projection — its rules are game rules, so they are tested with
the rest of the core), the **`hello` reclaim rule** and the **`hostBack`** action for the host's
reload, and the **injected dependencies** of the reducer (`excluded`, `shuffle`) — the reasons
are in the decision log (§13, decisions 13 to 17).

### 12.7 Phase C — the transport and the shell
*Environment: T1 for the logic, T4 for the shell.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| C1 | `src/net/transport.ts` | the interface, plus an in-memory implementation | `npm test` → `src/net/transport.test.ts`: a host and two guests exchange messages inside one process |
| C2 | `src/net/protocol.ts` | the message types of §6.5 (`hello`, `pick`, `def`, `vote`, `valid`, `state`, `union`) | `npm test` → `src/net/protocol.test.ts`: each message encodes and decodes; an unknown `k` is ignored |
| C3 | The integration test | a whole game, from the lobby to the ranking | `npm test` → `src/net/game.test.ts`: the game completes; the scores match §5; the union is broadcast on each join and never per round |
| C4 | `src/net/trystero.ts` | the real transport, behind the same interface | `npm test` is still green (the C1–C3 suite runs against the in-memory transport); **T6**: two phones, `npm run serve` |
| C5 | `src/store/store.ts` | the external store and `useSyncExternalStore` | `npm test` → `src/store/store.test.ts`: `subscribe` / `getSnapshot`; one change notifies the subscribers once |
| C6 | The app shell | the screen is chosen from the phase; the admin bar for the host | `npm test` (the server render of every screen); `npm run e2e -- --smoke` → the app boots in a real Chrome, the console is clean |
| C7 | `scripts/e2e/chrome.mjs` | **the CDP driver**: launch a real Chrome, open isolated contexts, evaluate, click by label, capture the console, screenshot, emulate a phone | `npm run e2e -- --smoke`: the driver launches a real Google Chrome, opens a page, evaluates a value in it and asserts it |

Beyond the plan's file list, phase C also produced: `src/net/session.ts` (what one device
does in a room — the host reduces and broadcasts, the guest sends intents and draws the last
state it received), `src/store/useStore.ts` (the React binding), `src/app/session.ts` (the
link to the current session), the seven screen folders under `src/ui/` (shells — their content
arrives in phase D), and `src/test/fixtures.ts` (a whole game, prefabricated, for the screens'
tests). The reasons for the choices are in the decision log (§13, decisions 18 to 21).

### 12.8 Phase D — the screens
*Environment: T1 (the server render) + T4 (the real Chrome).*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| D1 | Home and Lobby | create / join / resume, the pseudo, the options, « À propos » | `npm test` (the server render); `npm run e2e -- --smoke` (the screen appears in a real Chrome); the pseudo rules live in `game/`, not in the component |
| D2 | Pick | the deck of 100 cards, the manual entry | `npm test` (the navigation and the deck are in `game/`); `npm run e2e -- --smoke` |
| D3 | Draft | the fake field, the counters, the lock after sending | `npm test` (the server render); `npm run e2e -- --smoke` |
| D4 | Dictate and Vote | the dictation card, the ballot, the own option greyed out | `npm test` (the server render, with a projection fixture); `npm run e2e -- --smoke` |
| D5 | Reveal and End | the round points, the ranking | `npm test` (the server render); `npm run e2e -- --smoke` |
| D6 | The debug hook | the app exposes `window.__jdd` (the current `View`, §6.6) | `npm run e2e -- --smoke`: the harness reads a non-empty phase from the hook |

Beyond the plan's file list, phase D also produced: `src/game/room.ts` (the room code: drawn,
validated, read from the URL), `src/store/storage.ts` (the device's keys), `src/app/room.ts`
(opening a room), `src/app/wordlist.ts` (the pack, loaded in the background),
`src/app/debug.ts` (the hook), `src/ui/Ballot/Ballot.tsx` (the ballot, shared by DICTATE and
VOTE) and `src/ui/About/About.tsx`. The reasons for the choices are in the decision log
(§13, decisions 22 to 27).

### 12.9 Phase E — the real world
*Environment: T1 for the simulated cases, T5 for the real ones, T6 for the look.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| E1 | The disconnection | the peer-leave handling, the blocking, the reconnection | `npm test` → `game.test.ts` ▸ *disconnection*: a guest leaves → the game is blocked → they come back → it resumes; then `npm run e2e` |
| E2 | The host reload | the `jdd.host` snapshot and the restore | `npm test` → `game.test.ts` ▸ *host reload*: the host reloads → the guests re-send `hello` → the game resumes where it was; then `npm run e2e` |
| E3 | The history | `jdd.hist`, the union, « Effacer mon historique » | `npm test` → `game.test.ts` ▸ *history*: the union is broadcast on each join; the excluded set is the local history ∪ the union |
| E4 | The local storage | `jdd.draft`, `jdd.name`, `jdd.room` | `npm test` → `src/store/storage.test.ts`: the round-trip through a fake localStorage |
| E5 | The « À propos » screen | the attribution and the licences (§10) | `npm test` (the server render); `npm run e2e -- --smoke` |
| E6 | The theme | the paper, the ruled lines, the red and blue pens, the motion | **T6**: `npm run serve`, look at it on a phone — the only step of this phase without an automated check |
| E7 | The wake lock | the best-effort request on every device, and the request again when the page comes back to the foreground | `npm test`: it never throws when the context is not secure, and it takes the lock again on the foreground; `npm run e2e -- --smoke`: the request is counted in a real Chrome; **T6** on a phone, over HTTPS |
| E8 | The 3-player scenario | `scripts/e2e/three-players.mjs`: 3 players in 3 isolated Chrome contexts play a whole game, on the real transport | `npm run e2e`: the game reaches END on the 3 devices, the scores match §5, no console error — **this is T5** |

Beyond the plan's file list, phase E also produced: `src/app/wakelock.ts` (the screen that stays on), `scripts/e2e/server.mjs` (the test server), `scripts/e2e/player.mjs` (a player seen from the harness) and the `jdd.hist` / `jdd.draft` keys of the storage. The reasons for the choices are in the decision log (§13, decisions 28 to 31).

### 12.10 Phase F — the acceptance
*Environment: T6 only. These are the steps a human does, on real phones.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| F1 | A whole game on 3 phones | the acceptance of the local build | **T6**: `npm run build && npm run serve`, open the printed URL on 3 phones, play the loop of §3 |
| F2 | The edge cases | the refresh mid-round, the sleeping phone, the host leaving | **T6**: trigger each of them on a real phone |

### 12.11 Phase G — the light pack
*Environment: T1 for the pack writer and the loader, T3 for the build, T4 for the app.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| G1 | The pack is shuffled | `scripts/fetch-definitions.mjs` writes the words in a seeded random order and records the seed in `meta.seed`; the rarity order stays in `candidates.json`, where the pipeline needs it | `npm test` → a test on the pack writer: the same seed gives the same order, another seed gives another one, and the first 100 words of the shuffled pack are **not** the 100 rarest |
| G2 | The shards | the pipeline writes `data/shards/00.json` … `31.json`; the build copies the shards into `dist/data/` and stops copying the whole pack; the harness asks for a shard | `npm test` → the shard writer: the shards partition the pack, no word twice, their union is the pack; `npm run build` then `ls dist/data/shards \| wc -l` = 32 and `test ! -f dist/data/wordlist.json`; `npm run e2e -- --smoke` |
| G3 | The device loads a shard | `src/app/wordlist.ts` fetches a **random** shard, keeps its words, and asks for another only when the deck would be too short | `npm test` → the loader against a fake `fetch`: one shard gives a drawable deck, and a second shard is asked for only when the exclusions empty the first |
| G4 | `Range`, and its fallback | the client sends a `Range` header and **refuses a `206` that carries `Content-Encoding`**; the LAN server answers `206` with `Accept-Ranges: bytes`, uncompressed | `npm test` → the loader against a fake `fetch` that answers `206` + `content-encoding` (the client falls back) and one that answers `206` without it (the client uses it); `npm run serve` then `curl -sf -D- -H "Range: bytes=0-1023" http://127.0.0.1:8080/data/shards/00.json \| head -3` shows `206` and `content-range` |
| G5 | The deck from the loaded words | `src/game/words.ts` draws the deck from the loaded words; the exclusions apply as before; a short load gives a short deck | `npm test` → `words.test.ts`: the deck is 100 cards, the excluded words are absent, a load of 30 words gives 30 cards |

### 12.12 The end-to-end harness
The unit tests cover the rules; the harness covers **the app as it is really used** — a real
browser, the real transport, the real relays, and three devices at once.

**It drives a real Google Chrome**, over the Chrome DevTools Protocol, from a small Node
script (`scripts/e2e/chrome.mjs`). The protocol is built into Chrome and Node has a WebSocket
client built in: no dependency, no Playwright, no Puppeteer, and never Chromium.

| Piece | Role |
|---|---|
| `scripts/e2e/chrome.mjs` | the driver: launch Chrome, create isolated contexts, open pages, evaluate, click, read the console, screenshot, emulate a phone |
| `scripts/e2e/three-players.mjs` | the scenario: 3 players, one whole game, the assertions |

**Two modes, same result:**

| Mode | What it does | When |
|---|---|---|
| `npm run e2e -- --smoke` | one page: the app boots, the console is clean, a screenshot is written to `dist/e2e/` | after every step from C7 on |
| `npm run e2e` | three players, one whole game, the assertions | from E8 on, and before any release |

**Three players = three isolated contexts.** `Target.createBrowserContext` gives each player
its own storage partition, so each has its own `jdd.name`, `jdd.hist`, `jdd.host` and
`jdd.room` — exactly what a phone would have. The three pages run on the **same origin**; the
isolation comes from the context, not from the URL. Each context is opened in its **own
visible window** (`Target.createTarget` with `newWindow: true`), so the game can be watched
while it runs.

**The harness never scrapes the DOM.** It reads the phase from `window.__jdd` (§6.6) and
clicks buttons **by their French label** — the labels of §4.16, which live in one module
(`ui/text.ts`). So the harness also checks that the wording of §4.16 is the wording on screen.

**The pseudo is injected before the app boots**
(`Page.addScriptToEvaluateOnNewDocument`), so each player starts with its own name without
touching the Lobby UI.

**Chrome is launched by the harness**, with a throwaway `--user-data-dir` — never the user's
own profile — and with `--disable-features=WebRtcHideLocalIpsWithMdns`, because the three
contexts sit on the same machine and would otherwise hide their local IPs behind the same
mDNS name, which breaks the ICE pairing between them.

**The scenario needs the Internet**: the three players meet through the Nostr relays, exactly
like on a real table. It is therefore the automated version of **F1**, and it is expected to
be slower than a unit test (relay discovery).

| It checks | It does not check |
|---|---|
| that a whole game can be played by 3 devices | the rules in isolation — that is Vitest's job |
| that the transport, the state and the screens agree | the visual quality of the theme |
| that the console stays clean on every device | the behaviour of a phone that falls asleep |

### 12.13 The order, and what comes first
The steps are strictly sequential. The first three are the ones to do right away, and they are
the smallest possible vertical slice — a green test, a green build, nothing else:

1. **A1** — the `package.json` and the dependencies, with one trivial test.
2. **A2** — the Vite skeleton, the theme CSS, the font, the viewport tag, and the build that
   produces `dist/`.
3. **A3** — the word list copied into `dist/`, and the LAN server that serves it.

After A1–A4 the phones can open the app (an empty page). Everything until B9 is invisible from
the outside, and that is deliberate: the game rules are the part that must be exactly right, and
they are the part that can be tested without a phone, a browser or a network.

The build is not finished until **F1** passes: the app is only a game when a whole party can
play it on real phones, over a real Wi-Fi network, with the real relay. From **E8** on, the
automated harness (`npm run e2e`) catches the regressions that would otherwise need three
phones and a free evening. **G** (§12.11) comes after **F**: it changes how the word list is
delivered, so it is done once the game is accepted as it is.

**H** (§12.14) is the deployment, and it is done: the game is online at
`https://jeududictionnaire.fr/`, over HTTPS.

---

### 12.14 Phase H — the deployment
*Environment: the GitHub Actions workflow, and the DNS.*

| # | Step | Deliverable | How to check it |
|---|---|---|---|
| H1 | The workflow | `.github/workflows/pages.yml`: checkout with `lfs: true`, Node 24, `npm ci`, build, `upload-pages-artifact`, `deploy-pages` | the run is green on GitHub, and the site serves the new bundle |
| H2 | The domain | `jeududictionnaire.fr` at the apex, `www` → the apex; the DNS at OVH (the four GitHub addresses, in A and AAAA) | `curl -sIL https://www.jeududictionnaire.fr/` answers 301 to the apex; the certificate covers both names |
| H3 | HTTPS | "Enforce HTTPS" ticked in the repository settings | `curl -sI http://jeududictionnaire.fr/` answers 301 to `https://`, and `https://` answers 200 |
| H4 | The wake lock over HTTPS | the lock is taken in a secure context, and taken again when the page comes back to the foreground (§4.13) | `npm run e2e -- --smoke` counts the request in a real Chrome; **T6** on a phone: the screen does not dim during a round |

---

## 13. Decision log

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
| 12 | **The end-to-end harness drives a real Google Chrome**, over the Chrome DevTools Protocol, with no Playwright and no Puppeteer. Three players = three isolated browser contexts (their own storage partition, their own visible window). The harness reads the phase from a debug hook and clicks by the French labels, so it never scrapes the DOM. | §6.6, §6.7, §12.12 |
| 13 | **The reducer takes two injected dependencies**, not state fields: `excluded` (the words that may not be played again) and `shuffle` (the one that freezes the 1…N ballot order). The excluded set is *not* in the `State` — the state has exactly the fields of §6.6, and the union lives in the host's memory (§4.4) — and the shuffle must be injectable for the ballot order to be testable at all. | §3 PICK, §4.3, §4.4, §6.6 |
| 14 | **A `hello` reclaims a seat only if that seat is disconnected; a connected seat means a duplicate and is refused silently.** The plan says both things in two places (§3, §6.5: "refuse the duplicate"; §4.9: "a hello that arrives before the host has noticed the old peer leaving is still a reclaim"). The race of §4.9 is settled at the transport level instead: the guest re-sends `hello` until it sees itself connected, which the protocol already prescribes ("every guest re-sends `hello` when a peer joins"). Always reclaiming would let a newcomer take over a *connected* seat — two devices drawing the same seat — which breaks the table; a lost reconnect is recoverable, that is not. A `hostBack` action covers the host's own reload: on its return, every other seat starts disconnected until its owner's `hello` arrives (§6.5). | §3 LOBBY, §4.9, §4.11, §6.5 |
| 15 | **The vote index is 0-based inside the state** (the index in the ballot array, which is what `myIdx` and `realIdx` are), and **1-based on the wire** (§6.5: `{ idx }` is 1…N). The conversion happens once, in the protocol layer. | §4.2, §4.3, §6.5 |
| 16 | **`canVote` keeps the plan's exact expression** — `phase === 'VOTE' \|\| (phase === 'DICTATE' && vocal)` — and is restricted, on top of it, to a seated Writer: the Chooser never votes (§3 VOTE) and a device that is not at the table never votes. A test asserts the expression for every Writer, in every phase, in both modes. | §3 VOTE, §4.2 |
| 17 | **The host's admin bar is a separate pure derivation** (`adminBar(state)`), living next to the projection. Its rules — when « Démarrer » is enabled, when « Lecture » waits for every fake, when « Révéler » is forced — are game rules, so they belong to the pure core and are tested with it; the screen only draws them. | §4.10, §4.15 |
| 18 | **The union is not in the state.** It lives in the host's memory and is broadcast on every seat join (§4.4); the state keeps exactly its §6.6 fields. The excluded set used to validate a `pick` is the host's local history ∪ the union, both kept by the session. | §4.4, §6.6 |
| 19 | **A guest applies the host's disconnection locally.** When the host's peer leaves, nobody broadcasts anything any more — so the guest marks the host's seat disconnected in its own copy of the state, and the projection stays the single place that decides what is drawn. When the host comes back it broadcasts the state again, which replaces the guest's copy wholesale. | §4.11, §4.12, §4.2 |
| 20 | **Trystero 0.26 has no "room ready" event any more.** The transport therefore fires it as soon as the room exists, and the guest re-sends its `hello` on every peer join (§4.9) — the application never depends on the exact moment the relays answer. | §4.9, §6.5 |
| 21 | **The harness launches Chrome on a random free port** (`--remote-debugging-port=0`, the port is read from `DevToolsActivePort`), with a throwaway `--user-data-dir` and `--disable-features=WebRtcHideLocalIpsWithMdns` — without that last flag, the three contexts on one machine hide their local IPs behind the same mDNS name and ICE pairing between them fails. | §12.12 |
| 22 | **The room code is shown, and stored with the host's snapshot.** « Créer une salle » draws a fresh four-letter code (§3 LOBBY) and shows it in the Lobby, so the host can share it; a guest joins with the code or with the `?room=CODE` link. The code is part of `jdd.host` (`{ state, code, at }`) because the state itself has no room field (§6.6) — and « Reprendre la salle XXXX » needs it (§4.14). | §3 LOBBY, §4.14, §6.4, §6.6 |
| 23 | **A duplicate pseudo is refused by the host, and the refusal is recorded as the seat's error.** The state cannot tell "the host accepted me" from "the host refused me": the pseudo *is* the identity, and two devices may carry the same one (§4.9). So the host notes the message for that pseudo (§4.16) — the device that duplicates sees it, and the seated player sees it too until their next action clears it. The client-side check of §3 LOBBY applies wherever the client already has a seat list; the host's check is the guard. | §3 LOBBY, §4.9, §4.16 |
| 24 | **The projection resolves the caller's seat case-insensitively** (`samePseudo`), because a device may have written « léa » where the seat is called « Léa »; the canonical spelling is used for the error, the vote and the own-definition index. The projection also exposes `myVote` — the caller's own vote — which is their own data, and no one else's. | §3 LOBBY, §3 VOTE, §4.2 |
| 25 | **The only timer in the app is the join timeout** (§4.6, §4.7): five seconds, in the app shell, showing one message and one button. The failover silently makes the waiting device the host of a fresh room. | §4.6, §4.7 |
| 26 | **The app side of the debug hook is written in D1**, because the harness needs to read the phase from the very first screen; D6 verifies it (`npm run e2e -- --smoke` reads a non-empty phase from the hook and drives the whole « create a room » flow with it). | §6.6, §12.8, §12.12 |
| 27 | **The storage module is created in D1**, because the Home and the Lobby need `jdd.name`, `jdd.host` and `jdd.room` (§4.14). E3 and E4 add `jdd.hist` and `jdd.draft` to the same module, and E4 adds the round-trip tests. | §6.4, §12.8, §12.9 |
| 28 | **The room code lives in the URL** (`?room=CODE`), and the app puts it there as soon as a room is opened. It is the only thing that survives a reload: it is what lets the host restore its game from `jdd.host` and the guest rejoin, without anyone clicking anything (§4.9, §4.11, §4.14). The plan has no router (§6.6) — this is not one. | §4.9, §4.11, §4.14, §6.6 |
| 29 | **The harness counts only the application's errors.** A relay that falls over is logged by the browser as a network error; the application already knows, retries, and says nothing. The check keeps the exceptions and the `console.error` of the app, and ignores the browser's own network log. | §12.2, §12.12 |
| 30 | **The wake lock is a request, never a requirement.** It is asked on every device — the phones are face-down on the table (§4.13) — and the refusal is silent: without a secure context (the usual `http://<ip-du-LAN>`), there is simply no lock. The request never throws, and its test says so. | §4.13, §6.8 |
| 31 | **The 3-player scenario checks §5 exactly.** The harness knows the votes it cast, and the reveal gives the count of each option and its author. It verifies: a vote is worth exactly one point, a fake that received a vote gives a point to its author, a vote for the real definition gives a point to the voter, and the Chooser scores nothing. The final ranking is the sum of the rounds' points. | §5, §12.9, §12.12 |
| 32 | **The join panel puts « Annuler » first and the join button on the right.** The button the player pressed (« Rejoindre ») stays where it was: the panel does not move the action under their finger. The row is aligned **to the left**, like every other row of the app. | §4.14 |
| 33 | **The Chooser sees the fakes live during DRAFT.** It is the one who reads the definitions aloud, so it needs them as they arrive, with their author. This is a change to §4.2 (the fake texts used to be drawn nowhere before DICTATE); the Writers still never see each other's texts, and the Chooser never votes. | §4.2, §4.15 |
| 34 | **The two actions that break something ask for confirmation**: « Terminer la partie » (the host, which cuts the round in progress) and « Accueil » (the player, which leaves the table). Both are inline confirmations, not a native dialog, and both can be cancelled. | §4.12, §4.14, §4.15 |
| 35 | **The burger menu is the entry point of « Accueil » and « À propos »**, on every screen, and it never takes the place. « À propos » opens a sheet that comes up from the bottom, over the game — no margin, no gap, and the title well below the app's title. Quitting returns the URL to the root. | §4.14, §10 |
| 36 | **The app column is at least as tall as the screen** (`min-height: 100dvh`), so the magenta margin runs down to the bottom of the screen on a computer as well as on a phone. | §9 |
| 37 | **The home screen does not offer a second way to create a room.** The plan had « Nouvelle salle » next to « Reprendre la salle XXXX »; but « Créer une salle » is right there, and two buttons that do the same thing only confuse. Resuming is the offer; creating stays where it was. | §4.14 |
| 38 | **The buttons are drawn, not painted.** No button has a solid blue background any more: the main action is a box with a firm blue line (a thicker one), a secondary action is a written word, and the voted option is a pale wash. The app is a sheet of paper — a block of colour is a web app, not a notebook. The hierarchy is carried by the *shape* of the button, not by a fill, and the touch targets stay at 44 px. | §9 |
| 39 | **The offer to resume a game sits above everything else**, in a dashed box drawn in another ink, and there is only one offer: the most recent of the host's own game and the last room heard from. It is a different kind of action from creating or joining, and it says so before the player touches anything. | §4.14, §9 |
| 40 | **The saved game belongs to its room.** `jdd.host` carries the room code (§6.4), and the restore checks it: same room, same host, same hour. The check on the pseudo alone was not enough — the same device, with the same pseudo, creating a *new* room inherited the previous game's state, and its final ranking showed up in a brand-new room where nobody had ever played. The condition is a pure function (`savedGameFor`), covered by the tests and by the harness. | §4.11, §4.14, §6.4 |

| 41 | **The pack is shuffled, then sharded.** The pack is sorted by increasing frequency, so *any* subset of it would be the rarest words: a device that loaded only the beginning of the file would propose the same hundred words every game. The pack is therefore written in a seeded random order (the seed in `meta.seed`, the rarity order kept in `candidates.json`), and split into 32 shards — a device loads one random shard per round instead of the 1.6 MB pack. | §3 PICK, §6.3, §12.11 |
| 42 | **`Range` is supported, but only where the representation is uncompressed.** On GitHub Pages a `Range` request comes back with `content-encoding: gzip` and a `content-range` over the *compressed* bytes — a truncated gzip stream, undecodable — and a browser cannot ask for `identity`, `Accept-Encoding` being a forbidden header name. So the client checks the answer and falls back to reading the stream and stopping early; the shards, not the ranges, are what make the transfer small. The LAN server, which serves uncompressed, answers `206` properly. | §6.3, §12.11 |
| 43 | **The Chooser sees who has voted, nobody else.** When the definitions are not displayed, the votes come in while the Chooser is still dictating: he has to know whether to keep reading or to hand over. The projection therefore exposes `voterSeats` — the seats that have voted, with their state — **to the Chooser alone**, and only while the ballot is visible. The names only: **who** voted, never **what** they voted. The choice stays hidden until REVEAL, and the other players still see nothing but the aggregate count. | §3 VOTE, §4.2, §4.15 |
| 44 | **The wake lock is taken again when the page comes back.** The browser releases the lock as soon as the tab goes to the background, so a request made once would be lost after the first glance at another application — exactly when the player is watching the table. The lock is therefore requested again on `visibilitychange`, and the request stays best-effort: it never throws, and a refusal is silent. The hook's logic is separated from the DOM, so it is tested without a browser. | §4.13, §12.9, §12.14 |