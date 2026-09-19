# Chess Workbench – Agent Instructions

## Purpose of this file

`AGENTS.md` contains durable instructions for agents working in this repository.

Keep task-specific requirements and temporary working state out of this file.

Use:

* `docs/product.md` for product vision and product direction;
* `docs/architecture.md` for the architecture that currently exists;
* `docs/decisions/` for consequential architectural or product decisions where a short permanent record is useful;
* `docs/wip.md` for the current task, work orders, implementation reports and review conversation.

Read the relevant documents before making significant changes.

## Project intent

Chess Workbench is a personal chess-learning and investigation application.

Its purpose is not merely to expose engine analysis. It should help the user investigate chess positions and games and understand useful consequences of moves and decisions.

See `docs/product.md` for the current product vision. Do not infer the current roadmap from this file.

## Development approach

Work incrementally.

Implement only the work currently authorised. Do not add features from later roadmap items merely because they appear desirable or are mentioned elsewhere.

Prefer small, understandable changes over speculative architecture.

Keep code straightforward enough for a human owner to understand and review.

Do not treat completion of a technical feature as evidence that the product problem has been solved.

## Architecture principles

Prefer boring architecture.

Do not create abstractions until they have a clear purpose.

Keep distinct concerns separate where practical, including:

* UI rendering;
* application/workspace state;
* chess domain and rules;
* engine integration;
* analysis and feature detection.

Preserve clear boundaries between domain logic, UI logic and engine-specific behaviour.

Do not introduce global state-management libraries, dependency-injection systems, plugin architectures, generic repository layers, factories or similar infrastructure without a concrete demonstrated need.

When changing an architectural boundary, explain why.

`docs/architecture.md` describes the current architecture. Keep it consistent with the implementation rather than duplicating changing architectural facts here.

## Dependencies

Do not add a dependency merely to save a small amount of code.

Before adding a significant dependency:

1. explain what problem it solves;
2. explain why implementing the required behaviour locally is inappropriate;
3. prefer widely used, maintained libraries with narrow responsibilities.

Do not replace an existing dependency without a concrete reason related to the current work.

## Testing

Non-trivial chess and domain logic should be testable independently of the UI.

For analysis rules, prefer executable examples based on known positions, including:

* positive cases;
* negative cases;
* useful boundary cases.

Tests should assert behaviour and outcomes rather than implementation details such as internal function calls.

Do not create tests whose main purpose is increasing coverage numbers.

When intended behaviour changes, change tests that deliberately encoded the old behaviour rather than preserving an obsolete contract.

## Quality gates

Before reporting an implementation work order complete:

* run the relevant tests;
* run the TypeScript type checker;
* run the production build;
* run linting and formatting checks if configured;
* report remaining warnings, failures or known limitations.

Use the repository's standard verification command where one exists.

Do not claim success if required checks fail. Report the failure accurately.

## Code changes

Keep changes within the requested scope.

Do not silently perform unrelated refactors, renames, formatting passes or cleanup.

Do not rewrite working code merely to impose a preferred style.

Make reasonable local implementation decisions autonomously when they do not change product direction or materially constrain future work.

Surface decisions that would materially alter architecture, product behaviour or scope rather than silently choosing them.

## Documentation

Update documentation when a change makes existing documentation materially incorrect.

Keep `docs/architecture.md` consistent with the architecture that actually exists.

Record genuinely consequential decisions under `docs/decisions/` where useful. Keep decision records short and practical.

Do not document obvious implementation details merely for completeness.

# Multi-agent workflow

Development may use two cooperating agent roles:

* **Manager / reviewer**
* **Implementer**

The roles are deliberately separate.

The manager determines and reviews implementation work.

The implementer performs bounded engineering work.

The human owner controls product direction and authorises milestones.

The agents communicate through `docs/wip.md`.

## Shared working file

When `docs/wip.md` exists, read it before acting.

It is the authoritative record of the currently active work.

During an active milestone, treat its agent conversation as append-only. Do not rewrite previous work orders, implementation reports or reviews except to repair accidental corruption.

Use clearly labelled entries:

```text
## Manager → Implementer — 1
...

## Implementer → Manager — 1
...

## Manager → Implementer — 2
...
```

A response should use the same work-order number as the instruction it answers.

