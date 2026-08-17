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
GPLv3 text, and exact source information to generated `public/stockfish/` assets.
Vite serves them unchanged, separate from the main application bundle. The
single-thread build avoids SharedArrayBuffer and cross-origin-isolation
requirements.
