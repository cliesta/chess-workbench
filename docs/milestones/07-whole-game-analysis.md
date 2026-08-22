# Milestone 7 — Whole-game analysis

## 1. Goal

Turn imported-game navigation into a repeatable analysis pass:

> Analyse every main-line position in the current imported game, show progress,
> and retain one consistent Stockfish result per position while the game remains
> loaded.

This milestone gathers trustworthy raw material for later review features. It
does not yet call moves good, inaccurate, mistaken, or blunders.

## 2. Scope

- Add an explicit **Analyse game** action for a loaded PGN.
- Analyse the initial position and every main-line after-position sequentially.
- Use the existing browser Stockfish Worker and typed engine boundary.
- Show running progress and a **Cancel analysis** action.
- Retain the latest depth, White-perspective evaluation, and one SAN principal
  variation for every completed position.
- Show each completed after-position evaluation beside its move in the existing
  move list.
- Show the initial-position evaluation in the game-analysis summary.
- Let the existing Analysis panel display a retained batch result for the
  currently selected position while the batch owns the engine.
- Preserve completed partial results after user cancellation or engine failure.
- Keep navigation, board display, FEN, and deterministic panels usable while
  analysis runs or fails.
- Cancel and discard results when the imported game is replaced or review is
  left for a standalone position.
- Add deterministic lifecycle, hook, component, and application tests using a
  fake engine.
- Update architecture and the project journal after implementation.

No new npm package is needed.

## 3. Product boundary

### Collect evaluations before interpreting them

Milestone 7 answers only: “What evaluation did Stockfish reach at each game
position under one common search limit?” It establishes job progress,
cancellation, result identity, and single-engine scheduling.

It must not calculate evaluation loss, compare the played move with the engine's
best move, assign move-quality labels, select review moments, or explain why a
move was bad. Those judgments need explicit mate-aware comparison rules and
deserve the next milestone once the underlying results are reliable.

### One deliberate analysis run

Loading a PGN does not automatically start a whole-game job. The user explicitly
chooses **Analyse game**, because even a modest game can keep a laptop CPU busy
for tens of seconds. The current-position analysis may still start normally
after import; beginning a game run supersedes it.

Results live only for the current imported game and browser session. Reloading,
loading another PGN, loading a standalone FEN, or branching with a board move
discards them. There is no persistence or cache keyed by FEN.

## 4. Search limit recommendation

Use a fixed **500 milliseconds per position** for the whole-game pass. Keep the
existing 1,500-millisecond limit for ordinary current-position analysis.

Fixed time is preferable to fixed depth here:

- total duration is approximately predictable;
- every position makes progress even on a slower machine;
- cancellation never has to wait for an unexpectedly expensive depth target;
- it uses the engine client's existing `go movetime` path; and
- it is straightforward to explain: about 40 seconds of search time for an
  80-ply game, plus small Worker and message overhead.

A fixed depth would make results more comparable across machines, but runtime
can vary greatly by hardware and position. Nodes-per-position would also vary in
wall time and expose an engine-oriented concept without solving the user problem.
The 500-millisecond pass is intentionally a first review scan, not deep analysis.

Change the current literal request type to accept a positive `moveTimeMs: number`
and define two named constants:

```ts
CURRENT_POSITION_MOVE_TIME_MS = 1_500;
GAME_POSITION_MOVE_TIME_MS = 500;
```

The UI does not expose either value as a setting. The Game review panel should
say that the pass uses a quick, fixed search per position so expectations are
clear.

## 5. Result model and authority

Engine output must remain separate from the immutable chess-domain game model.
`ImportedGamePosition` continues to mean factual chess data parsed from PGN; it
must not gain asynchronous Stockfish state.

Use an engine-facing result such as:

