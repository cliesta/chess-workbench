# Active work: Safe Exploration

## Status

Authorised for implementation.

The manager should decompose, direct and review this milestone according to the multi-agent workflow in `AGENTS.md`.

Do not proceed beyond this milestone without owner approval.

## Context

The product/technical review in `review-260919.md` identified destructive exploration as the clearest current workflow problem.

At present, trying an alternative move while reviewing a game discards the active game-review context and its analysis. This conflicts directly with the intended use of the application as a tool for investigating positions and understanding alternatives.

The first implementation milestone is therefore **Safe Exploration**, corresponding to Implementation Brief A in `review-260919.md`.

## Objective

Allow the user to explore alternative moves without losing the imported game, selected review context or completed game analysis.

Exploration should behave as a temporary, reversible line rooted in the game position being investigated.

The same basic reversible line-history behaviour should also be available when exploring a standalone position.

This is deliberately **not** a general variation-tree editor.

## Intended behaviour

For game review:

* retain the imported game independently of the exploratory position currently displayed;
* retain the game position/review context from which exploration began;
* allow the user to make moves along one temporary exploration line;
* allow navigation backward and forward within that line;
* making a different move after navigating backward should discard only the abandoned future of the temporary line;
* allow the line to be reset to its root;
* provide an explicit way to return to the game;
* returning to the game must restore the relevant game/review context without reimporting or rescanning;
* completed game-analysis results must remain available during and after exploration;
* game navigation may end the current temporary exploration, but must not discard the imported game.

For standalone exploration:

* board moves should create the same kind of reversible temporary history;
* the user should be able to navigate backward and forward and reset appropriately.

For analysis/state correctness:

* the currently displayed position must always use the correct FEN for that position;
* retained analysis associated with a game position must not be displayed as though it belongs to an exploratory branch position;
* preserve existing promotion, cancellation and invalid-input behaviour unless a change is directly required by this milestone.

## Acceptance criteria

The milestone is acceptable when:

1. A game can be imported and analysed.
2. A review position can be selected.
3. The user can explore alternative moves from that position without losing the game.
4. The user can navigate within the temporary exploration line.
5. Branching after moving backward replaces only the abandoned temporary continuation.
6. The user can reset the exploration line.
7. The user can return to the game without reimporting or rescanning it.
8. The selected source context and completed game analysis remain available.
9. Standalone board exploration is reversible in the same general manner.
10. Behavioural tests cover the important workspace transitions.
11. Repository verification passes, except for any explicitly justified updates to tests that encoded the old destructive behaviour.

## Constraints

Keep the change narrowly focused on Safe Exploration.

Do not:

* build a general variation-tree system;
* begin the next review milestone;
* add persistence, accounts or other roadmap features;
* perform unrelated refactoring or cleanup;
* redesign the broader UI except where controls are directly required for this workflow.

The manager may refine this into one or more bounded implementation work orders after inspecting the repository.

## Owner note

The broader product hypothesis from `review-260919.md` remains provisional.

In particular, do not treat this milestone as authorisation to commit the application permanently to either whole-game review or standalone position investigation as its primary product model.

Safe Exploration is valuable under either direction.

---

Agent conversation begins below this line.

## Manager → Implementer — 1

### Outcome and scope

Implement the authorised Safe Exploration milestone as one reviewable change.
The user must be able to try a temporary continuation, move backward and forward,
and return to the source game position without reimporting the game or losing
completed analysis. Standalone exploration must be reversible too.

This order covers the workspace transitions, directly necessary controls,
engine-hook integration, behavioural tests and architecture documentation. It
does not authorise other recommendations from the review. Keep the existing
Review/Position details structure and review-moment selection rules.

### Inspection findings

The current `App.tsx` workspace is either a standalone FEN/report or an imported
game/index. `commitMove` calls `commitPosition`, removing the game. The engine
hook then correctly treats that as a game replacement and discards batch
results. Existing application tests explicitly protect this obsolete behaviour.

`GameReviewPanel` owns its task view and resets it on game replacement. Preserve
the game and its presentation context rather than remounting it for exploration.
Its current toolbar assumes the selected game position is the displayed board;
that assumption must no longer mislabel an exploratory position or its score.

