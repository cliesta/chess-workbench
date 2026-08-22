# Milestone 3 — Production deployment

## 1. Goal

Publish the current Chess Workbench at a stable public URL and verify that the
existing board/FEN editor and client-side Stockfish analysis behave correctly
in a real production environment.

This milestone establishes a reproducible path from a Git commit to a static
production deployment. It adds no chess capability.

## Implementation outcome

Milestone 3 was completed on 2026-08-22 at
<https://chess-workbench.cliesta.workers.dev/>. Cloudflare's current repository
import flow produced a Workers Builds static-assets deployment rather than the
proposed Pages deployment. The owner approved that small platform variation.
There is no application-authored server-side Worker or function, and all scope,
cost, caching, Git deployment, failure-isolation, and client-only architecture
goals remain unchanged.

The production commit `39ab4eb` passed GitHub Actions. HTTP validation confirmed
that the deployed HTML, JavaScript, CSS, Stockfish loader, Wasm, and licence
match the locally verified production build; Wasm uses `application/wasm`; and
the approved cache headers are active. The owner completed and confirmed the
interactive board, FEN, engine, stale-result, narrow-layout, console, and engine-
failure checks. Current operating instructions are in `docs/deployment.md`; the
remainder of this document records the approved design and hosting research.

## 2. Scope

- Choose one static host and configure one production site.
- Move the repository from self-hosted GitLab to a public GitHub repository used
  by both CI and deployment; do not maintain a mirror.
- Add one GitHub Actions workflow that runs the existing quality gate.
- Build and publish the application from the production branch.
- Give long-lived Stockfish assets an upgrade-safe, versioned URL.
- Configure simple browser cache headers for HTML, Vite assets, and Stockfish
  assets.
- Keep the existing Stockfish licence, version, provenance, and corresponding
  source information publicly reachable.
- Validate the board, FEN editor, Worker, Wasm engine, stale-result protection,
  responsive layout, and graceful engine failure at the deployed URL.
- Document normal deployment and rollback, then update the architecture and
  journal after the deployment succeeds.

The intended production branch is `main`. A successful deployment of `main` at
the host-assigned stable URL is production. Other branches may produce preview
URLs when they are useful, but branches and pull requests are not mandatory.

## 3. Hosting comparison and recommendation

All three candidates can serve a Vite application's static HTML, JavaScript,
CSS, Web Worker loader, and Wasm file. None requires a serverless function for
this application.

| Concern             | Cloudflare Pages                                                     | Vercel                                                                              | Netlify                                                                    |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Vite static build   | `npm run build`, output `dist/`                                      | First-class Vite support                                                            | Detects Vite; normally `npm run build`, output `dist/`                     |
| Git workflow        | GitHub or hosted GitLab; **not self-hosted GitLab**                  | Broad Git integration, including documented self-managed GitLab support             | Git providers supported; self-hosted Git requires a custom provider app    |
| Personal free tier  | 500 builds/month; static asset requests are free and unlimited       | Hobby is suitable for personal use, with usage limits                               | 300-credit monthly model; production deploys and bandwidth consume credits |
| Engine asset fit    | 25 MiB maximum per file; the current approximately 7.3 MiB Wasm fits | 100 MiB static-file limit on Hobby; it fits                                         | It fits, but repeated cold Wasm downloads consume bandwidth credits        |
| Response headers    | A static `_headers` file                                             | `vercel.json`                                                                       | `_headers` or `netlify.toml`                                               |
| Previews            | Per branch/PR and immutable deployment URL                           | Per branch/PR                                                                       | Deploy Previews and branch deploys                                         |
| Rollback/history    | Roll back to a previous successful production deployment             | Hobby instant rollback is limited to the immediately previous production deployment | Publish a previous atomic deploy from deploy history                       |
| Custom domain later | Supported; not needed now                                            | Supported; not needed now                                                           | Supported; not needed now                                                  |
| Complexity here     | Low after GitHub setup                                               | Low                                                                                 | Low to moderate because usage is credit-based                              |

The supporting platform details come from the current official documentation:

