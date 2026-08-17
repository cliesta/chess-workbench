# Milestone 2 — Stockfish analysis

## 1. Goal

Analyse the current valid FEN entirely in the browser and display the engine's
state, current search depth, a numerical evaluation, and one human-readable
principal variation (PV).

This milestone proves one narrow vertical slice: a React view can request
analysis through a typed application boundary, while an isolated browser Worker
runs Stockfish and speaks UCI. It does not attempt to become an analysis
workbench yet.

## 2. Scope

- Start one Stockfish Web Worker in the browser.
- Automatically analyse the canonical `positionFen`, including the starting
  position and each subsequently loaded or played position.
- Search for a fixed 1,500 milliseconds per position.
- Show loading, ready, analysing, and error states.
- Show the latest reported search depth for the current position.
- Show one evaluation using a stable White-relative convention.
- Convert the first UCI principal variation to SAN and include move numbers.
- Stop or supersede obsolete searches, and never show a result for the wrong
  FEN.
- Keep the existing board and FEN editor usable if the engine cannot run.
- Add deterministic tests around parsing, normalization, PV formatting,
  concurrency, and React behaviour.
- Update `docs/architecture.md` and the project journal when this milestone is
  implemented.

The canonical position remains the normalized full FEN owned by `App`. Draft
text in the FEN field is not analysed until it has been successfully submitted
and becomes `positionFen`.

## 3. Stockfish distribution recommendation

### Recommended build

