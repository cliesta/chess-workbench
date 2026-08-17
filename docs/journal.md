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
