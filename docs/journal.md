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

---

# 2026-08-18 — Development pause

Development is pausing with Milestones 0–2 complete. The current application is
a usable board and FEN editor with one client-side Stockfish analysis line. The
repository's full `npm run verify` quality gate passes with 57 tests, and the
real Stockfish lite build has completed the intended 1.5-second search smoke
test.

No Milestone 3 design or implementation has begun. The next session should start
by reviewing the product direction and choosing the next deliberately small
milestone rather than assuming that MultiPV, evaluation bars, PGN support, or
other later features should come next.

---

# 2026-08-21 — Milestone 3: Repository deployment preparation

The repository is now prepared for the approved Cloudflare Pages deployment,
but no external repository or production site has been created yet. GitHub will
become the sole canonical repository rather than mirroring the existing
self-hosted GitLab remote. The local production branch has been renamed from
`master` to `main`. A minimal GitHub Actions workflow runs the complete quality
gate on every push; direct pushes to `main` remain allowed for this solo project.

Stockfish runtime files now use the exact-version path
`stockfish/18.0.8/`. The build removes obsolete generated engine files before
copying the matching Worker loader, Wasm binary, GPLv3 text, and expanded
provenance record from the pinned npm package. The application uses the same
versioned base for Worker creation and its visible source/licence link. This
makes a one-year immutable cache safe: a future engine upgrade must change the
URL rather than overwrite an already cached file.

Cloudflare's tracked `_headers` file makes HTML revalidate while allowing
content-hashed Vite assets and exact-version engine assets to remain cached for
one year. The deployment runbook records the clean build, Cloudflare settings,
normal direct-push workflow, production checks, engine-failure test, licence
inspection, and dashboard rollback procedure.

The complete `npm run verify` gate passes under Node 24 with 59 tests, linting,
formatting, type checking, and a production build. Inspection of `dist/`
confirmed there are no unversioned engine files and that the loader, Wasm, and
licence are byte-for-byte copies of `stockfish@18.0.8`. A local Vite preview
served the versioned Worker, provenance, and licence successfully and served the
Wasm as `application/wasm`.

Milestone 3 is not complete until the owner creates the public GitHub repository,
connects it to Cloudflare Pages, and the production checklist passes at the
stable public URL.

---

# 2026-08-22 — Milestone 3: Production deployment complete

Chess Workbench is publicly available at
<https://chess-workbench.cliesta.workers.dev/>. GitHub is now the canonical
`origin`; the previous self-hosted GitLab repository remains explicitly named
`gitlab` rather than being mirrored. The first GitHub Actions run passed the
complete verification suite for production commit `39ab4eb`.

Cloudflare's current repository import flow deployed the application through
Workers Builds and static-assets hosting, yielding a `workers.dev` URL rather
than the originally proposed Pages URL. This is a hosting-platform detail, not a
new backend: the repository contains no server-side Worker or function, and
Stockfish continues to run locally in a browser Web Worker. The owner approved
the variation after deployment.

Production HTTP checks confirmed that HTML revalidates while hashed application
assets and versioned Stockfish files carry the intended one-year immutable cache
policy. The Worker loader, Wasm binary, and GPL text are byte-for-byte identical
to the pinned `stockfish@18.0.8` package; the Wasm response uses
`application/wasm`; and provenance and corresponding-source information are
publicly accessible. The deployed HTML, JavaScript, and CSS also match the local
verified build.

The owner confirmed the remaining interactive production checks: board and FEN
behaviour, Stockfish depth/evaluation/SAN output, stale-result protection during
rapid position changes, narrow-screen usability, a clean console, and graceful
degradation when engine assets fail. Milestone 3 and Phase 1 of the product
roadmap are complete. The next milestone should begin the deliberately small
Workbench Intelligence phase rather than add more raw engine presentation.

---

# 2026-08-22 — Milestone 4: Position insights

Chess Workbench now provides its first deterministic, human-oriented position
summary. A new panel identifies the side to move and check status, shows both
sides' actual material counts and conventional 1/3/3/5/9 totals, and lists
non-king pieces that are attacked by an opponent but not attacked by a friendly
piece. Each finding names the target and its attackers and can add restrained,
distinct target and attacker outlines to the board.