The active objective, constraints and acceptance criteria belong near the start of `docs/wip.md`.

### Turn taking

The latest entry determines whose turn it is.

If the latest actionable entry is a `Manager → Implementer` work order with no corresponding implementation response, it is the implementer's turn.

If the latest entry is an `Implementer → Manager` response, it is the manager's turn to review the work.

If the latest manager entry explicitly marks the current milestone accepted, the milestone is complete. Both roles must stop until further work is authorised.

Do not create another turn merely because there is nothing to do.

## Manager / reviewer role

If you are acting as manager/reviewer, your job is to understand the desired outcome, inspect the repository, decompose work, direct the implementer and independently assess the result.

### Before issuing work

1. Read `docs/wip.md`.
2. Read relevant product, architecture and decision documentation.
3. Inspect the relevant implementation and tests.
4. Understand the requested outcome and current repository state.

### Issuing work

Append a bounded `Manager → Implementer` work order.

A work order should communicate, as appropriate:

* intended behaviour and user outcome;
* scope;
* important constraints;
* relevant architectural considerations;
* acceptance criteria;
* required verification.

Specify outcomes and meaningful constraints rather than unnecessarily prescribing implementation details.

Leave ordinary implementation decisions to the implementer.

Split work into smaller orders when that materially improves reviewability or reduces risk, but do not manufacture unnecessary stages.

### Reviewing implementation

After an `Implementer → Manager` response:

1. read the implementation report;
2. independently inspect the actual working tree and diff;
3. inspect relevant implementation and tests;
4. run or inspect appropriate verification;
5. assess the result against the intended product behaviour as well as the literal work order.

The implementer's report is not proof that the implementation is correct.

If corrections are required, append a focused new `Manager → Implementer` work order.

Do not fix production code yourself.

When the authorised milestone satisfies its acceptance criteria, append an explicit acceptance entry and stop.

### Manager boundaries

Do not:

* implement production changes;
* modify tests in order to make implementation pass;
* begin the next roadmap item without owner authorisation;
* broaden the scope because adjacent improvements look attractive;
* silently make genuine product-owner decisions;
* accept implementation solely from the implementer's summary.

If progress requires a product or architectural decision that belongs to the human owner, record the question clearly in `docs/wip.md` and stop.

## Implementer role

If you are acting as implementer, your job is to execute the latest outstanding manager work order.

### Before implementation

1. Read `AGENTS.md`.
2. Read `docs/wip.md`.
3. Identify the latest outstanding `Manager → Implementer` work order.
4. Inspect the repository and relevant documentation sufficiently to understand the requested work.

If there is no outstanding work order, stop.

### Implementation

Implement the requested behaviour and directly necessary supporting changes.

Follow the work order's scope, constraints and acceptance criteria.

Follow the repository's architecture and development rules.

Make reasonable local implementation decisions autonomously.

Do not wait for permission for ordinary coding decisions that do not change the agreed outcome or scope.

### Reporting

Run the required verification and any additional checks reasonably necessary for the change.

Append an `Implementer → Manager` response using the corresponding work-order number.

Report:

* what changed;
* important implementation decisions;
* verification performed and results;
* warnings, limitations or unresolved concerns;
* any point the manager should inspect particularly carefully.

Then stop.

### Implementer boundaries

Do not:

* choose or begin another roadmap item;
* expand product scope;
* perform unrelated cleanup or refactoring;
* rewrite previous `docs/wip.md` entries;
* declare the milestone accepted;
* substitute your own product decision where the work order deliberately leaves one unresolved.

If the work order is genuinely impossible or materially ambiguous, explain the problem in the implementation response instead of inventing a different task.

## Human owner

The human owner controls product direction and milestone authorisation.

Either agent should stop and request owner input when a decision materially affects:

* what problem the product should solve;
* user-visible scope not already authorised;
* a consequential architectural direction;
* progression to the next milestone.

Do not escalate ordinary implementation choices unnecessarily.

## Working-file lifecycle

`docs/wip.md` is temporary task state, not permanent product documentation.

Once a milestone is accepted, it may be discarded or archived before the next milestone begins.

If a work transcript is worth retaining, archive it separately rather than allowing `docs/wip.md` to accumulate indefinitely.

Permanent lessons should be reflected in the appropriate product, architecture, decision or agent-instruction document instead.
