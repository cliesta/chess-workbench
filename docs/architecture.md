# Architecture

Chess Workbench is a single client-side React application written in TypeScript
and built by Vite. There is no backend, persistence, or chess-engine integration.

The browser loads `index.html`. Its module script loads `src/main.tsx`, which
mounts the root `App` component into the page and imports the global stylesheet.
Vitest and React Testing Library exercise the rendered interface in a simulated
browser DOM.

## Position editing

The normalized, full FEN string in `App` is the authoritative representation of
the current position. The editable FEN draft and a pending promotion choice are
separate UI state; the board component and mutable library objects are not
additional sources of truth.

`src/chess/position.ts` is the boundary around `chess.js` and the only
application module that imports it. It supplies the starting FEN, validates and
normalizes submitted FEN, and applies legal moves. Each operation creates a
short-lived chess object and returns an explicit result to React.

`PositionBoard` adapts `react-chessboard` events to application callbacks and
contains no rules. `PromotionDialog` collects the user's promotion choice.
`App` coordinates those components and updates canonical state.