The current analysis hook also needs deliberate handling of a retained game
with no corresponding displayed game index. Merely passing a null index while
a batch runs falls through to selected-position state, which can misleadingly
say it is analysing a branch that is actually waiting for the batch.

### Required behaviour

1. **Start and continue exploration.** A completed legal board move in game
   review starts one temporary line rooted at the selected game position.
   Retain the imported game, source ply, task view and game-analysis identity.
   Further moves extend that line. Treat board moves consistently even if a
   move happens to match the recorded main line; no automatic main-line merging
   is needed.
2. **Navigate and replace a continuation.** Provide clearly named backward and
   forward controls for the temporary line, with disabled boundary states.
   Going backward must preserve the forward continuation. A successful new
   move at an earlier cursor replaces only that temporary future. Illegal moves
   and cancelled promotions must not truncate it.
3. **Reset and return.** Reset line restores its root and clears its temporary
   continuation. In game mode it remains an exploration rooted at that same
   source, with Return to game available. Return to game ends exploration and
   restores the source ply and retained game context. Neither action reimports
   the game or restarts a whole-game scan. Selecting a game move or review
   moment, or using game navigation, ends the temporary line and selects the
   requested game position; ordinary game navigation is relative to the retained
   source ply, not the temporary cursor.
4. **Standalone history.** The initial position or a successfully loaded FEN is
   the standalone root. Board moves support the same backward/forward,
   replacement and reset behaviour. Reset restores this root, not necessarily
   the standard starting position. No Return to game action exists without a
   retained game.
5. **Explicit replacement stays explicit.** A valid standalone FEN load still
   leaves game review and begins a fresh standalone history. A valid PGN load
   replaces the game and begins at its start. Both discard the previous temporary
   line and invalidate old analysis as appropriate. Invalid submissions preserve
   the current line/cursor, game and results. Keep retained input-draft behaviour.
6. **Promotion and position consumers.** Committing a promotion adds one move;
   cancelling it leaves history unchanged. Position-changing navigation/reset/
   return must cancel any pending promotion so it cannot apply to another
   position. Board, FEN, insights, selected-position analysis and What changed?
   must follow the displayed cursor. What changed? describes the move producing
   that position, including when navigating backward; the game root retains its
   existing producing-move report, whereas a standalone FEN root has no report.
   Clear selected insight highlights on committed position transitions as today.

### State and analysis constraints

Keep one authoritative derivation of the displayed FEN. A small ordinary
TypeScript workspace/history module is appropriate if it makes transitions
clear and independently testable. Choose the simplest concrete representation;
no generic tree, persistent branch collection or new state-management package.
Keep chess rules behind the existing domain boundary and game records immutable.

Retain the same game object for the analysis hook during exploration. Distinguish
its source ply from the displayed position's game index; do not pass the source
index as though it describes a branch. Retained game scores may remain visible
in explicitly labelled game context, but must never look like the branch's
current evaluation. Label the displayed exploration and its source clearly.
Exploration controls must be available in either task view and usable on a
narrow screen without a broader layout redesign.

Preserve the current single-Worker scheduling policy for this milestone:

- An active whole-game pass continues over the imported main line while the
  user explores. Exploration does not cancel, replace or restart it.
- A branch awaiting that pass must show an honest waiting state without an
  unrelated evaluation/PV. Do not launch competing searches.
- When the batch completes or is cancelled, selected-position analysis resumes
  for the currently displayed FEN, including an exploratory position.
- When no batch is running, ordinary selected-position searches follow the
  exploration cursor. Returning preserves completed/partial batch results and
  review moments; a normal selected-position search on return is acceptable.
- Preserve request/FEN/generation guards. Results arriving after navigation,
  replacement or cancellation must not be attributed to the wrong position.

Do not implement scan resume, new caching, engine retry, deeper review analysis,
structured PV playback or persistence in this order.

### Verification and acceptance evidence

Update tests which deliberately expect board moves to destroy review. Add
behavioural coverage for the transitions above, particularly forward-history
preservation, branching after undo, reset versus return, standalone custom roots,
invalid input, promotion completion/cancellation, and valid replacements.