- Cloudflare documents its [Git integration and self-hosted limitation](https://developers.cloudflare.com/pages/configuration/git-integration/),
  [Pages limits](https://developers.cloudflare.com/pages/platform/limits/),
  [free static asset delivery](https://developers.cloudflare.com/pages/functions/pricing/),
  [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/),
  [rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/),
  and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
- Vercel documents its [Git behaviour](https://vercel.com/docs/git),
  [Hobby plan](https://vercel.com/docs/plans/hobby),
  [platform limits](https://vercel.com/docs/limits), and
  [instant rollback](https://vercel.com/docs/instant-rollback).
- Netlify documents its [Vite setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/),
  [credit model](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/),
  [deploy types](https://docs.netlify.com/deploy/deploy-overview/),
  [rollback mechanism](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/),
  and [self-hosted Git setup](https://docs.netlify.com/build/git-workflows/repo-permissions-linking/).

### Recommendation: Cloudflare Pages

Use Cloudflare Pages. It is a particularly good fit for a static personal site
whose largest resource is a Wasm file: delivery of static assets is not metered
against a request quota, the current engine is well below its per-file limit,
cache headers are simple, previews are built in, and free-plan rollback history
is more useful than Vercel Hobby's one-step rollback. Its Vite configuration is
only a build command and an output directory.

There is one material prerequisite. The current `origin` is a self-hosted
GitLab instance (`gitlab.cliesta.com`), which Cloudflare Pages cannot connect to
directly. This milestone also explicitly calls for GitHub Actions. The smallest
coherent setup is therefore to create a GitHub repository, make it the canonical
repository for this deployment workflow, and connect Cloudflare Pages to it.
The repository is expected to be public. The old self-hosted GitLab remote will
be replaced rather than mirrored: maintaining automated mirrors or a second
deployment provider would add operational ambiguity and is not proposed.

Vercel would be the fallback if retaining self-hosted GitLab as the canonical
repository mattered more than the requested GitHub Actions workflow. Netlify's
custom self-hosted integration and current credit accounting make it less
attractive for this small, download-heavy static application.

## 4. Reproducible production build

The repository currently requires Node 24 through both `.nvmrc` and
`package.json`. Cloudflare Pages should use its current build image and read the
checked-in `.nvmrc`; Cloudflare documents `.nvmrc` as a supported way to
[pin Node on Pages](https://developers.cloudflare.com/pages/configuration/build-image/).

From a clean checkout, the reproducible local process is:

```sh
nvm install
nvm use
npm ci
npm run verify
```

`npm ci` is correct for CI and production because it requires the checked-in
lockfile to agree with `package.json`, installs that exact dependency graph,
and does not rewrite the lockfile. `npm install` remains the command for an
intentional dependency change. GitHub's Node workflow guidance likewise uses
[`npm ci` for locked dependency installation](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

`npm run verify` is the repository's actual quality gate. It currently runs, in
order:

1. Prettier check;
2. ESLint;
3. Vitest;
4. TypeScript checking; and
5. the production build.

The final step invokes `npm run build`, whose `prebuild` hook runs
`prepare:stockfish`. That script copies the pinned Stockfish distribution from
`node_modules` before `tsc -b && vite build`. Thus a successful verification
already leaves the deployable `dist/`; running `npm run build` again is not
needed locally.

Cloudflare should independently run:

- build command: `npm run build`;
- output directory: `dist`;
- production branch: `main`;
- root directory: repository root.

Pages automatically installs dependencies before invoking the build command.
Its current build-image documentation describes that installation as
[`npm install`](https://developers.cloudflare.com/pages/configuration/build-image/#frameworks).
That command still consumes the committed lockfile, but `npm ci` is stricter and
is therefore retained for the developer and GitHub Actions quality gates. We
should not add `SKIP_DEPENDENCY_INSTALL` and duplicate installation inside the
Cloudflare build command merely to make the command spelling identical.

Cloudflare runs the production build independently while GitHub Actions runs the
full verification suite. In this deliberately lightweight solo workflow, the
Action is feedback rather than a technical pre-deployment gate: a direct push to
`main` can start both jobs at roughly the same time. Running `npm run verify`
locally before pushing `main` is therefore the normal safety check. If the
Action later fails, the deployment is suspect and should be fixed or rolled
back. Keeping the systems independent also means no Cloudflare credential needs
to be stored in GitHub Actions.

After the caching change described below, `dist/` should contain at least:

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

Exact application chunk names may vary. The required invariant is that Vite's
application assets are content-hashed and that the coupled Stockfish loader and
Wasm file are present together at the versioned path expected by the client.

No environment variables or secrets are required. In particular, a Vite
variable prefixed with `VITE_` would be compiled into public client code and
must never be treated as a secret.

Cloudflare serves the application at `/` on its assigned `*.pages.dev` origin.
Vite's default `base: "/"` is therefore correct and no explicit `base`
configuration should be added. The engine URL should continue to use
`import.meta.env.BASE_URL`; that preserves correct URL construction without
making subpath hosting a Milestone 3 requirement. A special subpath build is
not worth adding to CI when the chosen production topology is root-hosted; the
deployed root URL is the relevant test.

## 5. Stockfish production delivery

Stockfish remains the lite, single-threaded Stockfish.js 18 build selected in
Milestone 2. It uses a classic same-origin Web Worker and Wasm, not Wasm threads,
so `SharedArrayBuffer`, cross-origin isolation, COOP, and COEP headers are still
unnecessary.

Production validation must establish all of the assumptions that local Vite
development cannot prove:

- The Worker request resolves beneath the deployed root and returns the actual
  JavaScript loader rather than an HTML fallback.
- The loader resolves its sibling `.wasm` URL successfully.
- The Wasm response has `Content-Type: application/wasm`.
- A cleared-cache first visit has a visible loading period but leaves the board
  and FEN editor responsive while the engine downloads and initializes.
- A repeat visit reuses the cached, versioned engine resources.
- Analysis at the final `https://<project>.pages.dev/` URL reaches a depth,
  evaluation, and SAN principal variation.
- Several rapid legal moves or FEN submissions never allow an older request's
  result to replace analysis for the current position.
- Blocking either engine asset produces the existing analysis error state but
  does not break board moves or FEN loading.

Cloudflare infers static content types from file extensions and supports custom
headers through a [`public/_headers` file copied into the build](https://developers.cloudflare.com/pages/configuration/headers/).
The milestone should verify the response rather than rely only on that
documentation.

## 6. Cache policy

Use one simple policy:

| Resource              | Browser policy                        | Reason                                                                               |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `/` and `index.html`  | `public, max-age=0, must-revalidate`  | The small entry document should check for a new deployment before naming its assets. |
| `/assets/*`           | `public, max-age=31536000, immutable` | Vite changes content hashes when application JS or CSS changes.                      |
| `/stockfish/18.0.8/*` | `public, max-age=31536000, immutable` | The versioned directory is immutable and the large engine should be reused.          |

These browser headers should be expressed in `public/_headers`; Vite will copy
that file to `dist/`. Cloudflare's own edge cache and ETags can remain at their
platform defaults. Cloudflare's serving documentation explains its
[default revalidation and static asset caching behaviour](https://developers.cloudflare.com/pages/configuration/serving-pages/).

The existing Stockfish filenames are not content-hashed, and the path currently
contains only the major engine version. Before long-lived caching is enabled,
the copy script and client URL should place them below the exact installed npm
package version, currently `stockfish/18.0.8/`. A future package upgrade must
change that directory at the same time as the pinned dependency and generated
provenance. The new application bundle then refers to a new URL, so clients
cannot retain an old loader or Wasm under the new version. No cache purge,
manifest, or service worker is needed.

The loader and Wasm are a matched pair and must always be upgraded together.
Cloudflare Pages deployments are atomic, so `index.html` and its referenced
versioned assets come from one deployment.

## 7. Stockfish licence and corresponding source

The deployed versioned engine directory must publicly expose:

- `Copying.txt`, the GPLv3 licence distributed by the pinned npm package;
- `SOURCE.txt`, naming `stockfish` npm package version 18.0.8 and Stockfish 18;
- the exact immutable Stockfish.js source archive/tag used for that package;
- the exact immutable upstream Stockfish 18 source archive/tag; and
- the existing visible “Stockfish source and licence” link in the analysis
  panel, updated to the versioned path.

The production checklist must open the visible link and each referenced source
URL. It must also confirm that `Copying.txt` and `SOURCE.txt` are present in
`dist/` before deployment and return successfully from the public site. The
files should be deployed alongside the corresponding executable rather than
depending on an unpinned default branch.

This implements the distribution approach already approved in Milestone 2. It
does not attempt a broader legal conclusion about the application's licence.
Stockfish's own licence explanation says a distribution must include the full
source or a pointer to source capable of generating the exact binary; the
versioned `SOURCE.txt` supplies immutable pointers rather than an unpinned
branch. The relevant upstream references remain the
[Stockfish licence statement](https://stockfishchess.org/about/) and
[GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).

## 8. Continuous integration

Add one workflow at `.github/workflows/verify.yml`:

```yaml
name: Verify

on:
  push:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run verify
```

There is intentionally one operating system and one Node version: it checks the
environment the project claims to support without introducing a matrix. npm
caching is an install-speed optimization, not an artifact cache; `npm ci`
remains authoritative.

The workflow runs for every pushed branch, including direct pushes to `main`.
There is no mandatory pull request, protected-branch rule, or required status
check for this solo project. A branch can still be pushed when a change would
benefit from an isolated Actions result or Cloudflare preview.

Production does not wait for GitHub Actions mechanically. Cloudflare watches
`main` and may build it as soon as it is pushed. The production commit must
still finish with a passing Actions run for the milestone to be considered
healthy. This trades enforced sequencing for a much simpler daily workflow;
local verification and the documented rollback procedure are the safeguards.

Cloudflare should build directly from Git rather than receive a `dist/` artifact
from Actions. Artifact deployment would require Cloudflare API credentials,
extra workflow steps, and ownership of retention and retry behaviour, with no
benefit for this static site. It is acceptable that Actions verifies a build
and Cloudflare independently reproduces it.

## 9. Deployment workflow

### One-time setup in web interfaces

1. Create a public GitHub repository.
2. Push the existing history, replace the self-hosted GitLab `origin` with the
   GitHub URL, and treat GitHub as the sole canonical remote.
3. Create a Cloudflare account/project, install the Cloudflare GitHub App with
   access only to this repository, and select `main` as production.
4. Configure `npm run build`, `dist`, and the repository root; confirm that
   Cloudflare reads Node 24 from `.nvmrc`.
5. Choose the project name carefully because it determines the initial stable
   `<project>.pages.dev` URL.

No CLI is required for the one-time setup or normal deployment.

### Normal change

1. Run `npm run verify` locally before a production push.
2. Commit the focused change and push `main` to GitHub.
3. GitHub Actions runs `npm run verify`, while Cloudflare independently builds
   the same `main` commit and publishes it to the stable `*.pages.dev` URL.
4. Confirm the Actions run and Cloudflare build both pass, then run the concise
   production smoke checks and record the deployment in the journal.

For a riskier or experimental change, optionally push a branch first. GitHub
Actions will verify that push and Cloudflare can provide a distinct preview URL.
A pull request may be used when it adds value, but neither a PR nor a branch is
required for routine solo changes.

Cloudflare preview URLs are useful for checking the real CDN, response headers,
Worker, and Wasm before production, but they are not production and should not
be shared as the stable application address.

### Rollback

For a bad production deployment, use the Cloudflare Pages dashboard's
deployment history to roll back immediately to the last known-good successful
production deployment. Then revert or fix the offending Git commit through the
normal workflow. Dashboard rollback restores service; the Git change
prevents the next production build from reintroducing the fault. A CLI rollback
path is unnecessary for this milestone.

## 10. Public URL, repository exposure, and secrets

The first stable public URL should be Cloudflare's
`https://<approved-project-name>.pages.dev/`. A custom domain can be added later
without changing the application architecture, but is not part of this
milestone.

The application requires no accounts, API keys, backend credentials, build-time
secrets, or runtime environment variables. All shipped client JavaScript,
Worker code, Wasm, licence text, and provenance are intentionally downloadable
by visitors. Minification does not make frontend code secret. Repository
visibility is therefore an owner/workflow decision, not a mechanism for hiding
client-side secrets.

## 11. Manual production checklist

Run this checklist first on the Cloudflare preview and then, in concise form,
on the production URL:

1. Open a private/incognito window with site data and browser cache clear. Load
   the HTTPS URL and confirm there is no blank or mixed-content state.
2. Confirm the board, controls, dark layout, and starting FEN render correctly.
3. Play a legal move and confirm the board and FEN update. Attempt an illegal
   move and confirm the position does not change.
4. Submit a valid non-starting FEN and confirm it becomes the board position.
   Submit an invalid FEN and confirm the existing position remains intact with
   useful validation feedback.
5. Confirm the analysis panel progresses from loading to analysis and displays
   a depth, White-relative evaluation or mate score, and human-readable SAN PV.
6. Change the position several times quickly. Confirm no depth, score, or PV
   from an older position appears after the newest analysis begins.
7. Resize to a narrow phone-sized viewport. Confirm the board, FEN input,
   promotion choice when exercised, and analysis panel remain usable without
   destructive horizontal overflow.
8. In browser developer tools, confirm the Worker `.js` and sibling `.wasm`
   requests return 200 from the expected versioned, same-origin URLs. Confirm
   the Wasm response is `application/wasm`.
9. Inspect response headers: HTML must revalidate; hashed application assets
   and versioned Stockfish assets must have the intended one-year immutable
   browser policy. Reload and confirm the large engine is served from browser
   cache or transfers no body where the browser reports that clearly.
10. Inspect the console for unexpected errors, rejected Worker creation,
    incorrect MIME warnings, missing source maps, SharedArrayBuffer warnings,
    and failed resources. Expected diagnostics from the deliberate failure test
    do not count as unexpected.
11. Use developer-tools request blocking for the Stockfish loader, clear site
    data, and reload. Repeat for the Wasm file. In each case the panel must show
    an engine error while legal board moves and FEN submission still work.
    Remove the block and confirm a reload recovers.
12. Open the visible Stockfish source/licence link. Confirm `SOURCE.txt`,
    `Copying.txt`, and both exact source archive links are accessible.

For a header check independent of browser caching, use `curl -I` against
`index.html`, one hashed application asset, the Stockfish loader, and the Wasm
URL. Browser developer tools remain necessary to prove the loader's actual URL
resolution and application behaviour.

## 12. Acceptance criteria

Milestone 3 is complete when all of the following are true:

- Cloudflare Pages is the single configured production host.
- The application is reachable at one stable public `*.pages.dev` URL over
  HTTPS.
- A clean Node 24 checkout can run `npm ci` and `npm run verify` successfully,
  producing the documented `dist/` contents.
- The GitHub Actions `verify` workflow runs on pushes and passes for the
  production commit; no mandatory pull-request or protected-branch gate is
  required.
- Cloudflare independently builds `main` with `npm run build` and publishes
  only `dist/`.
- Board interaction, legal/illegal move behaviour, and valid/invalid FEN
  handling pass at the production URL.
- Stockfish initializes and production analysis displays depth, evaluation,
  and a SAN PV.
- Rapid position changes do not show stale engine results.
- The Worker and Wasm use the expected versioned same-origin URLs, return
  successfully, and the Wasm response uses `application/wasm`.
- HTML revalidates, while hashed application assets and exact-version
  Stockfish assets have long-lived immutable browser caching.
- A blocked or failed engine asset degrades to a working board/FEN editor and
  an analysis error rather than breaking the application.
- The narrow-screen layout is usable and the production console has no
  unexpected errors.
- Stockfish licence information, exact version/provenance, and corresponding
  source links are publicly accessible alongside the deployed engine.
- The normal preview/production procedure and Cloudflare dashboard rollback
  procedure have both been documented and understood.
- `docs/architecture.md`, the project-facing deployment instructions, and
  `docs/journal.md` reflect the production system and actual public URL.

## 13. Explicit non-goals

- MultiPV
- Evaluation bar
- PV exploration
- PGN import or game analysis
- Tactical or positional analysis
- Natural-language or LLM integration
- Persistence
- Backend or serverless functions
- Accounts or authentication
- Analytics or telemetry
- A custom domain
- Multiple hosting providers or a provider-neutral deployment layer
- Service workers or offline support
- User-adjustable engine settings
- Performance work unrelated to proving production correctness

## Decisions requiring owner approval

The technical choices are approved. The remaining owner actions are:

1. Choose the GitHub owner/repository name, create the empty public repository,
   and provide its URL (or authorize creation through an authenticated CLI).
2. Choose the Cloudflare Pages project name that will form the stable
   `<project>.pages.dev` URL.
3. Sign in to or create the Cloudflare account and authorize the Cloudflare
   GitHub App for this repository when the implementation is ready to deploy.
