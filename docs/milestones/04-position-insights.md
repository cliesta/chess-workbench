# Milestone 4 — Position insights

## 1. Goal

Add the first deterministic, human-oriented description of the current
position:

> Show whose turn it is, whether that side is in check, the material balance,
> and pieces that are attacked and undefended.

This begins Phase 2 of the product roadmap: moving from an engine frontend to a
workbench that directs the player's attention. The output must describe facts
that the application can support, not claim that a static rule has solved the
position tactically.

## 2. Scope

- Derive position insights synchronously from the canonical valid FEN.
- Show the side to move and whether it is currently in check.
- Count each side's current queens, rooks, bishops, knights, and pawns.
- Show conventional material totals and a White-relative material balance.
- Find non-king pieces of either colour whose square is attacked by at least one
  opposing piece and by no friendly piece.
- Call those findings **attacked and undefended**, with “loose piece” used only
  as a short UI label after it is clearly defined.
- Name each loose piece, its square, and the opposing pieces attacking it.
- Let the user select one finding to highlight its square and attacker squares
  on the existing board.
- Update insights immediately after a legal board move or valid FEN submission.
- Keep insights usable when Stockfish is loading or has failed.
- Add deterministic domain and UI tests based on known positions.
- Update the architecture and journal when implementation is complete.

No new npm package is needed.

## 3. Terminology and semantic boundary

### “Attacked and undefended,” not “hanging”

For this milestone, a non-king piece is reported when:

1. one or more opposing pieces attack its square; and
2. no friendly piece attacks its square.

This is a useful warning signal, but it is not proof that the piece can be won.
The attacker may be pinned, the target may have a tactical resource, a recapture
may be undesirable, or the piece may be deliberately offered. Conversely, a
defended piece can still be lost because its defender is pinned, overloaded, or
less valuable than the attacker.

The UI must therefore include a short explanation such as:

> A loose piece is attacked and has no friendly piece attacking its square.
> This is a warning, not proof that the piece can be won.

It must not use stronger labels such as “blunder,” “free piece,” “winning,” or
“tactical mistake.” Those require move-sequence analysis beyond this rule.

### Attack-map semantics

