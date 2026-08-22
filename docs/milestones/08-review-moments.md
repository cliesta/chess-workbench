# Milestone 8 — Review moments

## 1. Goal

Turn a completed or interrupted whole-game engine pass into a short study queue:

> Identify the few played moves that most worsened the moving player's position,
> explain the measured evaluation change factually, and let the user jump to
> those positions.

This is the first feature that directs the user's attention within an analysed
game. It does not yet grade every move or explain the chess reason for a change.

## 2. Scope

- Derive review moments from adjacent retained Milestone 7 position results.
- Measure ordinary centipawn deterioration from the moving player's perspective.
- Recognize a small set of unambiguous forced-mate transitions without inventing
  a centipawn value for mate.
- Ignore missing, mismatched, improving, and small/noisy changes.
- Rank candidates deterministically and show at most three.
- Show the played SAN, evaluation before and after, and a factual explanation of
  why the move entered the review queue.
- Show the retained engine PV from before the played move as the engine line,
  when a human-readable SAN line is available.
- Let a review-moment action navigate to the position immediately after that
  move.
- Support complete and retained partial game-analysis results.
- Keep the feature entirely deterministic and synchronous.
- Add domain, component, and application tests.
- Update architecture and the project journal after implementation.

No new npm package and no new Stockfish search are needed.

## 3. Product boundary

### Direct attention without grading the player

The feature should answer:

> Which moves produced the largest clearly measurable deterioration in this
> quick engine pass?

It must not answer:

> Was this officially a mistake or blunder?

Move-quality labels depend on policy choices, search quality, position
complexity, and often win/draw/loss modeling. A fixed threshold copied from a
chess website would imply more authority than Chess Workbench's 500-millisecond
single-thread scan provides.

Use phrases such as **Review this move**, **The quick engine evaluation moved
against White by 1.20 pawns**, **Allowed a forced mate**, and **Lost a forced
mate**. Avoid alarm colors, punctuation, or judgmental language.

### A shortlist, not a move report card

Show at most three moments. Do not attach a badge to every move, calculate a
percentage accuracy, or make the absence of a moment mean that every other move
was good. If fewer than three changes meet the rules, show fewer. If none do,
say that the quick pass found no large evaluation swings.

## 4. Inputs and authoritative data

Review moments use only:

- the current immutable `ImportedGame`;
- the current `GameAnalysisState.results` array; and
- the existing White-perspective `Evaluation` convention.

For the move that produces `game.positions[N]`:

- the before-position result is `results[N - 1]`;
- the after-position result is `results[N]`;
- the played move is `game.positions[N].move`; and
- the engine line before the move is the PV in `results[N - 1]`.

Both result FENs must equal their corresponding game-position FENs. A missing
result, missing move, or mismatched FEN excludes the candidate. Review logic
must never infer turn from array parity; `AppliedMove.color` remains authoritative
for which player moved, including custom games beginning with Black.

Review moments are derived data. `App` computes them with `useMemo` from the
current game and current result array; it does not store a second editable list.
Navigation still changes only the workspace's selected position index.

## 5. Proposed review-moment model

Use a small application-facing discriminated model such as:

```ts
type ReviewMomentKind =
  "centipawn-loss" | "lost-mate" | "allowed-mate" | "mate-reversal";

type ReviewMoment = {
  kind: ReviewMomentKind;
  positionIndex: number;
  move: AppliedMove;
  beforeEvaluation: Evaluation;
  afterEvaluation: Evaluation;
  lossCentipawns?: number;
  engineLineBeforeMove: string | null;
};
```

`positionIndex` points to the after-position, so selecting a moment displays the
board after the reviewed move and reuses the existing “What changed?” report for
that move.

`lossCentipawns` exists only for a centipawn-to-centipawn comparison. Mate
transitions use their explicit kind and are never converted to an arbitrary
large number.

## 6. Centipawn comparison

