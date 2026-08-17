# Milestone 1 — Board and FEN

## Goal

Create the first useful chess interaction: display a standard chess position,
load a position from FEN, make legal moves by dragging pieces, and keep the FEN
and board synchronized.

This milestone establishes the boundary between React UI code and ordinary
chess-domain code. It does not add engine analysis or begin later product work.

## Scope

- Display a responsive chessboard in the normal starting position.
- Display the current full six-field FEN in an editable, labelled text input.
- Load a valid FEN by submitting the input.
- Reject invalid FEN without changing the current position.
- Accept legal drag-and-drop moves and update the FEN.
- Reject illegal moves without changing the position.
- Support promotion to queen, rook, bishop, or knight through an explicit choice.
- Keep chess rules and validation outside React components.
- Add focused domain tests, UI tests, and a short manual test checklist.

## Library recommendations

### Rules: `chess.js`

Use [`chess.js`](https://www.npmjs.com/package/chess.js), currently version
1.4.0. It is a headless TypeScript chess library for FEN handling, legal move
generation, move validation, and special rules such as castling, en passant,
and promotion. Its API is small enough to explain directly, it is widely used,
and its BSD-2-Clause licence is permissive. The current API validates FEN on
construction and throws on illegal moves, which gives us clear boundaries to
handle in our own code. The source and test suite are available in the
[`chess.js` repository](https://github.com/jhlywa/chess.js).

Writing chess rules ourselves would be inappropriate. Correct move legality
depends on check, pins, castling rights, en passant, promotion, and many boundary
conditions. Reimplementing those rules would create a large correctness burden
unrelated to this product's distinctive value.

The main alternative considered was
[`chessops`](https://www.npmjs.com/package/chessops), currently version 0.15.1.
It is actively maintained, written in TypeScript, and has excellent lower-level
position and variant support. It is not the recommendation for this milestone
because its result types, bitboard-oriented vocabulary, variant support, and
GPL-3.0-or-later licence add complexity or obligations we do not currently need.
It would be a stronger candidate if chess variants or low-level board analysis
became central requirements.

### Board: `react-chessboard`

Use [`react-chessboard`](https://www.npmjs.com/package/react-chessboard),
currently version 5.12.1. It is a maintained React component with TypeScript
types, React 19 peer support, an MIT licence, responsive sizing, mobile support,
drag-and-drop, accessibility features, a controlled `position` option, and an
`onPieceDrop` callback that can accept or reject a drop. Its responsibilities
stop at rendering and interaction; `chess.js` remains responsible for rules.
The implementation and documented feature set are in the
[`react-chessboard` repository](https://github.com/Clariity/react-chessboard).

Building a board ourselves would mean implementing pointer and touch dragging,
responsive sizing, coordinates, piece rendering, animation, and accessibility.
That is substantial UI infrastructure and not part of the product's core value.

Chessground is a capable lower-level board, but its established React wrappers
are not comparably active; for example,
[`react-chessground`](https://github.com/ruilisi/react-chessground) was last
updated in 2023 and uses a GPL licence. Direct Chessground integration would also
require us to maintain our own React lifecycle adapter. That control is not
needed in Milestone 1.

No other runtime dependency should be added.

## Authoritative position state

The authoritative representation of the current position is one normalized,
full FEN string held in React state as `positionFen`.

A long-lived mutable `Chess` instance should not be stored in React state.
Instead, each domain operation creates a short-lived `Chess` instance from
`positionFen`, validates or applies one operation, and returns a new normalized
FEN. This works well because Milestone 1 represents a position, not game history.
It also gives React an immutable string value, making updates and tests easy to
reason about.

FEN does not preserve a complete move history, including the history needed for
threefold-repetition claims. That is an accepted limitation here because undo,
game history, and draw claims are not in scope. The authoritative model can be
revisited when a concrete milestone requires history.

React state should contain only:

- `positionFen`: the valid, normalized FEN used by the board;
- `fenDraft`: the editable text currently shown in the FEN input;
- `fenError`: a user-facing validation message or `null`;
- `pendingPromotion`: the source and target squares awaiting a piece choice, or
  `null`.

The draft is deliberately separate from the position because a user must be
able to type an incomplete or invalid FEN without breaking the board. The
`Chess` object and the board component's internal drag state are not additional
sources of truth.

## State and data flow

### Initial load

1. The ordinary TypeScript position module exports the normalized standard
   starting FEN as `STARTING_FEN`; it is the only module that obtains this value
   from `chess.js`.
2. `App` initializes both `positionFen` and `fenDraft` with `STARTING_FEN`.
3. The board receives `positionFen` through its controlled `position` option.

### Loading FEN

1. The user edits `fenDraft`; this does not affect the board.
2. Submitting the form sends the trimmed draft to an ordinary TypeScript
   `parsePosition` function.
3. `parsePosition` constructs a `Chess` instance and returns either a normalized
   FEN or a validation error.
4. On success, `App` replaces both `positionFen` and `fenDraft` with the
   normalized FEN, clears any error and pending promotion, and the controlled
   board rerenders.
5. On failure, `App` preserves `positionFen` and the board, preserves the draft
   so it can be corrected, and displays the validation message.

For this milestone, "invalid FEN" means rejected by `chess.js`: malformed FEN
or violation of the core invariants it validates, such as missing kings or pawns
on the first or eighth rank. It does not mean proving that the position could
have arisen from a legal sequence of moves.

### Making a board move

1. `react-chessboard` reports the source and target squares to its drop handler.
2. `App` passes those squares and `positionFen` to an ordinary TypeScript
   `attemptMove` function.
3. `attemptMove` constructs a temporary `Chess` instance and compares the drop
   with the legal moves from the source square.
4. The function returns one of three explicit outcomes:
   - `moved`, containing the new normalized FEN;
   - `promotion-required`, containing the pending squares and legal promotion
     choices;
   - `illegal`.
5. A `moved` result updates both `positionFen` and `fenDraft`, clears any FEN
   error, and returns `true` to the board component.
6. An `illegal` result returns `false`; the visual piece returns to its original
   square and no application state changes.
7. A `promotion-required` result also returns `false`, leaving the authoritative
   board unchanged while the promotion chooser opens.

If the user has unsubmitted FEN text and then makes a legal board move, the move
becomes the new explicit action: `fenDraft` is replaced with the resulting FEN
and any previous draft error is cleared. This keeps the visible FEN synchronized
with the board.

Illegal drag attempts should not show an error banner. Trying a square is a
normal board interaction, and snapping the piece back is sufficient feedback.

## Promotion handling

Promotion must not silently default to a queen because underpromotion can be the
only correct move in positions the workbench will eventually analyse.

When a legal pawn drop reaches the back rank:

1. `attemptMove` detects that the matching legal moves differ by promotion
   piece and returns `promotion-required` without changing the FEN.
2. `App` stores the pending source and target squares.
3. A small modal promotion chooser offers Queen, Rook, Bishop, and Knight.
4. Choosing a piece retries the move with that promotion value. On success,
   `positionFen` and `fenDraft` update and the chooser closes.
5. Cancelling or pressing Escape closes the chooser and leaves the position
   unchanged.

Board dragging is disabled while the chooser is open. The chooser must have an
accessible name, keyboard-operable buttons, initial focus, and a clear cancel
action. Both white and black promotions use the same flow.

The domain function should still return an `illegal` outcome if completing a
pending promotion unexpectedly fails. The UI must never crash because a library
operation throws.

## Code responsibilities

The implementation should introduce only the following separation.

### React

- `src/App.tsx`
  - owns the four state values;
  - renders the page layout and labelled FEN form;
  - coordinates domain results with UI state;
  - passes the canonical FEN and event handlers to the board.
- `src/components/PositionBoard.tsx`
  - is a thin adapter around `react-chessboard`;
  - converts its drop event shape to the application's handler shape;
  - contains no chess rules or independent position state.
- `src/components/PromotionDialog.tsx`
  - renders the four promotion choices and cancel action;
  - contains no move validation.

The FEN form should remain in `App.tsx`; it is too small to justify another
component. No custom hook, context, reducer, or state-management library is
needed.

### Ordinary TypeScript

- `src/chess/position.ts`
  - exports the normalized standard starting FEN;
  - defines the small discriminated result types;
  - parses and normalizes FEN;
  - determines whether a move is legal or requires promotion;
  - applies the selected promotion;
  - catches `chess.js` exceptions at this boundary and returns explicit results.

This module must not import React or `react-chessboard`. It is the only
application module that may import `chess.js`; UI code should never call
`chess.js` directly.

## UI behaviour

- Use a simple two-part layout: board first, FEN form beneath or beside it when
  space permits.
- Keep the board in White orientation. An orientation control is not required.
- Label the text input `FEN` and use a `Load position` submit button.
- Pressing Enter in the input submits the form.
- Show FEN errors next to the input with `role="alert"` and associate the message
  with the input.
- Preserve invalid draft text so the user can correct it.
- After a valid FEN load or legal move, show the normalized full FEN.
- Keep the board usable at a viewport width of 320 CSS pixels without horizontal
  page scrolling.
- Do not add move lists, status panels, captured pieces, board themes, arrows,
  highlights, undo, reset, or decorative product chrome.

## Testing strategy

Tests should prove behaviour at the domain and user-interface boundaries. They
should not retest the internals of either dependency.

### Domain tests: `src/chess/position.test.ts`

1. **Accept and normalize a valid six-field FEN.** Proves that a supplied
   position can become canonical application state.
2. **Reject malformed FEN and return a useful error.** Proves bad input is
   contained at the domain boundary rather than becoming a render-time failure.
3. **Reject a structurally plausible FEN with a missing king.** Proves validation
   covers a meaningful chess-specific invariant, not only field counting.
4. **Apply `e2` to `e4` from the initial position.** Proves an ordinary legal
   move returns the expected new full FEN, including side to move and clocks.
5. **Reject `e2` to `e5`.** Proves an illegal move leaves the supplied position
   unchanged and returns the explicit illegal outcome.
6. **Apply kingside castling from
   `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1`.** Proves special king-and-rook
   movement and castling-right updates pass correctly through the boundary.
7. **Apply en passant from
   `4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1`.** Proves the captured pawn and
   en-passant field are updated correctly.
8. **Detect promotion from
   `4k3/P7/8/8/8/8/8/4K3 w - - 0 1`.** Proves the position is not mutated
   before the user chooses and all four promotion choices are offered.
9. **Complete queen promotion and knight underpromotion.** Proves the choice is
   respected rather than always producing a queen.
10. **Detect and complete a black promotion from
    `4k3/8/8/8/8/8/p7/4K3 b - - 0 1`.** Proves promotion is not accidentally
    hard-coded for White.

These are executable chess examples with clear expected outcomes. Additional
tests should be added only if implementation exposes a meaningful untested
boundary.

### React tests

1. **Initial render shows a board and the starting FEN.** Proves the UI is wired
   to canonical state.
2. **Submitting valid FEN updates the displayed position and normalized input.**
   Proves the FEN-to-state-to-board flow.
3. **Submitting invalid FEN shows an accessible error and retains the current
   board.** Proves draft and canonical state remain separate.
4. **A reported legal drop updates the FEN.** Proves board events reach the
   domain boundary and update React state.
5. **A reported illegal drop retains the FEN.** Proves rejected gestures cannot
   corrupt UI state.
6. **A promotion drop opens the chooser; selecting Knight updates the FEN.**
   Proves the two-step promotion flow end to end.
7. **Cancelling promotion leaves the position unchanged.** Proves cancellation
   is safe.

Pointer-based drag simulation from a third-party board is brittle in jsdom. UI
tests may replace the board package with a minimal test double that exposes its
drop callback, while domain tests prove legality. The real board interaction is
covered by manual browser testing; we should not test `react-chessboard` itself.

### Manual browser checks

- Load the starting position and a non-starting valid FEN.
- Correct an invalid FEN after seeing the error.
- Make an ordinary move and an illegal move.
- Castle on both sides where legal.
- Make an en-passant capture.
- Promote White and Black pawns, including an underpromotion.
- Cancel a promotion with the button and Escape.
- Drag with mouse and touch input where available.
- Check keyboard operation of the FEN form and promotion chooser.
- Check the layout at desktop width and at 320 CSS pixels.

## Acceptance criteria

Milestone 1 is complete when:

1. Only `chess.js` and `react-chessboard` have been added as runtime
   dependencies.
2. The application opens on the standard starting position with a matching full
   FEN.
3. A valid six-field FEN loads and the board matches it.
4. Invalid FEN produces an accessible, useful error while the last valid board
   remains unchanged.
5. Legal drag-and-drop moves update both the board and normalized full FEN.
6. Illegal moves are rejected and leave position state unchanged.
7. Castling and en passant work in known legal positions.
8. Promotion pauses for an explicit Queen, Rook, Bishop, or Knight choice for
   either colour; underpromotion works and cancellation changes nothing.
9. The canonical position is a FEN string; neither the board widget nor a mutable
   `Chess` object becomes a second source of truth.
10. Chess validation and move application are ordinary TypeScript independent
    of React.
11. The layout remains usable without horizontal page scrolling at 320 CSS
    pixels.
12. The proposed automated tests pass.
13. `./scripts/verify.sh` passes, including formatting, linting, tests, type
    checking, and the production build.
14. `docs/architecture.md` and the project journal are updated to describe the
    implementation that actually exists.

## Explicit non-goals

- Stockfish, Web Workers, or WebAssembly;
- evaluation scores, principal variations, or best-move suggestions;
- tactical, positional, or material observations;
- move history, move list, undo, redo, or variations;
- PGN import or export;
- game-over messaging, clocks, player names, or captured-piece displays;
- click-to-move, legal-move highlights, arrows, annotations, or board flipping;
- saving positions, browser storage, accounts, backend services, or analytics;
- Tailwind or another styling framework;
- global state management, custom hooks, context, reducers, services, factories,
  repositories, or an engine abstraction;
- deployment changes.

Milestone 1 ends with a trustworthy interactive position editor and nothing
from the later engine-analysis milestones.
