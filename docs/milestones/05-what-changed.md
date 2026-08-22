# Milestone 5 — What changed after the move?

## 1. Goal

Add a small, factual explanation of the immediate consequences of the latest
legal board move:

> Show the move in SAN and identify tracked material, check, and
> attacked-and-undefended status changes between the position before the move
> and the position after it.

This milestone should help the player notice consequences without pretending
to judge the move. It builds on Milestone 4's deterministic position facts; it
does not introduce tactical motif detection or engine-based move grading.

## 2. Scope

- Record the latest successfully completed board move in human-readable SAN.
- Compare the valid position immediately before that move with the valid
  position immediately after it.
- Report conventional material-count and material-balance changes.
- Report when a colour has entered or left check.
- Report non-king pieces that became attacked and undefended.
- Report surviving non-king pieces that stopped being attacked and undefended.
- Replace the comparison after each subsequent legal board move.
- Clear the comparison when the user loads a valid FEN directly.
- Keep an invalid FEN submission, illegal move, or cancelled promotion from
  altering the last completed comparison.
- Keep the feature independent of Stockfish loading and failure.
- Add deterministic domain and React tests based on known moves and positions.
- Update architecture and the project journal after implementation.

No new npm package is needed.

## 3. Meaning and limitations

### A transition report, not a move verdict

“What changed?” describes transitions in facts already supported by the
application. It may say:

```text
After Bxh7+
Black is now in check.
Black's pawn count changed from 7 to 6 (−1 point).
White's bishop on h7 became attacked and undefended.
```

It must not turn those facts into claims such as:

- “Bxh7+ was a sacrifice”;
- “White blundered a bishop”;
- “the bishop is trapped”;
- “White won a pawn”; or
- “this was the best move.”

Those statements require intent, a move sequence, tactical search, or engine
comparison. In particular, a piece becoming attacked and undefended retains
Milestone 4's explicit caveat: it is an attention signal, not proof that the
piece can be won.

### What counts as a change

The comparison covers only these categories:

1. actual piece-count and conventional material-point changes;
2. a colour entering or leaving check; and
3. a surviving piece entering or leaving Milestone 4's
   attacked-and-undefended set.

Changing the attackers of a piece while it remains attacked and undefended is
not a separate change in this milestone. Nor is changing the defender or
attacker count of a piece that never crosses the rule's boundary. This keeps the
result compact and gives “became” and “stopped being” precise meanings.

The existing attack-map semantics remain unchanged. Pinned pieces count as
attackers and defenders exactly as they do in Milestone 4. The comparison must
not add a legal-capture search, static-exchange evaluation, or Stockfish query
to reinterpret those results.

## 4. Which position changes produce a report

### Completed board moves

A successful move on the interactive board creates or replaces the report. A
promotion creates the report only after the user chooses the promotion piece
and that completed move becomes canonical. Castling and en passant are ordinary
completed moves for this purpose.

### Direct FEN loading

A successfully loaded FEN clears the report and returns the panel to an
instructional empty state:

> Make a move on the board to see what changed.

Although the application knows the old and new FEN strings, it does not know
that the new FEN is the result of one move from the old one. Comparing arbitrary
pasted positions would imply a history the user did not provide.

Typing a draft does nothing until submission. An invalid submission keeps the
old canonical position and therefore also keeps its last completed move report.

### Unsuccessful interactions

- An illegal drop does not create, clear, or replace the report.
- Opening the promotion chooser does not create a report.
- Cancelling promotion does not create, clear, or replace the report.
- Reloading the page returns to the starting position with no move report.

This is one-step history only. The milestone does not add undo, redo, a move
list, or navigation through earlier comparisons.

## 5. Move result boundary

`attemptMove()` already owns legal move application behind the sole direct
`chess.js` boundary. Extend its successful result with application-friendly
metadata derived from the actual `chess.js` move result. React must not infer
SAN, captures, castling, or en passant from square coordinates.

The semantic shape should be approximately:

```ts
type AppliedMove = {
  color: InsightColor;
  piece: InsightPieceType;
  from: string;
  to: string;
  san: string;
  promotion?: InsightPieceType;
  captured?: InsightPiece;
  castlingRook?: {
    from: string;
    to: string;
  };
};

type MoveAttempt =
  | { kind: "moved"; fen: string; move: AppliedMove }
  | { kind: "promotion-required" /* existing fields */ }
  | { kind: "illegal" };
```

