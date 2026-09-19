# Active work: Safe Exploration

## Status

Authorised for implementation.

The manager should decompose, direct and review this milestone according to the multi-agent workflow in `AGENTS.md`.

Do not proceed beyond this milestone without owner approval.

## Context

The product/technical review in `review-260919.md` identified destructive exploration as the clearest current workflow problem.

At present, trying an alternative move while reviewing a game discards the active game-review context and its analysis. This conflicts directly with the intended use of the application as a tool for investigating positions and understanding alternatives.

The first implementation milestone is therefore **Safe Exploration**, corresponding to Implementation Brief A in `review-260919.md`.

## Objective

Allow the user to explore alternative moves without losing the imported game, selected review context or completed game analysis.

Exploration should behave as a temporary, reversible line rooted in the game position being investigated.

The same basic reversible line-history behaviour should also be available when exploring a standalone position.

This is deliberately **not** a general variation-tree editor.

## Intended behaviour

For game review:

* retain the imported game independently of the exploratory position currently displayed;
* retain the game position/review context from which exploration began;
* allow the user to make moves along one temporary exploration line;
* allow navigation backward and forward within that line;
* making a different move after navigating backward should discard only the abandoned future of the temporary line;
* allow the line to be reset to its root;
* provide an explicit way to return to the game;
* returning to the game must restore the relevant game/review context without reimporting or rescanning;
* completed game-analysis results must remain available during and after exploration;
* game navigation may end the current temporary exploration, but must not discard the imported game.

For standalone exploration:

* board moves should create the same kind of reversible temporary history;
* the user should be able to navigate backward and forward and reset appropriately.

For analysis/state correctness:

* the currently displayed position must always use the correct FEN for that position;
* retained analysis associated with a game position must not be displayed as though it belongs to an exploratory branch position;
* preserve existing promotion, cancellation and invalid-input behaviour unless a change is directly required by this milestone.

## Acceptance criteria

The milestone is acceptable when:

1. A game can be imported and analysed.
2. A review position can be selected.
3. The user can explore alternative moves from that position without losing the game.
4. The user can navigate within the temporary exploration line.
5. Branching after moving backward replaces only the abandoned temporary continuation.
6. The user can reset the exploration line.
7. The user can return to the game without reimporting or rescanning it.
8. The selected source context and completed game analysis remain available.
9. Standalone board exploration is reversible in the same general manner.
10. Behavioural tests cover the important workspace transitions.
11. Repository verification passes, except for any explicitly justified updates to tests that encoded the old destructive behaviour.

## Constraints

Keep the change narrowly focused on Safe Exploration.

Do not:

* build a general variation-tree system;
* begin the next review milestone;
* add persistence, accounts or other roadmap features;
* perform unrelated refactoring or cleanup;
* redesign the broader UI except where controls are directly required for this workflow.

The manager may refine this into one or more bounded implementation work orders after inspecting the repository.

## Owner note

The broader product hypothesis from `review-260919.md` remains provisional.

In particular, do not treat this milestone as authorisation to commit the application permanently to either whole-game review or standalone position investigation as its primary product model.

Safe Exploration is valuable under either direction.

---

Agent conversation begins below this line.
