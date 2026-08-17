# Chess Workbench

Chess Workbench is a personal chess-learning application. Milestone 0 contains
only the development skeleton; chess analysis features will be added in later
milestones.

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