Use the npm package [`stockfish`](https://www.npmjs.com/package/stockfish), pin
the exact version selected during implementation, and consume its paired
`stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm` files.
At the time of this research the current package is 18.0.8 and tracks
[Stockfish 18](https://stockfishchess.org/blog/2026/stockfish-18/).

The maintained [Stockfish.js project](https://github.com/nmrugg/stockfish.js/)
currently supplies five browser builds. Its own recommendation for most
projects is the lite single-thread build. The important choices are:

| Build                  | Approximate Wasm/JS size | Threads | Deployment consequence                                              |
| ---------------------- | -----------------------: | ------- | ------------------------------------------------------------------- |
| Full multi-thread      |              over 100 MB | yes     | strongest, but very large and requires cross-origin isolation       |
| Full single-thread     |              over 100 MB | no      | strongest single-thread build, but an excessive first download here |
| Lite multi-thread      |               about 7 MB | yes     | compact, but requires cross-origin isolation                        |
| **Lite single-thread** |           **about 7 MB** | **no**  | compact and works without special isolation headers                 |
| asm.js fallback        |              about 10 MB | no Wasm | broader fallback, but substantially slower                          |

The current package listing shows a roughly 7.3 MB Wasm file and a small
JavaScript loader for the lite single build; the files can be inspected in the
[`stockfish@18.0.8` package listing](https://app.unpkg.com/stockfish%4018.0.8/files/bin).
It is deliberately weaker than the full build, but remains much stronger than
the amateur audience and is enough to establish the product's first analysis
loop. The single-thread decision also keeps static hosting and local development
simple. We should not add both single- and multi-thread builds or runtime build
selection in this milestone.

### npm provenance, static runtime assets

Use npm to pin and acquire the distribution, but serve the two selected files
as static runtime assets:

1. A small repository script copies the exact loader and Wasm files from the
   pinned package into a generated `public/stockfish/` directory.
2. npm lifecycle scripts run that copy before `vite` development and production
   builds.
3. The generated binary files are ignored by Git; `package-lock.json` records
   their reproducible source.
4. The Worker URL is built from `import.meta.env.BASE_URL` so deployment below a
   URL subpath still works.

Vite serves files in `public/` from the site root during development and copies
them unchanged to the build output. This is useful here because the prebuilt
Emscripten JavaScript loader must locate a sibling Wasm file by its expected
name. It avoids making Vite transform or hash one half of a coupled asset pair.
The relevant behaviour is documented in Vite's
[static asset guide](https://vite.dev/guide/assets.html).

Installing the package as a normal runtime dependency and importing its package
entry directly is less explicit about which of several builds is selected and
how the Wasm URL is resolved. Manually downloading and committing a multi-
megabyte binary makes provenance and upgrades harder. A third-party Vite copy
plugin would solve only a two-file copy and is not justified.

### Alternatives considered

- [`@lichess-org/stockfish-web`](https://github.com/lichess-org/lila-stockfish-web)
  is current and powerful, but its maintainers describe it as optimized for
  Lichess and not straightforward to load. Its separate neural-network and
  threaded-build concerns are unnecessary for this milestone, and its
  AGPL-3.0-or-later licence is a further distribution consideration.
- The older Lichess `stockfish.wasm` repository directs users to newer work and
  requires cross-origin isolation. It should not be treated as the default
  modern integration pattern.
- A remote analysis API would avoid the download, but would violate the
  client-only product direction and introduce a backend, operating cost,
  latency, and privacy concerns.

### Licence handling

Stockfish and Stockfish.js are GPLv3 software. Distributing their executable
form requires preserving the licence notices and providing recipients access to
the corresponding source under the GPL's object-code distribution terms. The
implementation should:

- retain a copy of the GPLv3 licence and Stockfish/Stockfish.js notices;
- record the exact npm package version and upstream source revision;
- expose a clear “Stockfish source and licence” link alongside the deployed
  engine assets or application notices; and
- for any public release, make the exact corresponding source archive available
  from the same distribution location rather than relying on an unpinned branch.

The application communicates with the engine as a separate Worker using the
standard UCI text protocol; that is a useful technical boundary but should not
be presented as legal advice about the rest of the application's licence. The
authoritative references are the [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html),
its [FAQ](https://www.gnu.org/licenses/gpl-faq.en.html), and the
[Stockfish licence statement](https://stockfishchess.org/about/).

## 4. Browser and WebAssembly constraints

WebAssembly (Wasm) is a compact binary instruction format that lets the browser
run code compiled from Stockfish's C++ much faster than ordinary interpreted
JavaScript. A Web Worker is a background JavaScript context: Stockfish searches
there so its CPU-intensive work does not block React rendering, dragging, or FEN
editing on the main browser thread.

The recommended build is single-threaded. It requires:

- a current browser with Web Workers and WebAssembly;
- the JavaScript loader and Wasm file to be served successfully from the same
  application origin; and
- a server that returns the Wasm file as a static asset. `application/wasm` is
  preferred, although modern Emscripten loaders can fall back when streaming
  compilation is unavailable.

It does **not** use `SharedArrayBuffer`, Wasm shared memory, or Wasm threads, so
Milestone 2 does not require cross-origin isolation.

Threaded Wasm builds share memory between browser threads through
`SharedArrayBuffer`. Browsers expose that capability only to a
cross-origin-isolated page, normally established with both
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` (or a carefully chosen
`credentialless` policy). Those headers also constrain how other cross-origin
resources can be embedded. See MDN's explanations of
[COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)
and
[COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy).
Avoiding that deployment requirement is the main reason not to choose the lite
multi-thread build now.

The roughly 7 MB engine is still the application's largest resource. It should
be fetched only when the analysis client initializes, not incorporated into the
main JavaScript bundle. First analysis will therefore have a visible loading
phase, especially on a cold or slow connection. Normal HTTP caching should make
subsequent visits much quicker. The UI must remain responsive during download
and search.

The Worker should be created as a classic Worker from the static loader URL,
not as Vite-owned application source via `new Worker(new URL(...), { type:
"module" })`. The latter is useful for Workers we author, but this file is
prebuilt Emscripten glue with its own Wasm-loading assumptions. Using the same
static URL in Vite development, preview, and production reduces differences
between environments.

## 5. Architecture and code responsibilities

The smallest clean flow is:

```text
App positionFen
      |
      v
AnalysisPanel / usePositionAnalysis       (React state and presentation)
      |
      v typed requests and updates
StockfishAnalysisClient                   (main-thread ordinary TypeScript)
      | UCI text
      v
Stockfish.js Web Worker + Wasm             (background engine process)
```

React never constructs or parses UCI commands.

### React code

- `src/components/AnalysisPanel.tsx` receives the canonical FEN and renders only
  status, depth, evaluation, and PV.
- `src/engine/usePositionAnalysis.ts` owns the client for the panel's lifetime,
  starts analysis when the canonical FEN changes, assigns request identifiers,
  filters updates against the current request, and maps typed engine events to
  React state.
- `src/App.tsx` passes `positionFen` to the panel. It does not know about UCI,
  Workers, Wasm paths, or Stockfish output.

A hook is warranted now because client creation, asynchronous subscriptions,
FEN-change cancellation, and unmount cleanup form one concrete lifecycle. No
context, reducer, global state library, or general engine framework is needed.

### Ordinary TypeScript on the main thread

- `src/engine/types.ts` defines the small typed engine boundary.
- `src/engine/uci.ts` contains pure parsing and White-perspective score
  normalization functions.
- `src/engine/stockfishAnalysisClient.ts` creates and owns the Worker, performs
  UCI initialization, serializes searches, identifies requests, publishes typed
  updates, and handles timeout/error/cleanup behaviour.
- `src/engine/stockfishAssetUrl.ts` builds the loader URL from Vite's base URL;
  if this remains one expression it may instead stay in the client rather than
  becoming a file.
- `src/chess/position.ts` gains a PV-formatting function. It remains the only
  application module that imports `chess.js`, preserving the Milestone 1
  boundary. Splitting it merely to create a `principalVariation.ts` file would
  either violate that boundary or force a premature reorganization.
- `scripts/copy-stockfish-assets.mjs` performs the deterministic two-file asset
  copy and fails clearly if the pinned package layout is not what we expect.

UCI parsing is cheap string processing and belongs on the main thread inside
the client. The unmodified Stockfish.js loader and Wasm search code are what run
inside the Worker. Adding an application-authored wrapper Worker, which would
then need to host or create the engine, adds another messaging layer without
improving isolation for this milestone.

## 6. Proposed engine interface

The application needs one position-analysis capability and a test seam, not an
engine-independent plugin system:

```ts
export type Evaluation =
  | { kind: "centipawns"; whiteCentipawns: number }
  | { kind: "mate"; whiteMateIn: number };

export interface AnalysisRequest {
  requestId: number;
  fen: string;
  moveTimeMs: 1500;
}

export interface AnalysisUpdate {
  requestId: number;
  fen: string;
  depth: number | null;
  evaluation: Evaluation | null;
  principalVariation: string | null;
}

export type AnalysisCompletion = "complete" | "superseded" | "interrupted";

export interface PositionAnalysisEngine {
  initialize(): Promise<void>;
  analyse(
    request: AnalysisRequest,
    onUpdate: (update: AnalysisUpdate) => void,
  ): Promise<AnalysisCompletion>;
  stop(requestId: number): void;
  dispose(): void;
}
```

The concrete implementation is `StockfishAnalysisClient`. The interface exists
because React needs typed results and tests need a deterministic fake; it should
not acquire capabilities for hypothetical engines.

An engine-wide load or runtime error rejects `initialize` or the active
`analyse` promise with an `Error`. The hook converts that to panel state. Every
update includes both `requestId` and `fen`, making accidental cross-position
display harder even if a caller mishandles ordering.

The literal `1500` documents that this milestone has one policy rather than a
user setting. It may be represented by a shared constant instead if TypeScript
ergonomics make that clearer.

## 7. UCI lifecycle

UCI (Universal Chess Interface) is the line-oriented command protocol between a
chess user interface and an engine. Only `StockfishAnalysisClient` knows these
strings.

### Startup

1. Construct the Worker and attach message, error, and message-error handlers
   before sending commands.
2. Send `uci`.
3. Read identification and option lines until `uciok` arrives.
4. Send `isready`.
5. Wait for `readyok`; `initialize()` then resolves and the panel can report
   ready.

No `Threads` option is sent because the selected build is single-threaded. The
default one-PV behaviour is retained; setting `MultiPV` is unnecessary. A
startup watchdog should turn failure to receive `uciok`/`readyok` into a clear
error rather than leave the panel loading forever. Allow about 30 seconds for
the cold engine download and initialization, with the shorter ready check
covered by the same explicit state machine.

### Starting a search

Once ready and idle, the client sends:

```text
position fen <the complete six-field FEN>
go movetime 1500
```

Stockfish emits iterative `info` lines during the search. The client extracts
only the fields this milestone needs from lines containing the default
`multipv 1` (or no `multipv` field): `depth`, `score cp ...` or `score mate ...`,
and tokens following `pv`. Unknown fields are ignored. The final `bestmove`
line marks the end of that request; this milestone does not display or play the
best move separately.

The recommended limit is fixed wall-clock search time rather than fixed depth.
At 1.5 seconds it gives the user a useful iterative result while putting a
reasonable upper bound on how long an obsolete position occupies an ordinary
laptop. Different machines will reach different depths, which is why depth is
shown. Fixed depth makes result strength more comparable, but its elapsed time
can vary dramatically by position and device. User-configurable time, depth,
threads, hash, or strength controls are intentionally deferred.

### Stopping and cleanup

`stop(requestId)` sends `stop` only if that request owns the current engine
search. UCI still expects the search to terminate with `bestmove`; that line is
the safe boundary after which another `position`/`go` pair can begin.

`dispose()` marks the client disposed, clears watchdogs, rejects or resolves
pending work as interrupted, removes handlers, and calls `worker.terminate()`.
No callback is delivered after disposal. The application does not need to send
`quit` before terminating a browser Worker.

## 8. Analysis request lifecycle and stale-result protection

UCI output has no application request identifier. We must impose ordering at
the client boundary rather than infer ownership from the content of an `info`
line.

For the important A-then-B case:

1. The hook increments a monotonic request counter, records `{id: 1, fen: A}` as
   current, clears any previous displayed analysis, and calls `analyse(A)`.
2. The client starts A and records that raw Worker output currently belongs to
   request 1.
3. When the canonical position changes to B, the hook first records
   `{id: 2, fen: B}` as current and clears A's depth, score, and PV immediately.
   It then calls `stop(1)` and requests B.
4. The client sends `stop` for A but does **not** send B's `position` or `go`
   yet. It stores B as the latest pending request. If C arrives too, B is
   resolved as superseded and only C is retained.
5. Any remaining `info` lines before A's terminating `bestmove` are tagged with
   request 1 and FEN A. The hook compares both fields with its current request
   and ignores them.
6. On A's `bestmove`, the client resolves A as superseded, changes the output
   owner to the latest pending request, and only then sends that position and
   starts its search.
7. Updates for B carry request 2 and FEN B; only those can populate B's panel.

There are therefore two guards: strict UCI search serialization in the client,
and request/FEN comparison in React. The second guard is intentionally
redundant because showing a correct score beside the wrong position would be a
serious product error.

If `stop` does not produce `bestmove` within a short watchdog period (about one
second beyond the normal search limit), the client terminates the stuck Worker,
creates and initializes a fresh one, and starts only the latest pending request.
This costs another engine download/initialization in a rare failure case, but it
restores a known protocol boundary instead of guessing which search later lines
belong to.

React effect cleanup stops the effect's request. Component unmount disposes the
client and invalidates the current ID before teardown, so late promise
resolution cannot call `setState`. React Strict Mode may mount, clean up, and
mount effects again during development; correct cleanup must make that harmless.

This serialized design does not overlap searches. Starting B a little later is
the trade-off for unambiguous output ownership with a protocol that has no
request IDs. Multiple Workers would make cancellation easier to label but would
waste CPU and memory and allow obsolete searches to compete with the current
one.

## 9. Evaluation model

Application evaluations always use **White's perspective**, independent of
whose turn it is:

- positive means White is better or White is mating;
- negative means Black is better or Black is mating; and
- zero means equal.

This convention stays stable as the user moves forward through alternating
turns. Stockfish UCI search scores are relative to the side to move. The parser
therefore reads the FEN active-colour field and applies:

```text
white-relative score = UCI score × (+1 when White moves, −1 when Black moves)
```

The Stockfish source itself distinguishes its side-to-move internal evaluation
from White-relative presentation in its
[evaluation trace](https://github.com/official-stockfish/Stockfish/blob/master/src/evaluate.cpp).

Centipawn scores are stored as a signed integer (`whiteCentipawns`), preserving
the engine's exact reported unit without floating-point rounding. The UI divides
by 100 and always shows two decimal places and an explicit non-zero sign, for
example `+0.34`, `−1.27`, or `0.00`.

Mate scores use a signed integer (`whiteMateIn`). A positive value means White
can force mate in that many moves; a negative value means Black can. The UI
shows `+M3` for White mating and `−M3` for Black mating. Stockfish's UCI
formatter converts its internal mate distance from plies to moves before
emitting `score mate N`; the current implementation is visible in
[`src/uci.cpp`](https://github.com/official-stockfish/Stockfish/blob/master/src/uci.cpp).

An `info` line marked `lowerbound` or `upperbound` is not an exact score. For
this modest panel it is ignored, retaining the most recent exact score rather
than displaying a bound as certainty. Before a meaningful exact score arrives,
evaluation is `null` and the UI displays an em dash. A new position always
returns to that empty value before analysis starts.

## 10. Principal-variation conversion

The UCI parser returns the coordinate tokens after `pv`, such as `e2e4`,
`e7e5`, and `a7a8q`. It does not try to invent SAN from string patterns.

An ordinary chess-domain function in `src/chess/position.ts` performs the
conversion:

1. Construct a temporary `Chess` instance from the exact analysed FEN.
2. For each token, parse source square, target square, and optional promotion
   suffix (`q`, `r`, `b`, or `n`).
3. Ask `chess.js` to make that move on the temporary position.
4. Append the SAN returned by `chess.js`, then continue from the resulting
   position.

Replaying from the analysed FEN is essential: SAN depends on legal moves,
captures, ambiguity, check, and the current castling rights. `chess.js` therefore
handles castling (`O-O`/`O-O-O`), captures, checks, and promotion notation such
as `a8=Q+` correctly instead of us recreating chess notation rules.

Move numbers are included because they make even a short line much easier to
follow. The formatter reads the active colour and fullmove number from the FEN.
For a White start it produces, for example, `23. Rxd5 Qxd5 24. Qxd5`; for a
Black start it begins `23... Qxd5 24. Qxd5`. The number increments after each
Black move.

PV output is untrusted incremental text. If a token is malformed, incomplete,
or illegal when replayed, conversion stops at that token and preserves the
valid SAN prefix. It does not throw and does not attempt later tokens on a now-
unknown position. If the first token cannot be converted, the panel may show the
raw coordinate line as an explicitly marked fallback (`PV notation
unavailable`) so potentially useful engine output is not hidden. Raw UCI is
never the normal presentation. An absent or empty PV is shown as an em dash.

## 11. UI behaviour

Add one small `AnalysisPanel` next to the board on wide screens and below the
board/FEN controls on narrow screens. It contains only:

- **Engine:** `Loading`, `Ready`, `Analysing`, or `Error`;
- **Depth:** the latest current-position depth, or `—`;
- **Evaluation:** the White-relative display described above, or `—`; and
- **Best line:** one numbered SAN PV, or `—`.

The labels should make “positive is better for White” explicit near the
evaluation so users do not have to infer the convention.

On initial mount, the engine loads and then analyses the starting position.
While loading, the other values remain empty. When a valid FEN or board move
changes `positionFen`, the panel immediately clears values from the old FEN and
shows analysing for the new request. Iterative updates may replace depth,
evaluation, and PV as Stockfish searches. After `bestmove`, the result remains
visible for that FEN and engine state returns to ready.

Typing an unsubmitted FEN draft does not interrupt analysis. Submitting an
invalid FEN also leaves the current position and its analysis unchanged. The
panel is informational: it does not move pieces, modify FEN, or make engine
moves clickable.

An engine error is contained inside the panel. The board, promotion dialog, FEN
input, and legal-move behaviour continue working exactly as in Milestone 1.

## 12. Error handling

- **Worker fails to load:** catch the constructor failure and Worker `error` or
  `messageerror`; show an engine error without affecting position state.
- **Wasm fails to download or initialize:** reject initialization on Worker
  error or startup timeout. Mention that the engine could not start rather than
  exposing a stack trace in the UI.
- **Unsupported runtime:** check for `Worker` and `WebAssembly` before startup;
  show a concise unsupported-browser error. `SharedArrayBuffer` and
  `crossOriginIsolated` are not requirements for the chosen build.
- **Malformed or unexpected UCI:** pure parsers return “not relevant” or an
  invalid result. Unknown fields and lines are ignored, invalid numeric fields
  do not overwrite good state, and exceptions do not reach React. Development
  logging may retain the raw line for diagnosis, but raw protocol chatter is
  not shown to users.
- **Interrupted analysis:** an expected position change clears the old result
  and produces no error banner. Manual disposal resolves work as interrupted.
  A stop timeout triggers the Worker restart described above.
- **Runtime Worker failure during search:** reject the active request, discard
  pending analysis, terminate the Worker, and show error. Automatic retries are
  not added; reloading the page is an acceptable recovery for Milestone 2.
- **PV conversion failure:** keep the last valid SAN prefix, or use the clearly
  marked raw fallback only when no SAN token could be produced. Evaluation and
  depth can still display.

## 13. Testing strategy

Normal automated tests must not launch a full Stockfish search. Pure functions
and a scripted fake Worker/engine make the suite deterministic, fast, and able
to reproduce races reliably.

### UCI parsing: `src/engine/uci.test.ts`

- Parse depth, exact centipawn score, and PV from a representative `info` line.
- Parse a mate score and a line with fields in a different legal order.
- Treat omitted `multipv` as the primary line and ignore `multipv 2`.
- Ignore `lowerbound` and `upperbound` scores without losing the last exact
  score.
- Ignore identification, option, diagnostic, malformed-number, and unknown
  lines without throwing.
- Recognize `uciok`, `readyok`, and `bestmove` as lifecycle messages.

These tests prove tolerance of the extensible, line-oriented protocol without
coupling tests to internal helper calls.

### Evaluation normalization

Use explicit executable examples:

Use `4k3/8/8/8/8/8/8/4K3 w - - 0 1` for the White-to-move cases and the same
FEN with `b` as its active-colour field for the Black-to-move cases. The engine
scores are scripted parser inputs; the positions are not searched.

| FEN active colour | UCI score | Expected application evaluation        |
| ----------------- | --------- | -------------------------------------- |
| White             | `cp 34`   | `whiteCentipawns: 34` (`+0.34`)        |
| Black             | `cp 34`   | `whiteCentipawns: -34` (`−0.34`)       |
| White             | `mate 3`  | `whiteMateIn: 3` (`+M3`, White mates)  |
| Black             | `mate 3`  | `whiteMateIn: -3` (`−M3`, Black mates) |
| White             | `mate -2` | `whiteMateIn: -2` (`−M2`, Black mates) |
| Black             | `mate -2` | `whiteMateIn: 2` (`+M2`, White mates)  |

Also test zero and a malformed active-colour/FEN input at the domain boundary.
The paired White/Black cases are specifically intended to make a future
side-to-move sign regression obvious.

### PV conversion: `src/chess/position.test.ts`

- From `rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2`,
  convert `g1f3 b8c6 f1b5` to `2. Nf3 Nc6 3. Bb5`. This proves conversion
  starts from a non-starting position and respects its fullmove number.
- From `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1`,
  convert `e7e5 g1f3` to `1... e5 2. Nf3`. This proves a Black-to-move PV gets
  the correct leading ellipsis and next fullmove number.
- Convert kingside castling from
  `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1` and expect `1. O-O`.
- From `4k3/P7/8/8/8/8/8/4K3 w - - 0 1`, convert `a7a8q` to
  `1. a8=Q+`. This proves the UCI promotion suffix is applied before SAN is
  obtained.
- Feed a valid first move followed by an illegal or truncated token and verify
  that the valid SAN prefix is preserved and no exception escapes.
- Feed an invalid first token and verify the explicit fallback result.

These tests prove notation by replaying actual legal moves rather than testing a
home-grown notation formatter.

### Client lifecycle with a scripted Worker

Inject a minimal Worker-shaped test double into `StockfishAnalysisClient`:

- Verify `uci` → `uciok` → `isready` → `readyok` before any search starts.
- Verify one request sends the exact full `position fen ...` and
  `go movetime 1500` commands.
- Begin A, request B, emit another A `info` line, and prove it remains tagged A
  and cannot update B.
- Prove B's `position`/`go` are not sent until A emits `bestmove`.
- Request B and then C while A stops; prove B is superseded and only C starts.
- Simulate a missing `bestmove` after `stop`; with fake timers, prove the old
  Worker is terminated and only the latest request starts on a new initialized
  Worker.
- Dispose during initialization and during search; prove timers and Worker are
  cleaned up and no later update is emitted.
- Simulate Worker and startup errors and verify typed failures.

These are behavioural protocol-boundary tests. They do not assert private
method calls.

### React behaviour with a fake engine

Render the panel (or `App` where integration matters) with a deterministic fake
implementing `PositionAnalysisEngine`:

- Show loading, ready, analysing, iterative values, and completed values.
- On canonical FEN change, clear old depth/evaluation/PV immediately.
- Emit an update for the superseded request A after B is current and verify A is
  never rendered.
- Verify Black-to-move normalized values use the expected display sign.
- Reject engine startup and verify the error is contained while board and FEN
  interactions still work.
- Verify unmount stops/disposes the fake and late updates do not trigger React
  state changes.
- Verify editing or submitting an invalid FEN draft does not start analysis for
  that draft.

### Real-engine smoke check

Do not add Playwright or another browser framework solely for one smoke test.
The normal suite uses fakes. During implementation, run one separate browser
smoke check against the real Worker in Vite development and against `vite
preview`: wait for ready, analyse a known FEN, and confirm a non-null depth,
evaluation, SAN PV, and terminating ready state. If a browser test framework is
introduced for an independent reason later, this can become an opt-in
integration test rather than part of every unit-test run.

## 14. Manual browser checks

Run these in both `npm run dev` and the production output through `npm run
preview`:

1. With a normal connection, load the application and confirm the board is
   interactive during engine loading and analysis.
2. Confirm the starting position progresses through loading/analysing to a
   non-empty depth, White-relative evaluation, and numbered SAN line.
3. Make a legal move and confirm old values clear immediately and only the new
   position's analysis appears.
4. Move rapidly through at least three positions; confirm no old score or PV
   flashes beneath the current board.
5. Load a valid Black-to-move FEN and sanity-check that the sign convention is
   still “positive means White”.
6. Load a castling or promotion position and confirm PV notation is SAN if the
   engine selects the relevant move.
7. Type and submit an invalid FEN; confirm the board and current analysis remain
   intact.
8. In browser developer tools, block or rename the Stockfish asset; reload and
   confirm an engine error appears while board moves and FEN loading still work.
9. Use a narrow 320 CSS-pixel viewport and confirm the panel introduces no
   horizontal page scrolling.
10. Inspect the production network requests: the main application bundle must
    not contain the Wasm payload, and the Worker and Wasm URLs must resolve under
    the configured Vite base path.
11. Confirm the page does not depend on `crossOriginIsolated` and produces no
    `SharedArrayBuffer`/COOP/COEP error.
12. Confirm the Stockfish licence and exact corresponding-source information is
    accessible in the built distribution.

## 15. Acceptance criteria

Milestone 2 is complete when all of the following are true:

- A current Stockfish 18 lite single-thread build is reproducibly sourced from
  a pinned npm package and runs in a browser Web Worker.
- The Worker and Wasm assets load in Vite development and production preview,
  including when Vite's base path is not `/`.
- The implementation does not require Wasm threads, `SharedArrayBuffer`, or
  cross-origin-isolation headers.
- The initial canonical FEN and every subsequently committed valid FEN are
  automatically analysed for a fixed 1,500 milliseconds.
- The UI shows engine state, current depth, one White-relative centipawn or mate
  evaluation, and one numbered SAN PV.
- Positive/negative evaluation meaning is documented in the UI and remains
  stable when side to move changes.
- Castling and promotion coordinate moves can be converted through `chess.js`;
  malformed PV output degrades without crashing.
- Changing position clears the old display immediately, stops or supersedes the
  old request, and no delayed output from an earlier position is ever rendered
  for the current one.
- Searches are serialized across the UCI `bestmove` boundary, with a bounded
  Worker-restart fallback if stopping stalls.
- React components do not send, receive, or parse UCI strings, and
  `src/chess/position.ts` remains the application's direct `chess.js` boundary.
- Worker load, Wasm initialization, protocol, and runtime failures are contained
  in the analysis panel; the board and FEN editor remain usable.
- GPLv3 notices, exact engine provenance, and corresponding-source access are
  present in the distributable application.
- Deterministic automated tests cover parsing, both-side score normalization,
  mate signs, non-starting-FEN PVs, castling, promotion, stale results, teardown,
  errors, and React behaviour through a fake engine.
- The real-engine development and production-preview smoke checks pass.
- `npm run verify` passes: formatting, linting, tests, type checking, and the
  production build report no failures.
- `docs/architecture.md` and `docs/journal.md` describe the implemented result.

## 16. Explicit non-goals

- MultiPV or candidate-move comparison
- Evaluation bar or evaluation graph
- Board arrows or engine-move highlighting
- Clicking or automatically playing the PV
- Tactical, positional, or natural-language observations
- “What changed?” comparisons between positions
- PGN loading, game history, or whole-game analysis
- LLM integration
- Persistence, accounts, databases, backend services, or remote analysis
- Analysis caching or prefetching
- User-adjustable time, depth, threads, hash, skill, strength, or engine choice
- A threaded/full Stockfish build or cross-origin-isolation deployment work
- Mobile performance tuning beyond preserving a responsive, usable UI
- Automatic retries or offline/service-worker caching
- A generic multi-engine framework
