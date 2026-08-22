# Chess Workbench

Chess Workbench is a personal chess-learning application. It currently provides
an interactive board for loading FEN positions and making legal moves, plus
client-side Stockfish analysis showing depth, a White-relative evaluation, and
one human-readable principal variation.

## Prerequisites

- Node.js 24 LTS
- npm

With `nvm` installed, select the recorded Node version:

```bash
nvm use
```

Install dependencies with `npm install`.

Alternatively, the setup script selects the recorded Node version when nvm is
available and installs the dependencies:

```bash
./scripts/setup.sh
```

## Commands

| Command                | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start the Vite development server.          |
| `npm test`             | Run the test suite once.                    |
| `npm run test:watch`   | Rerun tests while files change.             |
| `npm run typecheck`    | Check TypeScript types.                     |
| `npm run lint`         | Check source code with ESLint.              |
| `npm run format`       | Format supported files with Prettier.       |
| `npm run format:check` | Verify formatting without changing files.   |
| `npm run build`        | Type-check and create the production build. |
| `npm run preview`      | Serve the production build locally.         |
| `npm run verify`       | Run every non-interactive quality check.    |

The complete verification suite also has a convenience wrapper that selects
the recorded Node version when nvm is available:

```bash
./scripts/verify.sh
```

## Application entry points

Vite serves `index.html`, which loads `src/main.tsx`. That module mounts the
root React component from `src/App.tsx` and loads the global stylesheet from
`src/index.css`.

The normalized FEN held by `App` is the current position. Chess rules and direct
`chess.js` use are contained in `src/chess/position.ts`, while
`src/components/PositionBoard.tsx` adapts the visual board to application events.

## Production deployment

The application is live at
[chess-workbench.cliesta.workers.dev](https://chess-workbench.cliesta.workers.dev/).
GitHub Actions runs the complete verification suite on every push, while
Cloudflare Workers Builds deploys `main` as static Vite assets.

See [docs/deployment.md](docs/deployment.md) for the reproducible build,
one-time setup, production checks, caching policy, and rollback procedure.