All retained centipawn scores are from White's perspective. Convert each score
to the moving player's utility before comparing:

```text
White utility = whiteCentipawns
Black utility = -whiteCentipawns

loss = utility before move - utility after move
```

Therefore:

- White moving from `+0.40` to `−0.80` lost 120 centipawns.
- Black moving from `+0.40` to `+1.30` lost 90 centipawns.
- A negative or zero loss means the moving player's position improved or stayed
  level and is not a review candidate.

Require a loss of at least **75 centipawns**. This is an attention/noise filter,
not an inaccuracy threshold. The UI should describe it as ignoring smaller
changes from the quick scan. Keep the value as a named ordinary-TypeScript
constant:

```ts
MIN_REVIEW_LOSS_CENTIPAWNS = 75;
```

The 75-centipawn choice is deliberately conservative enough to avoid listing
every small 500-millisecond fluctuation while still surfacing a meaningful
swing. It can be revisited with real personal games later; do not expose a user
setting in this milestone.

## 7. Forced-mate comparison

### Perspective

For a non-zero White-perspective mate score:

- positive means White has a forced mate;
- negative means Black has a forced mate;
- it is a **winning mate** for the mover when its sign favors the mover; and
- it is a **losing mate** when its sign favors the opponent.

A mate score of zero does not identify the winner in the current model. Treat it
as unrankable rather than guessing.

### Candidate transitions

Recognize only these clear deteriorations:

| Before from mover's perspective | After from mover's perspective | Kind            |
| ------------------------------- | ------------------------------ | --------------- |
| Winning mate                    | Losing mate                    | `mate-reversal` |
| Not losing mate                 | Losing mate                    | `allowed-mate`  |
| Winning mate                    | Not winning mate               | `lost-mate`     |

Apply `mate-reversal` first because it satisfies both of the other descriptions.
“Not losing mate” and “not winning mate” may be a centipawn evaluation or a mate
for the other side as constrained by the table.

Exclude:

- centipawn to winning mate, because it is an improvement for the mover;
- losing mate to centipawn/winning mate, because it is an improvement;
- winning mate to winning mate; and
- losing mate to losing mate.

Do not compare mate distances within the same winner. Stockfish mate distance
normally changes as a line advances and may fluctuate at shallow search; treating
`M5` to `M7` as a precise two-unit loss would be misleading.

## 8. Ranking and selection

Sort eligible candidates by these stable rules:

1. `mate-reversal`
2. `allowed-mate`
3. `lost-mate`
4. `centipawn-loss`, descending by `lossCentipawns`
5. earlier `positionIndex` as the tie-breaker

Mate categories precede centipawn candidates because no honest numeric
conversion exists between them. Within the same mate category, use game order
rather than mate distance. This is deterministic, modest, and explainable.

Return the first three candidates. Export one pure function:

```ts
findReviewMoments(
  game: ImportedGame,
  results: Array<CompletedPositionAnalysis | null>,
): ReviewMoment[];
```

The function must not mutate either input.

## 9. Engine-line handling

The before-position PV is the line Stockfish preferred from the position before
the played move. Display it as:

```text
Engine line before the move: 12... Nxe4 13. Bxe4 d5
```

Use the already formatted, move-numbered SAN string. Do not parse the string to
extract or compare a “best move” in this milestone; the typed engine result does
not retain a structured first PV move.

If the before result has no PV, show **No engine line was retained for this
position.** If `principalVariationUsesRawNotation` is true, do not repeat raw UCI
coordinates in the review list; show **Engine line notation was unavailable.**

Call it **Engine line**, not **the correct move**. It is the principal variation
found by a quick fixed-time search.

## 10. Architecture and code responsibilities

### `src/analysis/reviewMoments.ts`

Add one ordinary-TypeScript module containing:

- the `ReviewMoment` types;
- the named centipawn threshold;
- mover-perspective conversion;
- mate-transition classification;
- candidate ranking; and
- `findReviewMoments`.

