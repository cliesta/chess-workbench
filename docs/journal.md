# 2026-08-09 — Milestone 0: Development skeleton

Chess Workbench began as a deliberately small React, TypeScript, and Vite
application. The goal of this milestone was to establish a dependable modern
web-development environment without starting any chess functionality.

The application now has a clear request path: Vite serves `index.html`, which
loads `src/main.tsx`; that entry point mounts the root React component from
`src/App.tsx`. The visible result is a minimal readiness screen styled with one
global CSS file.

The project also gained its basic quality gates:

- Vitest and React Testing Library for user-visible component tests;
- TypeScript for static type checking;
- ESLint for code-quality checks;
- Prettier for consistent formatting;
- Vite's production build and preview commands.

Node.js 24 is recorded in `.nvmrc`, npm dependencies are locked, and convenience
scripts provide repeatable setup and full-project verification. The verification
suite passes formatting, linting, tests, type checking, and the production build.

The most useful architectural lesson from this milestone is that the three main
tools have separate jobs: React describes the interface, TypeScript checks the
code, and Vite serves and builds it. Keeping those responsibilities visible in a
small application should make later milestones easier to understand.

No chess board, chess rules library, engine integration, backend, persistence,
or styling framework was introduced. Milestone 1 remains intentionally
unstarted.

---

# 2026-08-17 — Milestone 1: Board and FEN

Chess Workbench can now load and validate full FEN positions and accept legal
drag-and-drop moves on a responsive board. The displayed FEN updates after each
move, while invalid FEN and illegal moves leave the last valid position intact.

The key design decision is that a normalized FEN string is the single source of
truth. React owns that immutable value; `chess.js` objects exist only briefly
inside the ordinary TypeScript domain module. This keeps chess rules out of the
components and prevents the board widget from becoming a competing state store.

Promotion is a deliberate two-step action. A pawn remains on its original square
until the user chooses Queen, Rook, Bishop, or Knight, so underpromotion is fully
supported for both colours and cancellation is safe.

The test suite now covers FEN validation, normal and illegal moves, castling, en
passant, promotion and underpromotion, plus the user-visible flow between the FEN
form, board, error message, and promotion chooser. Stockfish and all later
analysis features remain outside this milestone.

---

# 2026-08-18 — Milestone 2: Stockfish analysis

Chess Workbench now analyses its current valid position entirely in the browser.
A compact Stockfish 18 WebAssembly engine runs in a background Worker, searches
for 1.5 seconds, and reports its state, depth, a White-relative evaluation, and
one numbered SAN principal variation. The existing board and FEN editor remain
usable while the engine loads or if it fails.

The most important boundary is that React never speaks UCI. An ordinary
TypeScript client owns engine startup, commands, output parsing, cancellation,
and teardown, then publishes typed updates to a small hook and analysis panel.
Every request carries both an identifier and its FEN. Searches are serialized
until Stockfish emits `bestmove`, and stale updates are rejected again at the
React boundary, preventing results from one position appearing under another.

Scores are normalized from Stockfish's side-to-move convention to a stable
White perspective: positive always favours White, including mate scores. Engine
coordinate moves are replayed through the existing `chess.js` domain boundary to
produce SAN with correct move numbers, castling, and promotion notation.

The lite single-thread build was chosen to keep the download near 7 MB and avoid
SharedArrayBuffer and cross-origin-isolation deployment requirements. npm pins
the engine provenance, while a small script copies the exact Worker/Wasm pair,
GPLv3 licence, and corresponding-source information into Vite's generated static
assets before development and production builds.

Deterministic tests cover UCI parsing, White/Black score signs, mate semantics,
PV conversion, search serialization, stale results, stop timeout, Worker errors,
and React behaviour through fake engines. A real Stockfish smoke test also
completed the prescribed search and produced iterative output and a final best
move. MultiPV, evaluation bars, PGN analysis, caching, adjustable settings, and
all later workbench features remain intentionally unstarted.