The exact syntax may be refined during implementation, but these facts have
concrete uses now:

- `san` provides correct capture, castling, check, mate, and promotion notation;
- `from` and `to` let the comparison follow the moved piece across squares;
- `promotion` lets it follow the same pawn after its type changes;
- the captured piece and its actual square prevent a disappeared piece from
  being described as “no longer loose”; and
- the rook movement identifies the second moved piece during castling.

For an ordinary capture the captured square is the destination. For en passant
it is the passed pawn's square, not the destination. `position.ts` should derive
that while the pre-move `Chess` object still contains the captured pawn.

`AppliedMove` is plain application data. It must not expose a mutable `Chess`
object, one-letter colour codes, numeric bit flags, or the library's verbose
move class to React.

## 6. Position-change model

Use a small result that the UI can render without chess calculations. A
reasonable semantic shape is:

```ts
type MaterialCountChange = {
  color: InsightColor;
  type: Exclude<InsightPieceType, "king">;
  before: number;
  after: number;
  pointDelta: number;
};

type LoosePieceStatusChange = {
  piece: InsightPiece;
  previousSquare?: string;
  attackers?: InsightPiece[];
};

type PositionChanges = {
  move: AppliedMove;
  material: {
    countChanges: MaterialCountChange[];
    whitePointsBefore: number;
    whitePointsAfter: number;
    blackPointsBefore: number;
    blackPointsAfter: number;
    whiteMinusBlackBefore: number;
    whiteMinusBlackAfter: number;
  };
  check: {
    entered: InsightColor[];
    left: InsightColor[];
  };
  becameAttackedAndUndefended: LoosePieceStatusChange[];
  stoppedBeingAttackedAndUndefended: LoosePieceStatusChange[];
};
```

`attackers` is needed for a newly loose piece so its sentence can remain as
specific as the current Position insights panel. It is unnecessary for a piece
that stopped being loose. `previousSquare` is present when the moved piece (or
castling rook) crossed the loose-piece boundary while changing squares.

The model should contain facts, not final English strings. Human phrasing stays
in the React component, where it can be tested as user-visible behaviour.

## 7. Comparison algorithm and piece identity

Add a pure ordinary-TypeScript function, for example:

```ts
comparePositionInsights(before, after, move): PositionChanges
```

It receives two already-derived `PositionInsights` snapshots plus the completed
`AppliedMove`. It must not import React, Stockfish, or `chess.js`.

### Material

For White and Black, compare every queen, rook, bishop, knight, and pawn count.
Return only non-zero count changes in deterministic order: White before Black,
then queen, rook, bishop, knight, pawn. Compute the point totals and
White-relative balances using the values already established in Milestone 4;
do not create a second set of piece values.

Promote the existing material-value table in `position.ts` to an exported
read-only application constant so both snapshot calculation and comparison use
one definition. This is shared domain data, not a new abstraction.

This faithfully represents captures and promotions without guessing what was
“won.” For example, promotion to a queen produces a White pawn change of −1, a
White queen change of +1, and a net White material-total change of +8.

### Check

`inCheck` applies to the side to move in each snapshot. Therefore:

- if `before.inCheck` is true, `before.sideToMove` left check through the legal
  move; and
- if `after.inCheck` is true, `after.sideToMove` entered check.

Both transitions can occur on one move: a player may answer check by giving
check. Store colours explicitly rather than comparing two booleans, which would
miss that case.

### Attacked-and-undefended status

Most pieces retain identity by colour, type, and square. The completed move
provides the limited identity mapping needed for exceptions:

- map the moving piece from `from` to `to`;
- change its type to the promotion type when applicable;
- map the rook's square during castling; and
- remove the captured piece at its actual captured square before comparison.

After applying those mappings to the **before** findings:

- an after finding with no mapped before match **became attacked and
  undefended**;
- a mapped before finding with no after match **stopped being attacked and
  undefended**; and
- a match in both sets did not cross the tracked boundary, even if its attacker
  list changed.