```ts
type CompletedPositionAnalysis = {
  fen: string;
  depth: number | null;
  evaluation: Evaluation | null;
  principalVariation: string | null;
  principalVariationUsesRawNotation: boolean;
};

type GameAnalysisState = {
  status: "idle" | "running" | "cancelled" | "complete" | "error";
  results: Array<CompletedPositionAnalysis | null>;
  completedCount: number;
  totalCount: number;
  activePositionIndex: number | null;
  errorMessage: string | null;
};
```

The result array has the same indices as `ImportedGame.positions`:

- index 0 is analysis of the initial position;
- index N is analysis of the position after ply N; and
- `null` means that position has not completed.

Each stored result repeats its FEN. Index alignment is convenient for display;
the FEN is the defensive identity check that prevents a result from being shown
if it somehow belongs to a different game or position.

The analysis hook owns this ephemeral state. `App` continues to own the
authoritative `Workspace`. The imported PGN remains authoritative for which
positions exist; engine results never alter the game, board, or FEN.

## 6. Architecture and code responsibilities

The application should continue using exactly one Stockfish Worker:

```text
App Workspace and selected FEN
              |
              v
useWorkbenchAnalysis                 React lifecycle and scheduling
     |                    |
     | current result     | game job state/results/actions
     v                    v
AnalysisPanel        GameReviewPanel
              |
              v typed requests
StockfishAnalysisClient              existing UCI/Worker boundary
              |
              v
Stockfish.js Worker + Wasm
```

### `src/engine/types.ts`

- Allow the typed request's move time to be the selected positive number rather
  than the current 1,500-millisecond literal type.
- Define the two named limits and the completed/game-analysis result types.
- Keep UCI strings and Worker details out of these application-facing types.

Do not make a generic job framework or multi-engine interface.

### `src/engine/stockfishAnalysisClient.ts`

No protocol redesign is required. It already:

- initializes one Worker;
- serializes one active and one pending request;
- emits typed updates tagged by request ID and FEN;
- waits for `bestmove` before beginning the next request; and
- supports stop, timeout failure, and disposal.

Add request validation only if needed to reject a non-positive move time. The
client should not know whether a request came from a game or the selected board.

### `src/engine/useWorkbenchAnalysis.ts`

Replace the current panel-owned `usePositionAnalysis` lifecycle with one
workbench-level hook. It owns:

- creation, initialization, and disposal of the one engine client;
- the monotonically increasing request ID;
- current-position analysis state;
- the active game-run generation and cancellation flag;
- sequential submission of game positions;
- stale update filtering; and
- resuming normal current-position analysis after a run ends.

Keep the sequential loop in this concrete hook. A generic queue, scheduler,
service class, context provider, or reducer is not yet warranted. Small pure
helpers for creating empty state or accepting a matching result are appropriate
when they make lifecycle tests clearer.

Remove `usePositionAnalysis.ts` once its behavior and tests have been migrated;
do not leave two competing engine owners.

### `App.tsx`

- Call `useWorkbenchAnalysis` once with the derived current FEN and the imported
  game when present.
- Pass current-position presentation state to `AnalysisPanel`.
- Pass game status, results, start, and cancel actions to `GameReviewPanel`.
- Ensure valid game replacement and exit-to-standalone transitions invalidate
  the current game run.

`App` must not construct engine requests, parse UCI, or implement the sequential
loop.

### React components

- `AnalysisPanel` becomes presentation-only. It receives a typed position
  analysis state rather than creating an engine client.
- `GameReviewPanel` renders the action, progress, initial evaluation, and compact
  per-move evaluations. It does not start promises or calculate evaluations.
- Existing board, FEN, insight, comparison, and promotion components remain
  unaware of game analysis.

## 7. Single-engine scheduling

Running two Stockfish Workers would be superficially easier, but both would
consume CPU simultaneously, make laptop behavior noisy, and produce less useful
results under contention. The downloaded Wasm may be cached, but that does not
make concurrent searches free. Use one engine and give a whole-game run
temporary ownership of it.

The scheduling rule is:

1. While no game job is running, analyse the selected FEN with the existing
   1,500-millisecond behavior.