This module may import plain types from `src/chess/game.ts`,
`src/chess/position.ts`, and `src/engine/types.ts`. It contains no React,
`chess.js`, UCI, Worker, or mutable state.

An `analysis/` directory is justified because this rule combines immutable chess
history with typed engine results. It is neither a chess-rules operation nor an
engine-protocol responsibility. Do not generalize it into a rule framework,
detector registry, or plugin system.

### `App.tsx`

- Derive review moments with `useMemo` only when an imported game is present.
- Pass the moments and selected position index to the presentation component.
- Reuse `handleGameNavigation` when a moment is selected.

No additional authoritative or global state is needed.

### `ReviewMomentsPanel.tsx`

Add a focused presentation component that:

- renders the explanatory introduction;
- renders up to three supplied moments;
- formats before/after evaluation with the existing formatter;
- describes the mover-relative change;
- renders the retained engine line or its documented fallback; and
- reports the chosen `positionIndex` upward.

It performs no comparison or ranking. A separate component is warranted because
the explanatory list is a distinct region with its own accessible behavior and
tests; adding it directly to the already substantial `GameReviewPanel` would mix
analysis interpretation with PGN input/navigation rendering.

The panel appears within the loaded-game flow after Game analysis controls and
before the ordinary navigation status. It does not appear when no game is
loaded.

## 11. Availability and lifecycle

- While whole-game analysis is `idle`, show a short note: **Analyse the game to
  find review moments.**
- While it is `running`, show: **Review moments will settle when the quick pass
  stops.** Do not show a ranking that reorders after every position.
- When status is `complete`, derive from all available adjacent results.
- When status is `cancelled` or `error`, derive from retained adjacent results
  and visibly call the list **Partial review moments**.
- After **Analyse again**, Milestone 7 clears the result array, so the review
  panel returns to the running message and no stale moments remain.
- Replacing the game or leaving game review already discards analysis results;
  derived review moments therefore disappear automatically.
- Invalid input, navigation, illegal moves, and cancelled promotion preserve the
  same game/results and therefore preserve the list.

Only compare an adjacent pair when both results are complete and FEN-matched.
Partial analysis commonly has a completed prefix; a missing gap must simply
exclude dependent moves.

## 12. UI behavior

Add a **Review moments** subsection/card within Game review. Its introduction
should say:

> These are the largest clear deteriorations found by the quick engine pass.
> Smaller changes are ignored, and the list is not a move grade.

Each moment should present restrained text similar to:

```text
Review 1 · After 14. Qc2
Evaluation: +0.35 → −1.02
White's position worsened by about 1.37 pawns.
Engine line before the move: 14. Nxe5 Nxe5 15. dxe5
[Show position]
```

Mate wording examples:

- **White allowed a forced mate.**
- **Black lost a forced mate.**
- **The move changed a forced mate for White into a forced mate for Black.**

The button's accessible name should include the move, for example **Show
position after 14. Qc2**. When the reviewed after-position is currently selected,
set `aria-current="location"` and use the same subdued selected treatment as
other navigation. Clicking navigates; it does not play a move or alter analysis
results.

Use neutral borders and typography. Do not use red/yellow/green quality colors,
icons, board arrows, modal dialogs, or automatic scrolling. Existing board
highlights remain controlled only by Position insights.

For an empty completed result, show:

> No large evaluation swings were found in this quick pass.

This means only that no candidate met these deliberately narrow rules.

## 13. Error and edge-case behavior

- **No imported game:** no Review moments panel.
- **Game not analysed:** instructional empty state.
- **Analysis running:** stable waiting message; do not show provisional ranking.
- **Cancelled/error analysis:** calculate only from retained matching adjacent
  results and mark the section partial.