The wording is intentionally explanatory. The interface defines these findings
as loose pieces and explicitly says that the static warning is not proof that a
piece can be won. It makes no tactical, move-quality, or engine-backed claim.
The rule preserves `chess.js`'s documented attack-map semantics exactly: pinned
pieces count as both attackers and defenders. Dedicated tests protect both
directions of that boundary.

The canonical FEN remains the only position state. `src/chess/position.ts`
derives a plain insight snapshot synchronously and remains the only module that
uses `chess.js` directly. `App` owns only the selected finding because the
insight panel and board are siblings; every committed move, FEN, or promotion
clears that selection and recomputes the snapshot. Invalid drafts do neither.
The calculation is independent of Stockfish, so engine failure does not affect
the panel.

No dependency was added. The verification gate passes with 78 tests, including
material sign and promotion cases, both-colour loose-piece detection, pinned
attackers and defenders, stable ordering, accessible panel behavior, board-style
adaptation, and application flows. Tactical motif detection and “what changed?”
comparison remain explicitly outside this milestone.

---

# 2026-08-22 — Milestone 5: What changed after the move?

Chess Workbench now compares the position immediately before and after each
completed board move. A new “What changed?” panel shows the move in SAN and
reports factual material-count and balance changes, colours entering or leaving
check, and pieces crossing the existing attacked-and-undefended boundary. Quiet
moves get an explicit neutral result rather than an empty panel.

The report is deliberately one-step history. Each legal move replaces it, while
a valid direct FEN load clears it because two arbitrary FENs do not establish a
known move. Invalid FEN drafts, illegal drops, and cancelled promotions leave it
alone. Promotion produces one report only after the choice is completed.

The chess boundary now returns application-friendly SAN and move metadata for
captures, en passant, promotions, and castling. A pure TypeScript comparison
module uses that data to follow moved pieces and the castling rook, and to omit
captured pieces at their actual square. This prevents misleading output such as
calling a captured loose piece “no longer attacked.” The canonical FEN remains
the only current-position authority; the report is historical presentation
state and remains independent of Stockfish.

No dependency was added. The verification gate passes with 105 tests covering
both material perspectives, check-with-check, promotion totals, loose-piece
transitions, moved and captured identity, en passant, castling, pinned-attacker
semantics, accessible explanatory wording, and application lifecycle behavior.
Engine-score comparison, move grading, tactical motifs, move history, and PGN
work remain outside the milestone.

---

# 2026-08-22 — Milestone 6: PGN import and game navigation

Chess Workbench can now load one pasted PGN and review its main line. The Game
review panel shows available player and event details, a position counter,
first/previous/next/last controls, and a keyboard-accessible SAN move list. The
board, normalized FEN, deterministic position insights, “What changed?” report,
and current-position Stockfish analysis all follow the selected ply.

The application workspace is now explicitly either a standalone position or an
imported game plus selected position index. This keeps one authoritative path to
the displayed FEN. Loading a valid FEN or completing a legal board move exits
review into standalone analysis; invalid input, illegal moves, and cancelled
promotions preserve the game and selected ply. The PGN draft remains available
to reload.

All direct `chess.js` use remains in `src/chess/position.ts`. It parses the PGN
into plain normalized FEN snapshots and reuses the existing special-move adapter
for captures, en passant, castling, and promotion. A small ordinary-TypeScript
game coordinator precomputes the existing factual move comparisons without
introducing a circular module dependency or any new package.

The scope remains deliberately modest: one pasted game, main line only,
comments and NAGs accepted but not displayed, and Stockfish analysis only for
the currently selected position. File import, variations, persistence,
whole-game engine analysis, evaluation graphs, and move grading remain future
work.

The complete verification gate passes under Node 24 with 129 tests, formatting,
linting, type checking, and a production build. Local production inspection
confirmed that the built HTML and versioned Stockfish Worker/Wasm assets are
present, byte-identical to the generated public assets, and that the Wasm is
served as `application/wasm`.
