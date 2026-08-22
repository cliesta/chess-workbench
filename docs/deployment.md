# Production deployment

Chess Workbench is a static Vite application deployed through Cloudflare Workers
Builds. GitHub is the canonical repository, `main` is the production branch, and
the stable production URL is:

<https://chess-workbench.cliesta.workers.dev/>

The project uses Cloudflare's Worker static-assets hosting but contains no
server-side Worker code. Stockfish's browser Web Worker still runs entirely on
the visitor's device. Cloudflare documents the current Git-connected process in
its [Workers Builds guide](https://developers.cloudflare.com/workers/ci-cd/builds/).

No backend, serverless function, API key, runtime environment variable, or
deployment secret is required.

## Reproducible build

Use Node 24, as recorded in `.nvmrc`:

```sh
nvm install
nvm use
npm ci
npm run verify
```

`npm run verify` checks formatting and linting, runs all tests and the TypeScript
checker, then creates the production build. Its successful completion leaves
the deployable output in `dist/`; a second build command is unnecessary.

The expected production shape is:

```text
dist/
├── index.html
├── _headers
├── assets/
│   ├── index-<content-hash>.js
│   └── index-<content-hash>.css
└── stockfish/
    └── 18.0.8/
        ├── stockfish-18-lite-single.js
        ├── stockfish-18-lite-single.wasm
        ├── Copying.txt
        └── SOURCE.txt
```

Application chunk names may vary. The invariant is that application assets are
content-hashed and the matching Stockfish loader, Wasm, licence, and provenance
files share the exact-version directory.

## GitHub Actions

`.github/workflows/verify.yml` runs `npm ci` and `npm run verify` for every push.
It intentionally has no deployment credentials or deployment steps.

Direct pushes to `main` are allowed. Run `npm run verify` locally before one:
Cloudflare and Actions may start at approximately the same time, so Actions is
independent feedback rather than a pre-deployment gate. A failing Actions run
makes that production deployment suspect and calls for a fix or rollback.

Branches are optional. Pushing one runs the same Action; Cloudflare version
previews can be used when an isolated production-like check is useful. Pull
requests and protected-branch rules are not required.

## Cloudflare Workers settings

The Git-connected Workers Builds project uses this build contract:

| Setting                | Value                                        |
| ---------------------- | -------------------------------------------- |
| Repository             | The public GitHub Chess Workbench repository |
| Production branch      | `main`                                       |
| Root directory         | Repository root / leave blank                |
| Build command          | `npm run build`                              |
| Build output directory | `dist`                                       |
| Node version           | Read from `.nvmrc` (`24`)                    |
| Environment variables  | None                                         |

Cloudflare installs dependencies from `package-lock.json` before invoking the
build. Vite's default base path `/` is correct for the `workers.dev` root, so no
special `base` setting is required. `_headers` files are supported by Workers
static assets as well as Pages, as documented in Cloudflare's
[static-assets migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#headers-and-redirects).

## Static assets and caching

The build hook copies the pinned `stockfish@18.0.8` loader and Wasm into
`stockfish/18.0.8/`, together with its GPLv3 text and a `SOURCE.txt` provenance
record. The browser Worker and visible source/licence link use this same
versioned base path.

`public/_headers` gives HTML `max-age=0, must-revalidate`. Content-hashed Vite
assets and exact-version Stockfish files use
`max-age=31536000, immutable`. A future Stockfish upgrade must change the pinned
npm version, the TypeScript asset path, the copy script's expected version and
provenance, and the matching `_headers` route. Changing the URL is what makes a
long cache lifetime safe.

The selected engine is single-threaded, so no SharedArrayBuffer, COOP, COEP, or
cross-origin-isolation headers are needed. The Wasm response must nevertheless
be served as `application/wasm`.

## Normal deployment

1. Run `npm run verify` locally.
2. Commit and push `main` to GitHub.
3. Confirm the GitHub Actions `Verify` run passes.
4. Confirm Cloudflare's independent build succeeds and publishes the same
   commit to the stable production URL.
5. Perform the production smoke checks below.

For an optional preview, use the version preview URL shown in the Cloudflare
deployment. A preview is not the stable production address.

## Production smoke checks

1. Open the production URL in a private window with a cold browser cache.
2. Confirm the dark application layout and starting board render correctly.
3. Play a legal move and verify the board and FEN update. Attempt an illegal move
   and verify the position remains unchanged.
4. Load a valid non-starting FEN. Then submit an invalid FEN and verify the valid
   position remains intact with validation feedback.
5. Confirm Stockfish progresses out of loading and displays depth, a
   White-relative evaluation or mate score, and a SAN best line.
6. Change positions several times rapidly and confirm analysis from an older
   position never replaces the current result.
7. Check a narrow viewport and confirm the board, FEN editor, promotion dialog,
   and analysis panel remain usable.
8. In developer tools, confirm the versioned Worker JavaScript and sibling Wasm
   requests return 200 from the same origin. Confirm the Wasm response has
   `Content-Type: application/wasm`.
9. Confirm HTML revalidates and the hashed application and versioned engine
   responses carry the intended one-year immutable cache policy. Reload and
   confirm the engine can be reused from browser cache.
10. Confirm the browser console contains no unexpected errors, failed requests,
    MIME warnings, or SharedArrayBuffer/cross-origin-isolation warnings.
11. Use developer-tools request blocking to block the Stockfish loader, clear
    site data, and reload. Repeat for the Wasm file. The analysis panel should
    show an error while board moves and FEN loading continue to work. Remove the
    block and reload to recover.
12. Open “Stockfish source and licence” and confirm `SOURCE.txt`, `Copying.txt`,
    the exact npm provenance, and both immutable corresponding-source links are
    accessible.

Headers can also be inspected without browser-cache effects:

```sh
curl -I https://chess-workbench.cliesta.workers.dev/index.html
curl -I https://chess-workbench.cliesta.workers.dev/assets/<built-file>.js
curl -I https://chess-workbench.cliesta.workers.dev/stockfish/18.0.8/stockfish-18-lite-single.js
curl -I https://chess-workbench.cliesta.workers.dev/stockfish/18.0.8/stockfish-18-lite-single.wasm
```

## Rollback

In the Cloudflare dashboard, open **Workers & Pages**, select the Worker, open
**Deployments**, use the menu beside the last known-good version, and select
**Rollback**. Then revert or fix the bad Git commit and push `main` through the
normal workflow. The dashboard rollback restores service; the Git correction
prevents a later build from reintroducing the fault. Cloudflare's
[Worker rollback documentation](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
is the authoritative UI reference.
