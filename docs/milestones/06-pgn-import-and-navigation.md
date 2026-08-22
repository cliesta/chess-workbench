# Milestone 6 — PGN import and game navigation

## 1. Goal

Move Chess Workbench from isolated-position analysis toward reviewing complete
personal games:

> Paste one PGN game, navigate its main line, and let the existing board, FEN,
> position insights, latest-move explanation, and Stockfish analysis follow the
> selected game position.

This milestone establishes the game-review workflow. It does not analyse every
move automatically or assign move-quality labels.

## 2. Scope

- Accept one PGN game pasted into a text area.
- Parse it entirely in the browser with the installed `chess.js` dependency.
- Support the PGN main line, including standard comments, NAGs, and ignored
  side variations.
- Support games beginning from the standard position or a PGN `SetUp` /
  `FEN` position.
- Show useful game headers when present: White, Black, Result, Date, Event, and
  Round.
- Build an immutable list of every main-line position, beginning with the
  initial position.
- Navigate with first, previous, next, and last controls.
- Provide a compact clickable SAN move list and identify the currently selected
  ply accessibly.
- Keep the FEN editor synchronized with the selected game position.
- Reuse the existing Position insights, What changed?, and Stockfish panels for
  the selected position.
- Define clear transitions between imported-game review and standalone-position
  analysis.
- Keep invalid PGN from replacing the current workspace.
- Add deterministic domain, component, and application tests.
- Update architecture and the project journal after implementation.

No new npm package is needed.

## 3. Product boundary

### Review one game before analysing many

The first game workflow should make a real PGN useful without becoming a
full-featured study tool. The user can move through the game and inspect each
position with capabilities that already exist.

Stockfish continues to analyse only the currently selected position. The
application must not launch searches for every ply, calculate an evaluation
graph, or scan the game for mistakes in the background. Those require a
separate analysis lifecycle, progress reporting, cancellation, retained
results, and comparable search limits.

### Main line only

`chess.js@1.4.0` parses PGN variations but its loaded history follows the first
variation at each node: the game main line. That is the appropriate scope here.
The UI must visibly say **Main line only** so ignoring side variations is not
surprising.

Comments and Numeric Annotation Glyphs such as `$1` may be accepted by the
parser, but this milestone does not display or edit them. They must not appear
as moves or break navigation.

### Paste rather than file upload

Use a labelled multiline PGN text area and a **Load game** button. A file picker
would add a second input path and Browser File API behavior without changing
the game model. Pasting is sufficient for this first workflow and matches the
approved proposal. File upload can be added later if it proves useful.

## 4. PGN library recommendation

Keep the installed `chess.js` dependency. Its current API provides:

- `loadPgn()`, which throws when a PGN cannot be parsed;
- support for standard headers, comments, NAGs, variations, and result markers;
- support for custom initial FEN positions;
- `getHeaders()` for parsed header values; and
- `history({ verbose: true })`, whose moves contain SAN plus before/after FEN.

The pinned package is already the sole chess-rules dependency and already
generates the move metadata used by Milestone 5. A second PGN parser would
duplicate move legality and notation responsibilities and risk disagreement
with the position model.

Use `loadPgn(pgn)` with its default permissive mode. Strict SAN-only parsing is
attractive in theory, but PGNs exported by real sites and tools may contain
accepted non-strict notation. There is no user-facing strictness setting in
this milestone. The parser still rejects malformed or illegal move text.

All direct `chess.js` use remains in `src/chess/position.ts`. React receives
only immutable application data and never calls `loadPgn`, reads verbose
library moves, or catches library exceptions.