Never report a captured piece as having stopped being attacked and undefended:
it no longer exists in the new position. Its disappearance is represented by
the material count change and move SAN. This distinction is a primary reason to
include capture metadata instead of performing a naive set difference.

Return both loose-piece transition lists in Milestone 4's deterministic order:
White then Black, then square. Preserve stable attacker ordering.

## 8. State and data flow

```text
board drop
   |
   v
attemptMove(current FEN)
   |
   +-- illegal / promotion pending --> no report change
   |
   +-- completed move
           |
           +--> next canonical FEN
           +--> AppliedMove metadata
                    |
                    v
      getPositionInsights(before FEN)
      getPositionInsights(after FEN)
                    |
                    v
         comparePositionInsights()
                    |
          +---------+---------+
          v                   v
   update positionFen   store latest report
```

`positionFen` remains the sole authoritative current position. The latest
`PositionChanges` value is historical presentation state: unlike current
position insights, it cannot be reconstructed from the current FEN alone. It is
therefore appropriate ordinary React state, not a second source of current
position truth.

`App` already has the before insight snapshot. On a completed move it can derive
the after snapshot synchronously, create the report, and commit both the new FEN
and report in the same event. React will derive the current insights from the
new canonical FEN on render as before. This repeats one very small synchronous
calculation rather than storing both current and previous FENs or building a
history system.

The position commit path must distinguish:

- a completed move, which stores a new report; and
- a valid direct FEN load, which stores `null`.

Both continue to clear selected Milestone 4 board highlights. FEN draft edits,
invalid submissions, illegal drops, and cancelled promotions change neither the
canonical position nor the report.

## 9. Code responsibilities

### Chess boundary: `src/chess/position.ts`

- Continue to be the only application module importing `chess.js`.
- Return typed `AppliedMove` metadata with a successful move.
- Derive correct SAN, promotion, captured-square, and castling-rook facts.
- Export the existing conventional material-value table for the pure comparison
  module rather than duplicating it.
- Keep existing validation, legal-move, insight, and PV behaviour unchanged.

The file is now a position/chess-library boundary, not merely one function, so
retaining these closely related adaptations there is still understandable.

### Pure comparison: `src/chess/positionChanges.ts`

- Define `PositionChanges` and its focused supporting types.
- Compare two `PositionInsights` values and one `AppliedMove`.
- Contain no React, DOM, engine, Worker, or direct `chess.js` code.
- Return deterministic plain data.

A new file is justified because comparison is independently testable logic and
is not itself a `chess.js` adapter. Do not introduce a detector interface,
generic event framework, history model, class hierarchy, or state machine.

### React

- `App.tsx`
  - owns `lastPositionChanges: PositionChanges | null`;
  - creates it only after a completed board move or promotion;
  - clears it after a valid direct FEN load; and
  - passes it to the panel.
- `PositionChangesPanel.tsx`
  - renders the empty instruction, SAN, and factual change sentences;
  - performs wording and pluralization only; and
  - contains no chess or engine calculations.
- `index.css`
  - styles the panel within the existing dark system.

No context, reducer, global store, routing, or external state library is needed.

## 10. UI behaviour and wording

Place a new compact panel between **Position insights** and **Analysis**. Its
heading is **What changed?**

Before any board move, and after a valid FEN load, show:

```text
Make a move on the board to see what changed.
```

After a move, show its SAN prominently but without grading:

```text
After Nf3
```

Then show only relevant tracked changes. Suggested wording:

```text
Black is now in check.
White is no longer in check.
Black's pawn count changed from 7 to 6 (−1 point).
Material balance changed from Equal to White +1.
White bishop on h7 became attacked and undefended — attacked by Black king on g8.
Black knight on c6 is no longer attacked and undefended.
```

When count changes cancel within one colour during promotion, list each piece
count and the net point change rather than describing a capture. Show the
material-balance sentence only when the White-relative balance actually
changes.

If none of the tracked categories changed, show:

```text
No tracked material, check, or loose-piece status changed.
```

This empty result is useful: it says the comparison ran but does not imply that
the move had no chess consequences.

Keep the presentation calm and explanatory. Do not use red alert styling,
evaluation colours, punctuation such as warning icons, or labels such as
“danger.” The panel does not add board highlights in this milestone; the
current-position panel remains the single place for selecting a loose piece and
exploring its squares.

