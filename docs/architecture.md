# Architecture

Chess Workbench is a single client-side React application written in TypeScript
and built by Vite. There is no backend or persistence. Stockfish 18 runs entirely
in the browser as a single-threaded WebAssembly engine in a Web Worker.

The browser loads `index.html`. Its module script loads `src/main.tsx`, which
mounts the root `App` component into the page and imports the global stylesheet.
Vitest and React Testing Library exercise the rendered interface in a simulated
browser DOM.

## Position and game workspace

`App` owns a small discriminated workspace: either one standalone normalized
FEN with its latest-move report, or one immutable imported game with a selected
position index. The FEN displayed to the board and all analysis panels is
derived from that workspace. This prevents an imported game's selected ply and
the displayed position from drifting apart. Editable FEN and PGN drafts, a
pending promotion choice, and selected highlights remain separate UI state;
they are not additional sources of valid position truth.

`src/chess/position.ts` is the boundary around `chess.js` and the only
application module that imports it. It supplies the starting FEN, validates and
normalizes submitted FEN, and applies legal moves. Each operation creates a
short-lived chess object and returns an explicit result to React.

`PositionBoard` adapts `react-chessboard` events to application callbacks and
contains no rules. `PromotionDialog` collects the user's promotion choice.
`App` coordinates those components and updates canonical state.

`src/chess/position.ts` also parses one pasted PGN through `chess.js` and returns
plain headers, normalized FEN snapshots, move numbers, and application move
metadata. `src/chess/game.ts` combines that boundary output with the existing
position-insight comparison to create an immutable main-line game. It imports
both chess-domain modules so `position.ts` does not acquire a circular
dependency on its own comparison consumer.

The visible layout follows that same workspace discriminator. Standalone mode
puts its FEN form first and keeps PGN import available as a separate **Review a
game** card. A loaded game collapses its PGN editor behind **Load another game**
and puts the game summary plus first/previous/next/last navigation before other
game content. Its editable FEN form moves behind a disclosure that explicitly
says a valid load leaves review. Drafts remain ordinary UI state and are not
discarded merely because their controls are collapsed.

`GameReviewPanel` has no rules or parser responsibility. Its loaded-game content
uses two local presentation views. **Review** contains the whole-game engine
controls, Review moments, and an internally scrolling SAN move list whose
selected step is kept visible. **Position details** reuses Analysis, What
changed?, Position insights, and the standalone-FEN disclosure. Changing views
does not change the position or analysis; replacing the game resets the view to
Review. Selecting a ply still updates the workspace index and synchronizes the
FEN draft.

At desktop widths the board column is sticky and capped by viewport height, so
it remains available while either task view scrolls. On narrow screens the
board stays in normal document flow. Review-moment and move-list actions then
reveal and focus a named board-position region, while nearby toolbar navigation
changes position without repeatedly moving the page. This responsive behavior
is presentational and does not create another selected-position authority.

A valid direct FEN load or completed legal board move explicitly returns to
standalone mode; invalid input, illegal moves, and cancelled promotions leave
game review intact. Stockfish continues to analyse only the single derived
current FEN unless the user starts the explicit whole-game pass.

Whole-game engine output is ephemeral state separate from `ImportedGame`. Its
result array aligns with the game's position indices and repeats each FEN as a
defensive identity check. This keeps parsed chess facts immutable and prevents
engine results from becoming another authority for the board position.

`src/chess/position.ts` also converts engine principal variations from UCI
coordinate moves to numbered SAN by replaying them from the analysed FEN. This
keeps direct `chess.js` use inside the same domain boundary.

## Position insights

`src/chess/position.ts` derives a plain `PositionInsights` snapshot from the
canonical FEN. It reports the side to move, check status, conventional material
counts and totals, and every non-king piece whose square is attacked by an
opponent and not attacked by a friendly piece. The calculation is synchronous,
has no React or Stockfish dependency, and does not create another source of
position state.

Loose-piece detection deliberately uses `chess.js`'s static attack-map
semantics. Pinned pieces therefore count as attackers and defenders. The result
is presented as an attention cue rather than proof that a piece is tactically
lost; no capture search or engine evaluation participates in the rule.

`App` derives insights whenever its authoritative FEN changes and owns only the
currently selected finding square as presentation state. The
`PositionInsightsPanel` renders explanatory text and selection buttons.
`PositionBoard` remains a rules-free adapter: it converts the selected target
and attacker squares into restrained square styles. Committing any new position
clears the selection, while an invalid FEN draft leaves both the canonical
position and its insights unchanged. This flow remains independent of the
asynchronous engine lifecycle.

## Latest-move comparison

Successful `attemptMove` results also carry plain `AppliedMove` metadata: SAN,
the moving piece and squares, promotion, the actual captured piece square, and
the castling rook movement when applicable. `src/chess/position.ts` derives
those facts from `chess.js`; React does not infer special moves from board
coordinates or receive library-specific move objects.

`src/chess/positionChanges.ts` is a pure TypeScript comparison module. Given the
insight snapshots immediately before and after a completed move, plus its move
metadata, it reports material-count and balance changes, colour-specific check
transitions, and surviving pieces that entered or left the existing
attacked-and-undefended set. It maps moved pieces, promotions, and castling
rooks across squares and removes captured pieces at their actual square, so a
capture is never misreported as a piece merely becoming safe. It deliberately
inherits the static pinned-piece semantics of the underlying insight snapshots.