- **Zero-move game:** completed empty state; there is no played move to review.
- **Missing before or after result:** exclude that move.
- **Mismatched result FEN:** exclude that move.
- **Missing `AppliedMove`:** exclude that position rather than inferring a move.
- **Below 75-centipawn loss:** exclude.
- **Mover improvement:** exclude.
- **Mate score zero:** exclude any comparison requiring its winner.
- **Same-winner mate on both sides:** exclude rather than comparing distances.
- **Missing PV:** keep the moment and show the no-line fallback.
- **Raw PV fallback:** keep the moment but do not expose coordinates in this
  panel.
- **Fewer than three candidates:** show only those available.
- **Equal ranking:** earlier move comes first.
- **Custom Black start:** use move metadata and full move numbering already
  retained by the game.
- **Duplicate FEN:** index identity still distinguishes moves; do not deduplicate.

The feature is synchronous over at most a few hundred array entries and needs no
loading state, Worker, cache, or performance optimization.

## 14. Testing strategy

### Pure review-moment tests

Use short explicit game/result arrays. Prove:

1. **White centipawn loss** — `+0.40` to `−0.80` becomes a 120-centipawn
   candidate.
2. **Black centipawn loss** — `+0.40` to `+1.30` becomes a 90-centipawn
   candidate.
3. **White improvement** — an evaluation moving in White's favor after White's
   move is excluded.
4. **Black improvement** — an evaluation moving in Black's favor after Black's
   move is excluded.
5. **Threshold boundary** — 74 is excluded and 75 is included.
6. **Missing result** — missing before or after analysis excludes the move.
7. **FEN mismatch** — excludes an otherwise large swing.
8. **Missing move metadata** — excludes safely.
9. **White allows mate** — centipawn/White mate to Black mate is classified
   correctly, including reversal priority where applicable.
10. **Black allows mate** — the sign convention is correctly inverted.
11. **White loses mate** — White mate to centipawn is classified.
12. **Black loses mate** — Black mate to centipawn is classified.
13. **Mate reversal** — mover-winning mate to mover-losing mate has highest
    priority.
14. **Mate improvement** — escaping opponent mate or finding own mate is
    excluded.
15. **Same-winner mate distances** — excluded in both directions.
16. **Mate zero** — excluded without guessing.
17. **Ranking** — mate categories precede centipawn losses; centipawn losses are
    descending; ties are chronological.
18. **Top-three cap** — returns exactly the strongest three candidates.
19. **Black custom start** — uses `AppliedMove.color`, not index parity.
20. **PV retention** — stores SAN PV from the before result and suppresses raw
    fallback text.
21. **Immutability** — inputs remain unchanged.

Use both positive and negative White-perspective scores repeatedly so a sign
regression is difficult to introduce.

### `ReviewMomentsPanel` tests

Prove that:

- idle, running, complete-empty, partial-empty, and populated states have the
  documented explanatory wording;
- centipawn before/after values and mover-relative loss are formatted correctly;
- allowed-mate, lost-mate, and reversal wording names the correct mover/colors;
- the before-position SAN line is visible;
- missing and raw PV fallbacks are visible without raw coordinates;
- at most the supplied three moments render;
- each Show position action reports the expected after-position index;
- the selected moment uses `aria-current="location"`; and
- keyboard focus remains visible.

The component tests receive already-ranked moments and must not assert internal
comparison calls.

### Application integration tests

Using the existing fake engine seam, prove:

- review moments do not appear before a game analysis settles;
- completing controlled adjacent results produces the expected shortlist;
- clicking a moment updates board, FEN, insights, What changed?, and selected
  move together;
- cancellation shows partial moments only from completed adjacent pairs;
- Analyse again clears the previous list immediately;
- valid PGN replacement and standalone exit remove old moments;
- invalid PGN/FEN preserve them; and
- engine failure leaves partial moments and ordinary game review usable.

No test needs a real Stockfish search. One production browser smoke game with an
obvious material blunder is useful after the deterministic suite passes.

## 15. Manual browser checks

1. Analyse a short game containing one obvious material loss and confirm one
   factual review moment appears.