Reuse the installed `chess.js` attack map. Its `attackers(square, color)` API
returns the attacking piece squares and explicitly counts a piece even when it
is pinned. It can also report attacks on a square occupied by a friendly piece.
Those semantics are documented in the current
[`chess.js` API](https://github.com/jhlywa/chess.js/blob/v1.4.0/README.md#attackerssquare--color-)
and are appropriate for a transparent static warning, provided the limitation
above is visible and tested.

Kings are excluded from the loose-piece list. An attacked king is represented
by the separate in-check status, where `chess.js` applies the proper position
rules. Both White and Black non-king pieces are inspected regardless of whose
turn it is.

## 4. Existing libraries

### `chess.js`

Keep the pinned `chess.js` dependency. It already provides:

- `board()` for occupied squares and piece identities;
- `turn()` for the side to move;
- `inCheck()` for current check status; and
- `attackers(square, color)` for opposing attackers and friendly defenders.

Writing our own move geometry or attack map would duplicate subtle chess rules
without improving the product. Stockfish should not be used for these facts: it
is asynchronous, can fail independently, and does not provide a simple typed
material/attack-map result through UCI.

All direct `chess.js` use must remain in `src/chess/position.ts`, preserving the
boundary explicitly established in Milestone 1. Adding this focused function to
that file is simpler than introducing a position-snapshot abstraction solely to
support one feature. If later milestones add several independent feature
detectors, reorganizing the chess-domain directory can be considered then.

### `react-chessboard`

Keep the installed board component. Its current options include a
`squareStyles` map for per-square CSS, so the selected target and attacker
squares can be highlighted without changing the board library. The upstream
project documents custom styling as a supported feature in the
[`react-chessboard` repository](https://github.com/Clariity/react-chessboard).

No arrows or drawing interaction are needed. The board remains controlled by
the canonical FEN exactly as it is now.

## 5. Position-insight model

Use a small domain result with application-friendly names rather than exposing
`chess.js`'s one-letter piece and colour codes to React. The exact syntax may be
adjusted during implementation, but the semantic shape should be:

```ts
type InsightColor = "white" | "black";

type InsightPieceType =
  "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

type InsightPiece = {
  color: InsightColor;
  type: InsightPieceType;
  square: string;
};

type MaterialCounts = Record<Exclude<InsightPieceType, "king">, number>;

type PositionInsights = {
  sideToMove: InsightColor;
  inCheck: boolean;
  material: {
    white: MaterialCounts;
    black: MaterialCounts;
    whitePoints: number;
    blackPoints: number;
    whiteMinusBlack: number;
  };
  attackedAndUndefended: Array<{
    piece: InsightPiece;
    attackers: InsightPiece[];
  }>;
};
```

`getPositionInsights(fen)` in `src/chess/position.ts` creates one short-lived
`Chess` object, traverses its board, and returns this immutable plain data. React
never receives the mutable object and never calls `chess.js`.

The function may assume a valid FEN because its only application input is the
canonical `positionFen`. The existing FEN parser remains responsible for
preventing invalid drafts from becoming canonical. An extra invalid-FEN result
union would duplicate that boundary without a real caller.

## 6. Material model

Use the familiar teaching values:

| Piece  |   Points |
| ------ | -------: |
| Pawn   |        1 |
| Knight |        3 |
| Bishop |        3 |
| Rook   |        5 |
| Queen  |        9 |
| King   | Excluded |

These values are an explanatory convention, not an engine evaluation. The UI
should show both sides' actual counts so unusual but legal positions containing
promoted pieces are represented honestly. It must not infer “captured pieces”
by assuming the position began with the standard armies.

Display examples:

```text
Material: Equal (39–39)
White: Queen 1 · Rooks 2 · Bishops 2 · Knights 2 · Pawns 8
Black: Queen 1 · Rooks 2 · Bishops 2 · Knights 2 · Pawns 8
```

```text
Material: White +3 (24–21)
```

`whiteMinusBlack` follows the same stable perspective convention as engine
evaluation: positive means White has more conventional material, negative means
Black has more, regardless of the side to move. The UI should display “White
+N,” “Black +N,” or “Equal” rather than exposing a signed implementation value.

Material totals do not account for piece activity, pawn structure, king safety,
the bishop pair, or tactical circumstances. The panel should label the section
“Material,” not “Evaluation.”

## 7. Loose-piece detection

For each occupied non-king square:

1. map the piece's colour to the opposing colour;
2. ask `chess.attackers(square, opposingColor)` for attackers;
3. ask `chess.attackers(square, pieceColor)` for friendly defenders;
4. include the finding only when there is at least one attacker and zero
   defenders; and
5. map the target and attacker squares back to complete `InsightPiece` values.

Pawns are included. Kings are not. Empty squares are irrelevant even though the
attack API can query them.

Return findings in deterministic order so the UI and executable examples are
stable: White pieces first, then Black pieces, with squares in file/rank order
within each colour. Attacker lists should also use a stable square order. This
ordering is presentation support, not chess significance.

Pinned pieces deliberately retain the library's documented attack-map
semantics. For example, a target “defended” only by a pinned rook is not listed,
and a target attacked only by a pinned knight can be listed. Tests must preserve
this boundary so a later implementation change cannot silently make the UI
claim different semantics.

No Stockfish score, PV, exchange calculation, static-exchange evaluation, or
legal capture search participates in this rule.

## 8. State and data flow

```text
valid FEN submission or legal board move
                  |
                  v
       App updates positionFen
          /                 \
         v                   v
getPositionInsights()   existing engine analysis
         |                   |
         v                   v
PositionInsightsPanel   AnalysisPanel
         |
  selected finding
         v
PositionBoard square styles
```

`positionFen` remains the sole authoritative position. Insights are synchronous
derived data and must not be stored as another position-related state value.
Computing them with `useMemo` keyed by `positionFen` is reasonable because FEN
draft keystrokes rerender `App` without changing the canonical position, but it
is an optimization of derived data rather than a cache with its own lifecycle.

The only new React state is the selected loose-piece square. It exists solely
for presentation and is cleared whenever `commitPosition` accepts a new FEN.
The selected finding determines one target square and its attacker squares for
the board adapter.

Consequences:

- typing an invalid or unsubmitted FEN does not change the insights;
- a successfully loaded FEN or legal move updates them immediately;
- promotion updates material and loose-piece findings only after the chosen
  promotion becomes the canonical position;
- Stockfish can continue analysing asynchronously without delaying insights;
  and
- an engine error cannot remove or corrupt the deterministic panel.

## 9. Code responsibilities

### Ordinary TypeScript

- `src/chess/position.ts`
  - defines the insight result types;
  - maps `chess.js` piece/colour codes to application names;
  - computes side-to-move, check, material, attackers, and defenders; and
  - remains the only application module importing `chess.js`.
- `src/chess/position.test.ts`
  - contains executable position examples for the domain rules.

This logic must not depend on React, the board component, DOM APIs, or
Stockfish.

### React

- `src/components/PositionInsightsPanel.tsx`
  - renders turn/check status, material counts/balance, the explanatory caveat,
    and the loose-piece list;
  - exposes each finding as a real button with a useful accessible label;
  - identifies the selected item with `aria-pressed`; and
  - reports selection changes upward without doing chess calculations.
- `src/components/PositionBoard.tsx`
  - accepts the selected target and attacker squares as presentation props; and
  - converts them to `react-chessboard` `squareStyles`.
- `src/App.tsx`
  - derives insights from `positionFen`;
  - owns the selected-finding UI state because the panel and board are siblings;
  - clears selection on every committed position; and
  - places the new panel between the Position editor and Analysis panel.
- `src/index.css`
  - styles the compact panel, buttons, and highlights within the existing dark
    visual system.

No context, reducer, global store, feature framework, or generic detector
interface is needed.

## 10. UI behaviour

The existing two-column workbench remains. The side panel order becomes:

1. Position
2. Position insights
3. Analysis

The new panel displays:

- `White to move` or `Black to move`;
- a visible `In check` status only when true, otherwise a subdued `Not in
check`;
- the material balance and both sides' counts; and
- an “Attacked and undefended” list or a clear empty state.

A finding should read like:

> White bishop on b5 — attacked by Black pawn on a6 and Black knight on c7.

Selecting its button highlights the target square with the stronger warning
style and the attacker squares with a distinct supporting style. Selecting it
again clears the highlight; selecting another replaces it. The textual names
and `aria-pressed` state ensure colour is not the only way the information is
conveyed.

Highlights are explanatory only. They must not interfere with dragging,
promotion, legal-move handling, the board's controlled FEN, or its existing
notation. Do not add arrows, animations, hover-only behavior, or automatic
camera/orientation changes.

On a narrow screen, the panel follows the existing vertical side-panel flow.
Long lists wrap normally; no fixed-height scrolling region is needed for this
milestone.

## 11. Error handling

The panel has no loading state because its calculation is local and
synchronous. It has no independent error state because only canonical valid FEN
reaches it.

If an invalid FEN draft is submitted, the existing FEN error remains visible and
the prior position's insights stay on screen. If Stockfish fails, the insights
panel continues to work. If a future programming error violates the valid-FEN
invariant, the application should fail through the normal development error
path rather than silently inventing empty insights.

An empty loose-piece list is a successful result, not an error.

## 12. Testing strategy

### Domain tests in `position.test.ts`

Use explicit FEN examples and assert semantic results rather than internal
method calls:

1. **Starting position** — White to move, not in check, both sides have the
   standard counts and 39 points, the balance is zero, and no loose pieces are
   reported.
2. **Black to move** — verifies side-to-move is read from FEN rather than assumed
   from the board arrangement.
3. **Side in check** — reports `inCheck: true`; the king is not also emitted as
   a loose piece.
4. **White material advantage** — a known position gives the exact positive
   White-relative point difference and piece counts.
5. **Black material advantage** — makes a sign inversion difficult to
   introduce.
6. **Promoted material** — a position with two queens for one colour counts both
   instead of assuming standard starting inventory.
7. **Attacked and undefended target** — an isolated target is listed with the
   correct colour, type, square, and one or more attacker identities.
8. **Defended target** — adding a friendly attacker of the target square removes
   that target from the list.
9. **Pawn target** — confirms pawns are included.
10. **Both colours** — one position can report a White and a Black loose piece;
    detection is not limited to the side to move.
11. **Pinned attacker** — a target attacked only by a pinned piece is still
    reported, locking the documented static attack-map semantics.
12. **Pinned defender** — a target defended only by a pinned piece is not
    reported, locking the same boundary from the other direction.
13. **Deterministic ordering** — multiple findings and attackers use the
    documented stable order.

The tests should normally select findings by square when proving chess facts;
only the dedicated ordering example should assert entire-array order.

### Component tests

`PositionInsightsPanel.test.tsx` should prove that:

- equal and unequal material are phrased correctly;
- turn and check are visible;
- the empty state is clear;
- a loose-piece sentence includes target and attackers in human-readable form;
- selecting and clearing a finding calls the presentation callback and updates
  `aria-pressed`; and
- the explanatory warning language is present.

`PositionBoard.test.tsx` should include one narrow adapter test showing that
target and attacker props become distinct visible square styles without
changing move behavior.

`App.test.tsx` should prove the integration outcomes:

- submitting a valid FEN updates the insight text;
- submitting an invalid draft leaves the previous insights intact;
- a legal move recomputes insights;
- a position change clears an existing highlight; and
- insights still render when the fake engine initialization fails.

Do not run Stockfish searches to test deterministic insights. Existing fake
engine seams remain sufficient for React integration tests.

## 13. Manual browser checks

1. Load the starting position and confirm equal 39–39 material, White to move,
   not in check, and no loose pieces.
2. Load a known check position and confirm the status changes without listing
   the king as loose.
3. Load a position with an attacked and undefended piece; confirm the text names
   the target and attackers.
4. Select the finding and confirm target/attacker highlights are distinct,
   readable on both light and dark squares, and do not prevent a legal drag.
5. Select it again and confirm the highlights clear.
6. Make a legal move that changes the finding; confirm the text and highlights
   update immediately while Stockfish begins its new search.
7. Submit an invalid FEN and confirm the old board and insights remain.
8. Complete a promotion and confirm the selected piece is reflected in material
   counts.
9. Force or simulate the existing engine error and confirm insights remain
   usable.
10. Check keyboard selection, visible focus, `aria-pressed`, and a narrow-screen
    layout.
11. Repeat the core checks at the production URL after deployment and confirm no
    unexpected console errors.

## 14. Acceptance criteria

Milestone 4 is complete when:

- `positionFen` remains the sole authoritative position.
- All direct `chess.js` use remains in `src/chess/position.ts`.
- No new npm dependency is added.
- The panel correctly displays side to move and check status for the canonical
  FEN.
- Material counts and conventional totals are correct for ordinary and promoted
  positions.
- Material advantage is presented with a stable White-relative internal
  convention and clear White/Black wording.
- Non-king pieces attacked by an opponent and by no friendly piece are reported
  for both colours with their attacker identities.
- The UI explicitly says this static warning is not proof that a piece can be
  won.
- Pinned-attacker and pinned-defender behavior matches the documented
  `chess.js` attack-map semantics and is protected by tests.
- Selecting a finding highlights its target and attacker squares without
  affecting board interaction.
- Insights update after a legal move, valid FEN load, and promotion; an invalid
  draft leaves them unchanged.
- Insights remain usable if Stockfish is loading or has failed.
- The panel and selection controls are keyboard-accessible and usable on a
  narrow screen.
- Domain, component, and integration tests cover the specified positive,
  negative, and boundary cases.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build.
- The production smoke checks pass after deployment.
- `docs/architecture.md` and `docs/journal.md` describe the implemented result.

## 15. Explicit non-goals

- Claiming that a loose piece is tactically lost
- Static-exchange evaluation or capture-sequence calculation
- Pins, skewers, forks, discovered attacks, overloaded defenders, or other
  tactical motif detection
- Pawn-structure or king-safety evaluation
- Positional scoring
- Comparing the insight rules with Stockfish's evaluation or PV
- “What changed after the move?” comparisons
- Move quality labels such as best, inaccuracy, mistake, or blunder
- Evaluation bar
- MultiPV or candidate-move comparison
- PV exploration
- PGN/game import or move history
- Natural-language or LLM commentary
- Persistence, accounts, analytics, or backend services
- User-configurable piece values or detection rules
- A generic detector/plugin framework

## Decisions requiring owner approval

1. Approve the deliberately factual term “attacked and undefended,” with “loose
   piece” as its defined short label, instead of calling these pieces hanging.
2. Approve conventional 1/3/3/5/9 material values as a displayed teaching aid,
   explicitly separate from engine evaluation.
3. Approve the documented `chess.js` static attack-map semantics, including
   pinned pieces counting as attackers and defenders, for this first insight
   rule.
