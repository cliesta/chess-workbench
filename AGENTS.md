# Chess Workbench – Agent Instructions

## Project intent

Chess Workbench is a personal chess-learning application.

Its purpose is not merely to expose Stockfish analysis. It should help an amateur chess player understand:

* what matters in a position;
* why a move is good or bad;
* what changed after a move;
* what tactical or positional pattern was missed;
* which mistakes recur across the player's games.

See `docs/product.md` for the full product vision.

## Development approach

Work incrementally.

Implement only the milestone currently requested. Do not add features from later milestones merely because they appear in the product document.

Prefer small, understandable changes over ambitious speculative architecture.

The human owner is deliberately using this project to learn modern web development. Code should therefore be straightforward enough to explain and review.

## Technical direction

Unless explicitly changed:

* React
* TypeScript
* Vite
* client-side application first
* chess rules/domain logic independent of React where practical
* Stockfish will eventually run client-side in a Web Worker
* no backend until explicitly required
* no accounts, database or cloud persistence in early milestones

## Architecture principles

Prefer boring architecture.

Do not create abstractions until they have a clear purpose.

Keep distinct concerns separate:

* UI rendering
* application state
* chess domain/rules
* engine integration
* position analysis/feature detection

React components should not eventually communicate directly with Stockfish/UCI. Engine-specific details should live behind a clear boundary.

Do not introduce global state-management libraries unless ordinary React state has demonstrably become inadequate.

Avoid premature frameworks, dependency injection systems, plugin architectures, generic repositories, factories or other infrastructure without a concrete need.

## Dependencies

Do not add a dependency merely to save a small amount of code.

Before adding a significant dependency:

1. explain what problem it solves;
2. explain why writing the required functionality ourselves is inappropriate;
3. prefer widely used, maintained libraries with narrow responsibilities.

Do not replace an existing dependency without discussing the reason first.

## Testing

Non-trivial chess/domain logic should be testable independently of the UI.

For analysis rules, prefer executable examples based on known positions:

* positive cases;
* negative cases;
* useful boundary cases.

Tests should assert behaviour and outcomes, not implementation details such as internal function calls.

Do not create tests whose main purpose is increasing coverage numbers.

## Quality gates

Before declaring an implementation task complete:

* run the tests;
* run the TypeScript type checker;
* run the production build;
* run linting if configured;
* report any remaining warnings or known limitations.

Do not claim success if these checks fail.

## Code changes

Keep changes within the requested scope.

Do not silently perform large refactors unrelated to the task.

Do not rewrite working code just to impose a preferred style.

When changing an architectural boundary, explain why.

## Documentation

Keep `docs/architecture.md` consistent with the architecture that actually exists.

Record genuinely consequential decisions under `docs/decisions/` when useful. Keep decision records short and practical.

Do not document obvious implementation details merely for completeness.

## Interaction with the owner

When asked to plan:

* inspect the existing repository first;
* propose the simplest reasonable implementation;
* identify important decisions or trade-offs;
* explain unfamiliar web concepts where they matter;
* do not modify files until explicitly asked to implement.

When implementing:

* make reasonable local implementation decisions autonomously;
* stop and surface architectural choices that would materially constrain future work;
* do not expand scope.

In the completion summary, explain:

* what changed;
* why it was implemented that way;
* what tests/checks were run;
* anything the owner should understand before moving on.