The relevant pinned API is documented in the
[`chess.js` PGN documentation](https://github.com/jhlywa/chess.js/blob/v1.4.0/README.md#loadpgnpgn-options).

## 5. Imported-game model

Use application-friendly types. The exact syntax may be adjusted during
implementation, but the semantic model should be:

```ts
type ImportedGameHeaders = {
  white?: string;
  black?: string;
  result?: string;
  date?: string;
  event?: string;
  round?: string;
};

type ImportedGamePosition = {
  fen: string;
  move?: AppliedMove;
  moveNumber?: number;
  changes?: PositionChanges;
};

type ImportedGame = {
  headers: ImportedGameHeaders;
  positions: ImportedGamePosition[];
};

type ParsedGamePosition = Omit<ImportedGamePosition, "changes">;

type ParsedGame = {
  headers: ImportedGameHeaders;
  positions: ParsedGamePosition[];
};

type ParsePgnResult =
  { kind: "valid"; game: ParsedGame } | { kind: "invalid"; message: string };

type ParseGameResult =
  { kind: "valid"; game: ImportedGame } | { kind: "invalid"; message: string };
```

`positions[0]` is always the initial position and has no move or change
report. Each later entry represents the position after one main-line move:

- `fen` is that move's normalized after-FEN;
- `move` is the same application-friendly metadata shape used for board
  moves;
- `moveNumber` comes from the move's before-FEN, so custom starting move
  numbers work; and
- `changes` is the deterministic Milestone 5 comparison between the before
  and after positions.

The move's colour is already present in `AppliedMove`, so the UI can render
`12. Nf3` or `12... Nf6` without inferring turn order from the array index.

`ParsedGame` is the chess.js boundary output. The coordinator adds each
position's deterministic `changes` to produce the final `ImportedGame`. The
model intentionally stores FEN snapshots rather than mutable chess objects. For
an ordinary personal game, even a few hundred short FEN strings and change
snapshots are negligible in browser memory and make navigation immediate and
deterministic.

## 6. PGN parsing and normalization

Add a boundary function such as:

```ts
parsePgn(pgn: string): ParsePgnResult
```

inside the existing `src/chess/position.ts` boundary.

The function should:

1. reject an empty or whitespace-only string with a concise PGN-specific error;
2. create one short-lived `Chess` instance;
3. call `loadPgn` in permissive mode;
4. read normalized headers with `getHeaders()`;
5. obtain the main-line moves with `history({ verbose: true })`;
6. create the initial entry from the first move's `before` FEN, or from the
   loaded game's starting position when there are no moves;
7. map every verbose move through the same internal adapter used by
   `attemptMove` to produce `AppliedMove`; and
8. return plain immutable headers, FENs, move numbers, and moves.

The parser should not silently use the standard initial position for a valid
custom-start game with no moves. If verbose history is empty, obtain the
starting position by loading the PGN into one instance, recording its final FEN,
and recognizing that final and initial are the same because no moves exist.
Implementation may use a second short-lived instance if that keeps this edge
case clearer.

Header normalization should copy only the six supported fields. Treat
`chess.js` placeholder values such as `?` and `????.??.??` as absent for
display, while preserving `*` as a valid unknown/unfinished result. Do not
expose the library's mutable header object.

Multiple concatenated PGN games are not supported. The installed parser rejects
trailing second-game content; surface that as an invalid PGN without trying to
split it heuristically.

## 7. Reusing move metadata and comparisons

Milestone 5 already adapts a completed `chess.js` move into `AppliedMove`.
Refactor that private conversion just enough to reuse it for verbose PGN
history. There must still be one implementation for:

- SAN;
- colour and piece names;
- promotions;
- ordinary captured squares;
- en-passant captured squares; and
- castling-rook movement.

Do not duplicate special-move inference in the PGN parser.

Add `src/chess/game.ts` as a small ordinary-TypeScript coordinator. Its
`parseGame(pgn): ParseGameResult` calls the `parsePgn` boundary and, for each
valid parsed ply, calls the existing deterministic comparison with:

```text
getPositionInsights(move.before)
getPositionInsights(move.after)
AppliedMove
          |
          v
comparePositionInsights()
```

This means navigating to a position shows the same “What changed?” semantics as
playing that move manually. Pinned attackers and defenders retain the exact
static behavior established in Milestone 4.

Precomputing these small synchronous comparisons during import is preferable to
rebuilding them on every click. This is not engine analysis and should complete
effectively immediately for a normal game.

This two-step boundary avoids a circular module dependency:
`positionChanges.ts` already imports position types and material conventions
from `position.ts`, so `position.ts` must not import the comparison module
back. `game.ts` may import both. This is a concrete separation, not a generic
game service or repository abstraction.

## 8. Authoritative workspace state

The current application has one authoritative FEN plus presentation state. Game
review introduces a genuine second source from which a current FEN may be
selected. Model that explicitly as a discriminated union rather than keeping a
loosely synchronized FEN, game, and ply index:

```ts
type StandaloneWorkspace = {
  kind: "position";
  fen: string;
  changes: PositionChanges | null;
};

type GameWorkspace = {
  kind: "game";
  game: ImportedGame;
  positionIndex: number;
};

type Workspace = StandaloneWorkspace | GameWorkspace;
```

Derive the values consumed by the existing application:

```ts
const positionFen =
  workspace.kind === "position"
    ? workspace.fen
    : workspace.game.positions[workspace.positionIndex].fen;

const positionChanges =
  workspace.kind === "position"
    ? workspace.changes
    : (workspace.game.positions[workspace.positionIndex].changes ?? null);
```

This union is now justified: it makes impossible states harder to represent.
There cannot be a “game mode” with no game or a current ply from one game paired
with the FEN from another. It is a local TypeScript model, not a state-management
library or generic state machine.

The FEN draft remains separate UI state so the user can type an invalid value
without changing the workspace. Navigation synchronizes the draft to the
selected valid position.

The PGN text area is also ordinary draft state. It may retain the pasted PGN
after game review ends, making it easy to load the game again, but it is not a
second parsed-game authority.

## 9. State transitions

### Loading a valid PGN

- Replace the workspace with the imported game at `positionIndex: 0`.
- Set the FEN draft to the game's initial FEN.
- Clear any FEN or PGN error, pending promotion, and selected insight highlight.
- Show no What changed? report at the initial position.
- Start the existing Stockfish analysis for the initial FEN.

### Invalid PGN

- Keep the entire existing workspace, selected ply, board, FEN, insights,
  latest-move report, and engine analysis target unchanged.
- Keep the user's PGN draft visible for correction.
- Show a concise accessible PGN error near the text area.

Do not display a raw JavaScript stack trace. A useful error can include the
library's parse message after a stable prefix such as `Invalid PGN:`.

### Navigating

- First selects position index 0.
- Previous selects `max(0, index - 1)`.
- Next selects `min(lastIndex, index + 1)`.
- Last selects the final position.
- Clicking a move selects the position immediately after that move.
- Controls at their boundary are disabled, not merely ignored.
- Every successful navigation updates the FEN draft and clears FEN errors,
  pending promotion, and selected board highlights.

Navigation to index 0 shows the instructional What changed? empty state.
Navigation to index N greater than zero shows the precomputed report for the
move that produced position N, regardless of whether the user arrived by moving
forward, backward, or jumping.

### Loading a FEN during game review

A valid FEN submission exits game review and creates a standalone workspace with
no latest-move report. The PGN draft may remain. An invalid FEN leaves game
review untouched.

### Moving a board piece during game review

The board remains interactive. A completed legal move branches into standalone
position analysis:

- apply the move to the currently selected game FEN;
- create the normal latest-move comparison;
- replace the workspace with the resulting standalone position; and
- hide game navigation while retaining the PGN draft for easy reloading.

The Game panel must state:

> Moving a piece or loading a FEN leaves game review.

An illegal move leaves game review unchanged. A pending promotion remains in
game review until the user chooses a piece; completion exits to standalone mode,
while cancellation stays at the selected game position.

This milestone does not retain or name a variation branch. That requires a
study-tree model.

## 10. React component responsibilities

### Ordinary TypeScript

- `src/chess/position.ts`
  - remains the sole `chess.js` boundary;
  - parses PGN into headers, FEN snapshots, move numbers, and
    application-friendly move metadata; and
  - shares the existing special-move adapter with manual moves.
- `src/chess/game.ts`
  - turns the parsed PGN result into the final `ImportedGame`;
  - precomputes insight snapshots and `PositionChanges`; and
  - contains no direct `chess.js`, React, DOM, or Stockfish code.

### `App.tsx`

- Own the `Workspace` union and derive the current FEN and change report.
- Own the PGN and FEN drafts plus their separate validation errors.
- Parse a submitted PGN through the ordinary game coordinator.
- Coordinate navigation and the explicit exits to standalone mode.
- Continue deriving current position insights and passing the selected FEN to
  Stockfish.
- Clear presentation state consistently when the selected valid position
  changes.

Ordinary `useState` remains sufficient. Do not introduce context, a reducer,
router, URL state, or global store.

### `GameReviewPanel.tsx`

- Render the labelled PGN text area, error, and Load game button.
- Show **Main line only** near the input.
- When the workspace contains a game, render supported headers, navigation
  status, controls, and the move list.
- Report requested position indices upward without changing chess state.
- Use real buttons with disabled boundary states.
- Mark the current move button with `aria-current="step"`.
- Include the explicit message about moves/FEN leaving game review.

The component performs grouping and display formatting only. It does not parse
PGN, calculate FENs, or call Stockfish.

### Existing components

- `PositionBoard` remains controlled by the derived current FEN.
- `PositionInsightsPanel`, `PositionChangesPanel`, and `AnalysisPanel`
  require no game-specific knowledge.
- `PromotionDialog` retains its existing two-step behavior.

## 11. UI behavior

Add a **Game review** card before the existing Position card in the side panel.
The input area contains:

- a `PGN` label;
- a multiline text area;
- a short **Main line only** note;
- an inline accessible error when needed; and
- a **Load game** button.

After a successful import, show a compact summary such as:

```text
Jane Player vs Alex Opponent
1-0 · 2026.08.14 · Club Championship · Round 3
```

Omit absent metadata rather than displaying rows of question marks. If both
players are absent, use **Unknown players**. Do not attempt to identify which
player is the application owner.

Navigation should show:

```text
Start position · 0 of 83 plies
[First] [Previous] [Next] [Last]
```

or:

```text
After 17... Nxe4 · 34 of 83 plies
```

Use “plies” in the counter because each White or Black move advances one
position. This is unfamiliar terminology, so the visible move label should do
most of the explanatory work.

The move list should group ordinary White/Black moves under their move number
where practical, while each SAN remains its own button. For a custom game that
begins with Black to move, render the first Black move with ellipsis notation.
The active move needs a subdued selected style and `aria-current`; do not use
alarm colours. At the start position no move is active.

The list may wrap naturally. Avoid a fixed-height scroll area in this milestone;
normal page scrolling is acceptable and simpler for keyboard and narrow-screen
use. Long games will make the side panel long, a known limitation to evaluate
before adding virtualized lists or sticky controls.

Game navigation appears only while the workspace is in game mode. The PGN input
remains available in standalone mode.

## 12. Stockfish lifecycle

No engine integration change is required. The selected position's derived FEN
continues flowing into `AnalysisPanel`.

When the user navigates rapidly:

1. each selected position changes the FEN;
2. the existing hook supersedes the previous request;
3. the engine client stops/serializes searches as already implemented; and
4. request ID plus FEN filtering prevents an older result from appearing under
   the newly selected move.

Do not pre-analyse neighboring positions, cache scores by FEN, retain engine
results in the imported game, or display a loading status for every move.

The board, move list, FEN, deterministic insights, and What changed? report must
remain usable if Stockfish fails.

## 13. Error and edge-case behavior

- **Empty PGN:** show a PGN-specific validation error and retain the workspace.
- **Malformed or illegal move text:** show the parser error with a stable
  `Invalid PGN:` prefix and retain the workspace.
- **Multiple concatenated games:** reject rather than importing an arbitrary
  first game.
- **Headers only / zero moves:** accept a valid game and show its initial
  position with all navigation controls disabled.
- **Missing headers:** use the normalized fallbacks described above.
- **Comments and NAGs:** accept but do not display.
- **Side variations:** follow only the main line and keep the visible Main line
  only notice.
- **Custom initial FEN:** use its side to move, castling rights, en-passant
  square, and fullmove number for all positions and labels.
- **Promotion, castling, and en passant:** retain correct SAN, positions, and
  What changed? metadata through the shared move adapter.
- **Game ending in checkmate or another result:** allow navigation through the
  final position; do not independently judge whether the Result header is
  correct.
- **Rapid navigation:** never show stale Stockfish output for another ply.
- **Board move from game review:** exit to standalone only after a completed
  legal move.
- **Reload:** imported game state is lost; persistence is not included.

## 14. Testing strategy

Automated tests should use short explicit PGNs and assert positions and visible
behavior rather than internal calls.

### Domain tests in `position.test.ts`

Add executable examples proving:

1. **Standard game** — headers, initial position, every after-FEN, SAN, move
   number, and position count are correct.
2. **Black move labels** — colours and fullmove numbers produce ellipsis
   notation without relying on array parity.
3. **Custom starting FEN** — `SetUp` / `FEN`, side to move, and non-one
   fullmove numbers are honored.
4. **Comments and NAGs** — accepted but absent from the move list data.
5. **Variation** — only main-line moves appear.
6. **Capture** — imported move metadata includes the correct captured piece and
   square.
7. **En passant** — uses the passed pawn's actual square.
8. **Castling** — includes rook movement.
9. **Promotion** — includes the selected type and SAN.
10. **Precomputed changes** — a known capture yields the same material and loose
    transitions as a manual move.
11. **Headers-only game** — produces exactly one position.
12. **Empty input** — returns a stable invalid result.
13. **Malformed move** — returns a useful PGN error.
14. **Multiple games** — rejected.
15. **Header normalization** — placeholders are omitted and supported values
    retained.

Existing move, FEN, insight, PV, and comparison tests must remain unchanged in
meaning.

### `GameReviewPanel.test.tsx`

Prove that:

- the PGN text area and Main line only note are labelled and visible;
- submitting calls the supplied load callback;
- an error is associated with the PGN field and announced accessibly;
- absent and present headers are phrased correctly;
- start/current/total position status is accurate;
- boundary navigation buttons are disabled correctly;
- previous, next, first, last, and move-button callbacks request the expected
  indices;
- White, Black, and custom-start move numbers are displayed correctly;
- the current move uses `aria-current="step"`; and
- the game-exit explanation is visible only during review.

### Application integration tests

Use the existing fake board and engine seams to prove:

- a valid PGN enters game review at its initial FEN;
- next/previous navigation updates board, FEN input, insights, What changed?,
  and analysis FEN together;
- clicking a move jumps to its after-position;
- first/last controls reach the correct boundaries;
- a second valid PGN replaces the first;
- invalid PGN preserves the current standalone or game workspace;
- a valid FEN exits game review and clears What changed?;
- invalid FEN during review keeps the selected game ply;
- a completed board move exits review and produces a standalone change report;
- an illegal move stays in review;
- promotion cancellation stays in review and completion exits;
- selected Milestone 4 highlights clear during navigation;
- rapid navigation leaves React displaying only the last selected FEN; and
- game review remains usable when the fake engine reports an error.

Do not run a real Stockfish search in PGN parser or navigation unit tests. The
existing real-engine smoke boundary remains sufficient because this milestone
only changes which valid FEN is selected.

## 15. Manual browser checks

1. Paste a short standard PGN and confirm headers, start position, and move
   count.
2. Navigate with all four controls and click several moves in the move list.
3. Confirm board, FEN, insights, What changed?, and Stockfish all follow the
   selected ply.
4. Navigate backward and confirm What changed? describes the move that produced
   the displayed position, not the direction of navigation.
5. Navigate rapidly and confirm stale engine evaluation/PV never appears for a
   different FEN.
6. Load a PGN containing comments, NAGs, and a side variation; confirm the
   visible list is the main line only.
7. Load a custom-FEN PGN that starts with Black to move and confirm numbering,
   board state, and move labels.
8. Test a game containing castling, capture, en passant, promotion, check, and
   checkmate where practical.
9. Submit malformed and multiple-game text; confirm the current game and ply
   remain visible.
10. While reviewing, submit a valid FEN and confirm review ends.
11. Reload the PGN, make a legal board move, and confirm review ends with a
    standalone What changed? report.
12. Start and cancel a promotion during review; confirm the game position
    remains. Complete it and confirm review ends.
13. Simulate engine failure and confirm navigation plus deterministic panels
    continue working.
14. Check keyboard navigation, disabled controls, focus visibility, current-move
    announcement, long move-list wrapping, and a narrow viewport.
15. Confirm no unexpected browser-console errors.
16. Repeat the core checks at the production URL after deployment.

## 16. Acceptance criteria

Milestone 6 is complete when:

- One pasted PGN can be loaded entirely in the browser with no new dependency.
- All direct `chess.js` use remains in `src/chess/position.ts`.
- The imported model contains the initial position and every main-line
  after-position as normalized FEN.
- Standard and custom-start games use correct SAN, colour, fullmove numbering,
  captures, en passant, castling, and promotion metadata.
- The workspace discriminated union is the sole authority for the displayed
  current position.
- First, previous, next, last, and clickable move navigation select the correct
  position and expose correct disabled/current states.
- Board, FEN, position insights, What changed?, and Stockfish all receive the
  same selected position.
- What changed? is empty at the initial position and otherwise describes the
  move that produced the selected position.
- A valid PGN replaces the workspace; invalid PGN leaves it unchanged.
- Valid FEN loading and completed board moves exit game review exactly as
  documented.
- Illegal moves and cancelled promotions do not exit review.
- Mainline-only behavior and the exit-to-standalone behavior are visible to the
  user.
- Missing headers, zero-move games, comments, NAGs, side variations, and
  malformed/multiple games behave as documented.
- Rapid navigation cannot display stale Stockfish output for another position.
- Game review remains usable when the engine fails.
- The move list and navigation controls are keyboard accessible and usable on a
  narrow screen.
- No whole-game engine analysis, move grading, persistence, or variation tree
  is introduced.
- Domain, component, and integration tests cover the specified positive,
  negative, and boundary cases.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build.
- Production smoke checks pass after deployment.
- `docs/architecture.md` and `docs/journal.md` describe the implemented
  result.

## 17. Explicit non-goals

- PGN file upload or drag-and-drop
- Multiple games in one import
- Side-variation display, editing, or navigation
- Comment or NAG display/editing
- PGN export
- Undo, redo, or a study/variation tree
- Preserving a branch made from an imported game
- Returning to a game without reloading its retained PGN draft
- Automatic whole-game Stockfish analysis
- Evaluation graph or per-move engine result storage
- Best-move comparison or move-quality labels
- Mistake, blunder, or missed-opportunity detection
- Opening-name or ECO lookup
- Player-owner identification
- Game library, search, persistence, or local storage
- URL sharing or deep links to a game/ply
- Tactical motif detection
- Natural-language or LLM commentary
- Accounts, analytics, backend, or cloud storage
- Virtualized move lists, sticky navigation, or long-game performance tuning

## Decisions requiring owner approval

1. Approve paste-only import for this milestone, with PGN file selection
   deferred.
2. Approve permissive `chess.js` parsing and visible mainline-only behavior,
   while comments, NAGs, and side variations are not displayed.
3. Approve the workspace union and the rule that valid FEN loading or a
   completed board move exits game review; the retained PGN draft can be loaded
   again.
4. Approve current-position Stockfish analysis only, with automatic whole-game
   analysis and evaluation graphs deferred.