2. When **Analyse game** is chosen, supersede/stop that interactive request.
3. Analyse game positions sequentially at 500 milliseconds each.
4. Navigation during the run changes the displayed position but does not
   interrupt the batch or start an interactive request.
5. When the run completes, is cancelled, or fails, resume ordinary analysis for
   the currently displayed FEN if the engine is still usable.

During a run, `AnalysisPanel` shows the retained batch result for the selected
position once available. If that position is currently being searched, it may
show its live depth/evaluation/PV with **Analysing game** status. If it has not
been reached, show **Waiting for game analysis** with empty values. It must not
show an older position's data.

After the batch releases the engine, the normal 1,500-millisecond selected-
position result may refine what the Analysis panel shows. It must not overwrite
the retained 500-millisecond game result displayed beside the move.

## 8. Game-analysis lifecycle and stale-result protection

### Starting

1. Increment a game-run generation identifier.
2. Stop or supersede any active current-position request.
3. Create a fresh result array containing one `null` per game position.
4. Set status to `running`, total to the position count, completed to zero, and
   active index to zero.
5. Submit positions in index order and await each `analyse()` completion before
   submitting the next.

Use the latest typed update received for a request as its final stored result
when completion is `complete`. A completion with no update still advances
progress and stores a result with null fields, so a malformed or sparse line
cannot hang the job.

### Accepting output

An update or completion may affect the job only when all of these match:

- the hook is still mounted;
- the game-run generation is still current;
- the request ID is the active request;
- the request's position index is still active;
- the request FEN equals the indexed game FEN; and
- the workspace still contains the same imported game object.

The existing client already tags Worker output with request ID and FEN. The
generation and game identity are the application-level protection against an
old asynchronous loop continuing after replacement.

### Navigation during a run

Navigation does not change the job generation and does not stop the active
search. React derives the visible retained/live result by selected index plus
FEN. The engine can therefore continue through the queue while the user reviews
any completed or pending position.

### Cancellation

Choosing **Cancel analysis**:

1. marks the current generation cancelled;
2. calls `stop()` for the active request;
3. prevents another position from being submitted;
4. preserves already completed results;
5. sets status to `cancelled` after the active request resolves as interrupted;
   and
6. resumes normal selected-position analysis.

Cancellation is cooperative. Stockfish may take a short time to answer `stop`
with `bestmove`; the existing 2.5-second timeout remains the terminal engine
error boundary. Do not add Worker restart/recovery logic in this milestone.

### Replacement, branching, and teardown

- Loading a different valid PGN invalidates the generation, stops the active
  request, and discards old results before showing the new game.
- Loading a valid standalone FEN or completing a legal board move does the same
  because game review has ended.
- Invalid PGN/FEN, illegal moves, navigation, and cancelled promotion do not
  invalidate the job.
- Component unmount invalidates the generation, stops no further work, and
  disposes the single Worker through the hook cleanup.

Promises belonging to an invalid generation may settle, but their callbacks
must become no-ops.

## 9. Evaluation and PV semantics

Reuse Milestone 2 semantics without variation:

- positive centipawns always favor White;
- negative centipawns always favor Black;
- internal centipawns remain integers;
- display uses pawn units with sign and two decimals;
- mate is represented as White-perspective signed plies-to-mate and displayed
  with the existing mate notation;
- a missing evaluation displays an em dash; and
- PV is replayed from that exact position's FEN and displayed as numbered SAN.

Do not calculate a numerical delta between adjacent results yet. In particular,
mate and centipawn values must not be forced onto one improvised numeric scale.
That is part of the move-quality milestone.

Malformed PV handling remains unchanged: retain a valid SAN prefix or mark the
raw-coordinate fallback when SAN conversion genuinely fails. A malformed PV
must not discard an otherwise valid evaluation.

## 10. UI behavior

Extend the loaded-game portion of the existing **Game review** panel.

### Idle

Show:

```text
Quick engine pass · 500 ms per position
[Analyse game]
```