The panel should be a labelled region and readable on a narrow screen. It has
no interactive control, loading state, animation, or fixed-height scrolling
area.

## 11. Stockfish independence

Do not compare engine evaluations in this milestone.

The engine result for the before position may never arrive, may be superseded,
or may have reached a different depth than the result for the after position.
A numerical delta between such searches would be timing-dependent and could be
misleading. Correct engine-based move comparison needs an explicit analysis
workflow with comparable search limits and retained results.

The deterministic report appears immediately when the legal move is committed,
while Stockfish independently starts analysing the new canonical FEN. An engine
loading or error state must not delay, clear, or damage the report.

## 12. Error and edge-case behaviour

- **Invalid FEN draft:** retain the existing board, insights, and last report;
  show the existing validation error.
- **Illegal move:** retain everything and do not fabricate SAN or changes.
- **Promotion pending:** retain the previous report until a piece is chosen.
- **Promotion cancelled:** retain the previous report and position.
- **Promotion completed:** produce one report from the pawn position directly
  to the promoted position, with promotion SAN and correct count deltas.
- **Capture:** do not call the removed piece “no longer loose.”
- **En passant:** use the pawn's actual captured square for identity removal.
- **Castling:** follow the rook as well as the king when comparing piece status.
- **Checkmate:** SAN may contain `#`; the milestone reports the side as in check
  but does not add a separate checkmate observation.
- **No tracked changes:** show the explicit neutral result rather than an empty
  list.
- **Stockfish failure:** continue showing and updating the deterministic report.
- **Programming invariant failure:** fail normally in development; do not
  silently invent an empty comparison for invalid canonical data.

## 13. Testing strategy

Tests should prove user-visible outcomes and chess facts, not calls between
helpers. Full Stockfish searches are unnecessary.

### Move metadata tests in `position.test.ts`

Extend the existing legal-move examples to prove successful results include:

1. ordinary SAN (`e4`);
2. capture SAN and the captured piece/square;
3. kingside and queenside castling SAN plus rook movement;
4. en-passant SAN plus the pawn's actual captured square;
5. promotion and underpromotion SAN plus the resulting type; and
6. check/checkmate suffixes supplied by `chess.js`.

Existing invalid, illegal, and promotion-required result behaviour must remain
covered.

### Pure comparison tests in `positionChanges.test.ts`

Use known before FENs, completed moves, and derived snapshots to prove:

1. **Quiet move** — SAN is retained and every tracked change collection is
   empty.
2. **Capture** — exact piece-count, point-total, and White-relative balance
   changes are correct.
3. **Black capture** — balance signs and colour wording cannot silently invert.
4. **Promotion** — pawn −1 and selected piece +1 produce the correct net point
   delta.
5. **Entering check** — the after side-to-move colour is identified.
6. **Leaving check** — the before side-to-move colour is identified.
7. **Answering check with check** — both colour-specific transitions are
   retained even though both snapshots have `inCheck: true`.
8. **New loose piece** — a defender moving away causes the correct target and
   current attackers to be returned.
9. **Resolved loose piece** — adding a defender or removing an attacker reports
   the surviving target as no longer loose.
10. **Moved target identity** — moving a loose piece to safety does not produce
    a misleading old-square result; moving it to another loose square is not
    reported as both removed and added.
11. **Captured loose piece** — it is omitted from the resolved list.
12. **En-passant capture identity** — the pawn on the passed square is omitted
    from resolved findings.
13. **Castling rook identity** — the rook is followed from its old square to its
    new square.
14. **Pinned semantics** — a transition caused by the existing static attack
    map remains consistent with Milestone 4; no tactical reinterpretation is
    introduced.
15. **Deterministic ordering** — material and loose-piece changes follow the
    documented order.

Tests should normally select changes by colour/type/square when proving one
fact; only ordering examples should assert complete list order.

### Component tests

`PositionChangesPanel.test.tsx` should prove that:

- the initial instruction is visible for `null`;
- SAN is shown without a quality label;
- check entering and leaving are phrased with the correct colours;
- equal, White-favoured, and Black-favoured balance changes are phrased
  correctly;