2. Confirm its before/after evaluations match the retained move-list values.
3. Click **Show position** and verify board, FEN, selected move, insights, What
   changed?, and Analysis all show the after-position.
4. Confirm the engine line is the retained SAN PV from before the move.
5. Analyse a quiet game and confirm small changes do not create a forced list of
   three.
6. Test obvious White and Black deteriorations; confirm wording and signs follow
   the mover rather than always White.
7. Test positions that allow opponent mate, lose own mate, and reverse mate where
   practical.
8. Cancel after enough positions for one adjacent comparison; confirm a partial
   list appears and incomplete pairs are absent.
9. Start Analyse again; confirm the old list disappears while the run proceeds.
10. Replace the PGN and exit to standalone analysis; confirm old moments vanish.
11. Submit invalid PGN/FEN; confirm current moments remain.
12. Check a zero-move game and a game with no qualifying swings.
13. Verify missing/raw PV fallback wording where practical.
14. Check narrow-screen wrapping, keyboard navigation, subdued selected state,
    and absence of horizontal overflow.
15. Confirm browser console has no unexpected errors.
16. Repeat the core flow against the deployed production URL.

## 16. Acceptance criteria

Milestone 8 is complete when:

- Review moments are derived synchronously from the current imported game and
  matching retained game-analysis results.
- White and Black centipawn deterioration use the documented mover-relative
  formula.
- The inclusive 75-centipawn filter behaves exactly as documented and is
  described as a noise/attention filter rather than a move grade.
- Mate reversal, allowed mate, and lost mate use explicit perspective-aware
  rules without converting mate to centipawns or comparing same-winner mate
  distances.
- Missing, mismatched, improving, unrankable, and below-threshold comparisons are
  excluded safely.
- Ranking is deterministic and returns no more than three moments.
- Every moment identifies its after-position index, played SAN, before/after
  evaluation, mover, reason, and available before-position engine line.
- Raw UCI PV fallback is not exposed in the Review moments panel.
- Complete and partial result states use the documented wording.
- Selecting a moment navigates the existing workspace without changing the game
  or analysis results.
- The UI remains explanatory, restrained, keyboard accessible, and usable on a
  narrow screen.
- No new engine searches, dependencies, mutable authorities, move grading,
  graph, motif detection, or natural-language generation are introduced.
- Deterministic tests cover both colors, threshold boundaries, mate transitions,
  ranking, lifecycle, and React behavior.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build.
- Local and production browser smoke checks pass.
- `docs/architecture.md` and `docs/journal.md` describe the implemented result.

## 17. Explicit non-goals

- Good, excellent, best, inaccuracy, mistake, or blunder labels
- Move accuracy percentage or player performance score
- Threshold compatibility with Chess.com, Lichess, or another platform
- User-adjustable thresholds or number of moments
- Evaluation graph or evaluation bar
- Quality colors or icons on every move
- Deeper confirmation searches for candidates
- Re-running Stockfish from the before-position
- Structured best-move extraction or played-versus-best move comparison
- MultiPV or candidate comparison
- Automatically playing or exploring the engine line
- Tactical motif detection
- Positional feature attribution
- Explaining why the evaluation changed
- Natural-language or LLM commentary
- Player identification or filtering to only one player's moves
- PGN annotation, NAG generation, or export
- Persistence, historical trends, accounts, backend, or cloud storage
- Analysis of side variations
- Board arrows or review-specific square highlights

## Decisions requiring owner approval

1. Approve an inclusive 75-centipawn minimum as an attention/noise filter, not a
   move-quality threshold.
2. Approve at most three review moments, with no requirement to fill all three.
3. Approve the explicit mate-transition priority and exclusion of same-winner
   mate-distance changes.
4. Approve showing retained partial review moments only after a run stops, while
   hiding provisional rankings during a run.
5. Approve using the retained before-position SAN PV as an **Engine line**, while
   deferring structured best-move comparison and deeper confirmation searches.