Do not show the action when no game is loaded.

### Running

Show a native progress element with a textual equivalent:

```text
Analysing game: 14 of 83 positions
[Cancel analysis]
```

`completedCount` counts stored positions, not the active one. The native
`<progress max={total} value={completed}>` supplies accessible semantics. Use a
polite live region for occasional progress text, but avoid announcing every
engine info line.

The Analyse action is disabled or replaced while running. Navigation controls
remain enabled.

### Complete, cancelled, or error

- Complete: **Analysis complete: 83 positions** and **Analyse again**.
- Cancelled: **Analysis cancelled: 14 of 83 positions retained** and
  **Analyse again**.
- Error: **Game analysis stopped** plus a concise error; retain completed
  results and offer **Analyse again** only if the engine is still usable.

Because the current Stockfish client treats Worker/protocol failure as terminal,
a genuine engine error normally leaves retry unavailable until page reload. Do
not present a button that is known to fail.

### Move list

Add one restrained evaluation token to each move button when its after-position
result is complete:

```text
1.  e4  +0.18    e5  +0.24
```

The move SAN remains the primary label and the evaluation remains visually
subordinate. Include the evaluation in the accessible button name, for example
**Go to after 1. e4, evaluation plus 0.18**. An unanalysed move shows no fake
placeholder inside the button.

Show the initial-position result separately near progress because there is no
move button for index 0:

```text
Starting evaluation: +0.22
```

Do not add an evaluation graph, coloured quality badges, alarm colors, arrows,
or automatic navigation.

## 11. Interaction with current-position analysis

`AnalysisPanel` remains the detailed view for the selected position. Its status
labels expand only as needed to distinguish:

- Loading engine
- Analysing position
- Analysing game
- Waiting for game analysis
- Ready
- Error

When the selected batch position has completed, display its stored depth,
evaluation, and PV even if the engine has moved on. When the selected position
is actively being searched, display matching live updates. When it is pending,
display no stale depth, score, or line.

The panel's visible GPL/source link remains unchanged. Whole-game analysis uses
the same already-distributed engine files and introduces no licensing change.

## 12. Error and edge-case behavior

- **No game loaded:** no whole-game action is shown.
- **Zero-move PGN:** analyse its one initial position and complete normally.
- **Engine still loading:** Analyse game may be disabled with a Loading label;
  it becomes available when initialization succeeds.
- **Engine initialization failure:** show the existing engine error; game review
  and deterministic panels remain usable; Analyse game is unavailable.
- **No meaningful score for a completed request:** retain depth/PV if present,
  display an em dash for evaluation, and continue.
- **Malformed UCI/PV:** existing parsing behavior applies; unrelated valid data
  and the queue survive.
- **User cancellation:** preserve completed results and resume selected-position
  analysis after the stop handshake.
- **Stop timeout or Worker/Wasm failure:** mark the game job error, preserve
  completed results, terminate the engine as today, and keep chess UI usable.
- **Rapid navigation:** never changes batch order or displays a result whose FEN
  differs from the selected position.
- **New valid PGN:** stop and discard the old job/results, then show the new game
  idle.
- **Invalid replacement PGN:** preserve the current game job and results.
- **Valid FEN or completed board move:** stop and discard the game job/results as
  review ends.
- **Illegal move or cancelled promotion:** preserve the job and results.
- **Analyse again:** clear prior results and begin from index 0; do not merge two
  runs made at different times.
- **Duplicate FENs:** analyse every position index rather than deduplicating.
  Repetition-aware caching is outside scope and index alignment is clearer.

The page must remain responsive because Stockfish continues to run in its Web
Worker. A long game consumes time, but its result array and React updates remain
small.

## 13. Testing strategy

The normal automated suite must not run a real 500-millisecond Stockfish search
for every fixture. Use deterministic fake engines and retain the existing small
real-asset/client boundary checks.

### Engine client tests

Keep existing UCI/client tests and add only what the request-type change needs:

