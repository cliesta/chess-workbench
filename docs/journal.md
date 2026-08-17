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
