# Architecture

Chess Workbench is currently a single client-side React application written in
TypeScript and built by Vite. There is no backend, persistence, chess domain
logic, or engine integration in Milestone 0.

The browser loads `index.html`. Its module script loads `src/main.tsx`, which
mounts the root `App` component into the page and imports the global stylesheet.
Vitest and React Testing Library exercise the rendered interface in a simulated
browser DOM.