- a 500-millisecond request emits `go movetime 500`;
- current-position requests still emit `go movetime 1500`; and
- invalid move-time input is rejected if validation is added.

Do not teach the client about games or queue indices.

### Workbench-analysis hook tests with a fake engine

Prove behavior through typed requests and rendered state:

1. **Sequential order** — initial and after-position FENs are requested once in
   index order, never concurrently.
2. **Progress** — each complete request stores its latest matching update and
   increments completed count.
3. **Full completion** — all results align with the correct index and FEN.
4. **Missing score** — a completed request with only depth still advances.
5. **Live selected result** — matching live output appears only for the selected
   active position.
6. **Pending selected position** — shows no result from a different index.
7. **Navigation** — changes the selected display without stopping or reordering
   the batch.
8. **Cancellation** — stops the active request, submits no next request, retains
   completed entries, and resumes current-position analysis.
9. **New game** — stops the old request and ignores late old updates/completion.
10. **Exit to standalone** — invalidates and discards game results, then analyses
    the standalone FEN.
11. **Invalid inputs/no workspace change** — do not cancel a run.
12. **Generation protection** — a stale completion from run A cannot write into
    run B even when an index or FEN happens to match.
13. **FEN protection** — a mismatched update is ignored.
14. **Engine failure** — retains completed game entries, exposes an error, and
    does not start more work.
15. **Unmount** — disposes exactly one engine and late promises do not update
    React.
16. **Zero-move game** — sends exactly one request for the initial position.
17. **Analyse again** — clears and replaces rather than merges results.

Use manually controlled promises in the fake so the tests prove serialization
and race behavior instead of relying on timers.

### Formatting and component tests

Add concrete evaluation examples:

- White advantage: `+0.34`;
- Black advantage: `−1.20`;
- equal: `0.00`;
- mate for White;
- mate for Black; and
- no score.

`GameReviewPanel` tests should prove:

- analysis actions appear only for a loaded, ready game;
- progress element and textual counts agree;
- cancellation is available only while running;
- complete/cancelled/error wording is explanatory rather than alarmist;
- initial evaluation and after-position evaluations map to correct indices;
- move labels remain primary and accessible names include available scores;
- unanalysed moves do not pretend to have scores; and
- navigation callbacks remain usable during analysis.

`AnalysisPanel` tests should prove retained, live, waiting, ready, and error
states never mix fields from different FENs.

### Application integration tests

With the existing fake board and engine seams, prove:

- loading a game enables whole-game analysis;
- starting a run pauses/supersedes current-position analysis;
- progress and move evaluations appear as controlled requests finish;
- navigation during analysis keeps every panel on the selected FEN;
- cancellation preserves completed move evaluations;
- valid replacement PGN discards old results while invalid PGN preserves them;
- valid FEN and completed board move cancel/discard the run;
- illegal moves and cancelled promotions do not;
- a completed run resumes ordinary analysis of the selected FEN; and
- engine failure leaves PGN navigation and deterministic panels usable.

No unit or React test should wait 500 milliseconds per position.

### Real-engine smoke test

One optional browser smoke check with a two- or three-ply game is enough to prove
that the real Worker accepts sequential 500-millisecond requests and completes.
Keep this out of the normal unit-test suite if browser Worker support would make
it flaky in CI.

## 14. Manual browser checks

1. Load a short PGN and confirm **Analyse game** appears only after engine ready.
2. Start analysis and confirm progress moves from 0 through every position,
   including the initial position.
3. Navigate while it runs; confirm controls, board, FEN, insights, and What
   changed? remain responsive.
4. Confirm the Analysis panel shows matching live, retained, or waiting state
   for the selected ply and never another position's result.
5. Let the run finish; confirm every move has a restrained evaluation and the
   starting evaluation is shown separately.
6. Confirm centipawn and both mate perspectives use the established White-
   perspective display convention where test positions permit.