In standalone mode, the workspace stores only the latest `PositionChanges`
report as one-step historical presentation state. Imported-game positions carry
the same precomputed report for the move that produced each FEN, so backward or
jump navigation still explains the displayed position rather than the direction
of travel. A completed board move replaces the workspace with a standalone
report; a valid direct FEN load clears it because arbitrary FENs do not establish
a one-move history. Invalid drafts, illegal drops, and cancelled promotions
leave it unchanged. `PositionChangesPanel` renders the SAN and factual
transitions without move grading or engine-score comparison. Stockfish
independently starts analysing the newly derived current FEN as before.

## Engine analysis

`App` calls `useWorkbenchAnalysis` once with the derived current FEN, imported
game, and selected game index. The hook owns exactly one browser engine client.
When no game-analysis job is running, it starts the established fixed
1,500-millisecond search whenever the selected FEN changes. `AnalysisPanel` is a
presentation-only consumer of its typed state. Draft or invalid FEN text never
reaches the engine.

An explicit whole-game pass temporarily owns that same Worker. The hook
supersedes the interactive search, submits the imported initial position and
every after-position sequentially at 500 milliseconds each, and retains the
latest depth, White-perspective evaluation, and SAN PV for completed positions.
Navigation does not interrupt the queue. The selected Analysis panel shows only
a matching live, retained, or waiting state; it never starts a competing search.
When the pass completes or is cancelled, normal analysis resumes for the
currently selected FEN.

Each game run has a generation identifier in addition to the engine request ID,
FEN, game object, and position index checks. Replacing the game or leaving game
review invalidates that generation, stops active work, and discards its results.
Cancellation preserves completed entries but submits no later positions. Late
promises may settle, but their callbacks cannot write into a replacement run.
Worker/protocol failure remains terminal for the engine client; partial game
results and the complete chess interface remain usable without recovery logic.

`StockfishAnalysisClient` is the boundary around the Worker and the UCI text
protocol. It initializes Stockfish with `uci` and `isready`, serializes searches
across each terminating `bestmove`, and publishes only typed depth, evaluation,
and principal-variation updates. React components never send or parse UCI
strings. A superseded search is stopped and its remaining output retains its old
request identity, so it cannot appear under a newer position. If stopping or
starting the engine fails, the Worker is terminated and the analysis panel shows
an error; the position editor remains independent and usable.

UCI centipawn and mate scores are normalized to White's perspective before they
cross the boundary: positive always favours White. Principal variations are SAN
strings rather than raw engine coordinates. The engine boundary retains factual
output only; it does not calculate adjacent-score changes or grade moves.

The pinned `stockfish` npm package supplies the lite single-thread JavaScript and
Wasm pair. A small pre-development/pre-build script copies only those files,
GPLv3 text, and exact source information to generated
`public/stockfish/18.0.8/` assets. Application code uses one shared module for
the versioned Worker and provenance URLs. The copy step rejects a package
version that does not match the URL, preventing an engine upgrade from silently
reusing an immutable cache entry. Vite serves the generated files unchanged,
separate from the main application bundle. The single-thread build avoids
SharedArrayBuffer and cross-origin-isolation requirements.

## Review moments

`src/analysis/reviewMoments.ts` is a synchronous interpretation layer over the
immutable imported game and its matching retained whole-game results. For each
played move it requires both adjacent result FENs to match their corresponding
game positions, then compares the before and after evaluations from the moving
player's perspective. White centipawn utility uses the stored score directly;
Black utility reverses its sign. A loss must be at least 75 centipawns to pass
the deliberately conservative attention/noise filter.

Forced-mate changes remain categorical rather than being assigned invented
centipawn values. The module recognizes a mate reversal, allowing an opponent's
mate, and losing one's own mate; it ignores same-winner mate-distance changes
and mate scores whose winner is not represented. Candidates are ranked by
those explicit categories, then centipawn loss and game order, and capped at
three. This output is a study shortlist, not a move grade or accuracy score.

`App` derives the list with `useMemo`; it does not store a second mutable review
state. `ReviewMomentsPanel` renders only settled complete or retained partial
results, uses the retained SAN principal variation from before the played move
as a modest **Engine line**, and suppresses raw UCI fallback notation. Selecting
a moment delegates to existing game navigation and therefore updates the board,
FEN, insights, latest-move report, and Analysis panel through the same workspace
authority. No additional Worker request or dependency is involved.

## Production delivery

The production application is the static Vite build in `dist/`; it has no
application server, backend, environment variables, or secrets. GitHub is the
canonical repository. Cloudflare Workers Builds independently builds pushes to
`main` and publishes the static assets at
`https://chess-workbench.cliesta.workers.dev/`. The Cloudflare Worker is only the
hosting container for static assets: the repository contains no server-side
Worker code or functions. This is separate from the browser Web Worker that runs
Stockfish on the user's device.

A small GitHub Actions workflow runs `npm ci` and `npm run verify` on every push.
The first production commit passed that workflow, and the deployed HTML,
JavaScript, CSS, Stockfish loader, Wasm, and licence were verified against its
local production build.

`public/_headers` defines the browser cache boundary. The HTML entry point
always revalidates. Vite's content-hashed application assets and the exact-
version Stockfish directory are immutable for one year. A future engine upgrade
must change the npm pin, the generated provenance, and the versioned application
URL together.

Cloudflare version previews are optional. Direct pushes to `main` are permitted
for this solo project, so local verification is the normal pre-push safeguard;
GitHub Actions reports the independent result rather than acting as a protected-
branch gate. Deployment settings, production checks, and Worker-version rollback
are recorded in `docs/deployment.md`.