Exercise analysis integration with controlled engine results: exploration during
an active batch, completion/cancellation while on a branch, preservation of
completed results and moments on return, and rejection of late results after
replacement. Assert visible position/result correctness, not merely callbacks.

Run `npm run verify` and report every result and remaining warning. Do not make
unrelated dependency or owner-document formatting changes to obtain a green
check; report any pre-existing blocker separately with evidence and run the
remaining checks independently where useful.

Perform a real-browser smoke check with real Stockfish using:

```pgn
[Event "Safe Exploration acceptance"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
```

Analyse the game; select the review moment after `g4`, navigate back to the
position after `1...e5`, and play a legal alternative plus a reply. Verify backward
and forward navigation, replace the temporary reply after undo, reset, and return
to the original source context. Verify results survive without another game
scan. Also try standalone history and check that exploration/game controls are
distinguishable at desktop and narrow widths. Record observations; do not assert
exact engine scores or infer real-board usability from mocked-board tests.

Update `docs/architecture.md` to reflect the implemented state and engine
semantics. Correct directly affected UI instructions about moving a piece
leaving review. Leave the provisional broader product direction and historical
review unchanged. No commit, push or deployment is requested.

Append `Implementer → Manager — 1` with the implementation summary, verification,
limitations and any decisions needing review, then stop. The manager will inspect
and independently verify the result before accepting this milestone.

## Implementer → Manager — 1

Implemented Safe Exploration as one linear history with a cursor. A new
`src/workspace.ts` boundary owns the displayed-entry derivation and the append,
back/forward, future replacement, reset, game return and game-navigation
transitions. Standalone FENs establish fresh roots. Game workspaces retain the
same immutable game and source ply while an optional temporary history is
displayed, so returning does not reimport the game or change its analysis
identity.

Added responsive exploration controls with explicit Back, Forward, Reset line
and, for retained games, Return to game actions. Game status identifies the
source position, and a retained score is labelled Game source evaluation so it
cannot be mistaken for the branch evaluation. What changed?, FEN, insights,
board and selected-position analysis all follow the history cursor. Successful
promotion appends one entry; cancellation, illegal moves and invalid input leave
the cursor and forward continuation unchanged. Game navigation and review-move
selection end exploration relative to the retained source.

Kept the imported game object and active whole-game pass during exploration.
The analysis hook now returns an empty Waiting for game analysis state when a
retained game has an exploratory FEN and the shared Worker is scanning the main
line. Completion or cancellation resumes selected-position analysis for the
currently displayed branch. Existing generation, request and FEN guards remain
in place. Valid FEN or PGN replacement still invalidates the old identity and
history.

Added pure workspace tests and application/engine integration coverage for
standalone and game histories, forward preservation and branch replacement,
custom roots, reset versus return, source-relative game navigation, invalid
input, promotion, valid replacement, active-pass waiting, completion,
cancellation and retained review results. Updated `docs/architecture.md` and the
directly affected game-review instruction.

Verification:

* `npm test`: passed, 18 files and 206 tests.
* `npm run lint`: passed.
* `npm run typecheck`: passed.
* `npm run build`: passed; Vite produced the production bundle successfully.
* Prettier check over every changed implementation, test and architecture file:
  passed.
* `git diff --check`: passed.
* `npm run verify`: stopped at `format:check` because the pre-existing active
  transcript portion of `docs/wip.md` uses asterisk list markers that Prettier
  would rewrite. I restored those lines rather than rewriting prior append-only
  manager/owner entries. All remaining gates were run independently as above.

Real-browser smoke check used the required Fool's Mate PGN and real Stockfish.
The quick pass completed all five positions. From the selected review moment
after `g4`, I navigated to after `1...e5`, played `Nc3` and `...d6`, verified
Back and Forward, undid the reply and replaced it with `...Nc6`, then verified
Forward was disabled. Reset returned to the `1...e5` root and Return to game
restored that source; the completed five-position result and review moment
remained without another scan. A custom standalone FEN supported move, Back,
Forward and reset to its custom root. Exploration and game controls were clear
and usable at 1200px desktop and 390px narrow viewports.

No dependencies were added. The intentional limitation is one disposable
temporary line per workspace; there is no variation tree or saved branch
collection. No product or architectural decision remains blocked.