7. Confirm the selected position's retained PV is numbered SAN.
8. Run a longer game and check that actual duration is broadly consistent with
   500 milliseconds times its position count.
9. Cancel midway; confirm no later positions begin, completed results remain,
   and current-position analysis resumes.
10. Navigate rapidly during a run and after cancellation; confirm no stale
    score or PV appears.
11. Choose Analyse again and confirm old results clear before the new run.
12. Replace the PGN during a run; confirm old progress/results disappear and
    late output does not enter the new game.
13. Submit invalid replacement PGN and invalid FEN; confirm the current run and
    results remain.
14. Load a valid FEN or make a legal board move during a run; confirm game
    analysis ends and standalone analysis starts.
15. Test a zero-move game.
16. Simulate Worker/Wasm failure; confirm partial results remain and the chess
    interface continues working.
17. Check a narrow viewport, keyboard focus, progress accessibility, and move-
    list readability.
18. Confirm the console has no unexpected errors and only one Stockfish Worker
    is active.
19. Repeat the core flow against the deployed production URL.

## 15. Acceptance criteria

Milestone 7 is complete when:

- A loaded game can be explicitly analysed from initial position through every
  main-line after-position.
- The pass uses one existing Stockfish Worker and a fixed 500-millisecond limit
  per position.
- Interactive current-position analysis is paused during the batch and resumes
  for the selected FEN afterward.
- Requests are strictly sequential and progress accurately counts completed
  positions.
- Completed results retain matching FEN, depth, White-perspective evaluation,
  and SAN PV when available.
- The result array remains separate from immutable PGN/chess-domain data.
- Starting evaluation and available per-move evaluations are shown accessibly
  without move-quality language.
- The detailed Analysis panel never displays a result belonging to another
  selected position.
- Navigation remains usable throughout a run.
- Cancellation stops future work, preserves completed results, and cannot be
  undone by stale output.
- Replacement, standalone exit, analyse-again, and unmount lifecycle behavior
  match this document.
- Invalid input, illegal moves, and cancelled promotions do not unexpectedly
  cancel the run.
- Worker/Wasm failure degrades to usable game review with completed partial
  results retained.
- No second Worker, concurrent search, evaluation graph, move grading, or result
  persistence is introduced.
- Deterministic tests cover request order, progress, cancellation, stale result
  protection, evaluation perspectives, error handling, and React behavior.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build.
- Local and production browser smoke checks pass.
- `docs/architecture.md` and `docs/journal.md` describe the implemented result.

## 16. Explicit non-goals

- Automatic analysis immediately after PGN import
- Concurrent or multi-Worker Stockfish searches
- User-adjustable time, depth, strength, threads, or hash settings
- Evaluation graph or evaluation bar
- Evaluation-loss calculation
- Good/inaccuracy/mistake/blunder labels
- Best-move versus played-move comparison
- Ranking or selecting review moments
- Tactical or positional motif detection
- Natural-language move explanations
- Playing engine PV moves on the board
- MultiPV or candidate-move comparison
- Whole-game annotations, NAG generation, or PGN export
- Analysis of PGN side variations
- FEN-result or transposition caching
- Local storage, IndexedDB, persistence, resume-after-reload, or cloud storage
- Background analysis after leaving game review
- File import, game library, accounts, backend services, or LLM integration
- Worker restart or recovery after a terminal engine error
- Engine-strength benchmarking or performance tuning beyond correctness

## Decisions requiring owner approval

1. Approve 500 milliseconds per game position while retaining 1,500
   milliseconds for ordinary selected-position analysis.
2. Approve analysing the initial position as well as every after-position, so a
   later milestone can compare each played move's before and after evaluations.
3. Approve one shared Worker: whole-game analysis temporarily pauses interactive
   selected-position searches and navigation does not interrupt the batch.
4. Approve displaying factual per-move evaluations and retaining PV/depth, while
   all move-quality labels, evaluation deltas, graphs, and review-moment ranking
   remain deferred.