- capture and promotion count changes are understandable;
- new and resolved loose-piece transitions are human-readable;
- a quiet move gets the explicit neutral result; and
- no alarmist or tactical verdict is added.

### Application integration tests

`App.test.tsx` should prove that:

- a legal ordinary move creates a report;
- a second legal move replaces rather than appends to it;
- a capture updates material change text;
- promotion creates one report only after selection;
- a valid FEN load clears the report;
- an invalid FEN leaves the prior report unchanged;
- an illegal move and cancelled promotion leave it unchanged;
- Milestone 4 selected highlights still clear on a committed move; and
- the report remains visible when the fake engine is in an error state.

## 14. Manual browser checks

1. Load the application and confirm the panel invites a board move.
2. Play `e4`; confirm `After e4` and the neutral tracked-change result appear.
3. Play a position with a simple capture; confirm counts, points, and balance
   change with the correct colour perspective.
4. Move a defender away from a piece; confirm that piece is reported as newly
   attacked and undefended and agrees with the current Position insights panel.
5. Move a loose piece to safety; confirm it is reported once as no longer loose
   rather than as unrelated old/new pieces.
6. Complete a promotion and an underpromotion; confirm SAN and material deltas.
7. Test en passant and castling positions for clean, non-duplicated output.
8. Submit a valid FEN and confirm the report resets to its instruction.
9. After another move, submit an invalid FEN and attempt an illegal drop;
   confirm the report remains.
10. Confirm the report updates immediately while Stockfish starts its new
    search, and remains usable if the engine fails.
11. Confirm the panel is readable at a narrow viewport and introduces no
    unexpected console errors.
12. Repeat the core checks at the production URL after deployment.

## 15. Acceptance criteria

Milestone 5 is complete when:

- `positionFen` remains the sole authoritative current position.
- All direct `chess.js` use remains in `src/chess/position.ts`.
- No new npm dependency is added.
- Every completed legal board move returns application-friendly SAN and the
  move metadata needed for deterministic comparison.
- The latest completed board move replaces the previous report.
- A valid direct FEN load clears the report; invalid drafts, illegal moves, and
  cancelled promotions do not.
- Material count, point-total, and White-relative balance changes are correct
  for both colours, captures, and promotions.
- Check transitions identify colours correctly, including answering check with
  check.
- Newly and no-longer attacked-and-undefended pieces are reported using the
  exact static semantics established in Milestone 4.
- Moved pieces, captured pieces, en-passant captures, promotions, and castling
  rooks do not produce misleading identity transitions.
- The UI labels the move using SAN and presents only factual, non-alarmist
  wording.
- A quiet move explicitly says no tracked category changed without implying
  that nothing chess-relevant changed.
- The report appears synchronously and remains usable when Stockfish loads or
  fails.
- Existing board, FEN, promotion, highlight, engine-analysis, and narrow-layout
  behaviour remains intact.
- Domain, component, and application tests cover the specified positive,
  negative, and boundary cases.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build.
- Production smoke checks pass after deployment.
- `docs/architecture.md` and `docs/journal.md` describe the implemented result.

## 16. Explicit non-goals

- Engine evaluation before/after comparison
- Best-move or move-quality labels
- Inaccuracy, mistake, or blunder detection
- Tactical motif detection, including forks, pins, skewers, discovered attacks,
  overloaded defenders, and sacrifices
- Claims that material was “won” or a loose piece is tactically lost
- Comparing changed attacker lists when loose-piece status remains the same
- Static-exchange evaluation or capture-sequence search
- “Why?” explanations or natural-language generation
- Move history beyond the latest completed move
- Undo, redo, move navigation, or a move list
- PGN import or game analysis
- PV exploration or playing engine moves on the board
- Evaluation bar, MultiPV, or candidate comparison
- Board arrows or additional change highlights
- Position persistence, local storage, accounts, analytics, or backend services
- A generic event, detector, history, or plugin framework

## Decisions requiring owner approval

1. Approve creating reports only for completed board moves and clearing them on
   valid direct FEN loads.
2. Approve limiting comparison to deterministic material, check, and
   attacked-and-undefended state transitions, with no engine-evaluation delta.
3. Approve tracking whether a piece crosses the loose-piece boundary while
   deliberately ignoring attacker-list changes when its loose status stays the
   same.
