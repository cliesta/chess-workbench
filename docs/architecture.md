# Architecture

Chess Workbench is a single client-side React application written in TypeScript
and built by Vite. There is no backend or persistence. Stockfish 18 runs entirely
in the browser as a single-threaded WebAssembly engine in a Web Worker.

The browser loads `index.html`. Its module script loads `src/main.tsx`, which
mounts the root `App` component into the page and imports the global stylesheet.
Vitest and React Testing Library exercise the rendered interface in a simulated
browser DOM.

## Position editing

The normalized, full FEN string in `App` is the authoritative representation of
the current position. The editable FEN draft and a pending promotion choice are
separate UI state; the board component and mutable library objects are not
additional sources of truth.

`src/chess/position.ts` is the boundary around `chess.js` and the only
application module that imports it. It supplies the starting FEN, validates and
normalizes submitted FEN, and applies legal moves. Each operation creates a
short-lived chess object and returns an explicit result to React.

`PositionBoard` adapts `react-chessboard` events to application callbacks and
contains no rules. `PromotionDialog` collects the user's promotion choice.
`App` coordinates those components and updates canonical state.

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

`App` stores only the latest `PositionChanges` report as one-step historical
presentation state. This does not compete with `positionFen`, which remains the
sole current-position authority. A completed board move replaces the report; a
valid direct FEN load clears it because arbitrary FENs do not establish a
one-move history. Invalid drafts, illegal drops, and cancelled promotions leave
it unchanged. `PositionChangesPanel` renders the SAN and factual transitions
without move grading or engine-score comparison. Stockfish independently starts
analysing the new canonical FEN as before.

## Engine analysis

`AnalysisPanel` receives the canonical `positionFen`. The
`usePositionAnalysis` hook owns the browser lifecycle: it initializes one engine
client, starts a fixed 1,500-millisecond search when the canonical FEN changes,
filters typed updates by both request identifier and FEN, and cleans up on
unmount. Draft or invalid FEN text never reaches the engine.

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
strings rather than raw engine coordinates.

The pinned `stockfish` npm package supplies the lite single-thread JavaScript and
Wasm pair. A small pre-development/pre-build script copies only those files,
GPLv3 text, and exact source information to generated
`public/stockfish/18.0.8/` assets. Application code uses one shared module for
the versioned Worker and provenance URLs. The copy step rejects a package
version that does not match the URL, preventing an engine upgrade from silently
reusing an immutable cache entry. Vite serves the generated files unchanged,
separate from the main application bundle. The single-thread build avoids
SharedArrayBuffer and cross-origin-isolation requirements.

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
