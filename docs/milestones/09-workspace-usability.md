# Milestone 9 — Workspace usability and navigation

## 1. Goal

Make the existing position and game-review workflows comfortable to use without
adding chess functionality:

> Keep the board, selected position, relevant controls, and current explanation
> close enough that reviewing a game does not require repeatedly searching up
> and down a long page.

This milestone reorganizes and responsively presents functionality that already
exists. It must not change chess rules, engine searches, review-moment semantics,
or authoritative application state.

## 2. Evidence and current problems

A browser review of the Milestone 8 production build found no horizontal
overflow and no visual alarmism, but it found excessive vertical separation:

| Browser state                       | Page height | Important locations                                            |
| ----------------------------------- | ----------: | -------------------------------------------------------------- |
| Initial position at 1280 × 720      |    1,910 px | Board begins at 205 px; Analysis begins at 1,531 px            |
| Loaded 10-move game at 1280 × 720   |    2,993 px | Move list begins at 1,148 px; Analysis begins at 2,500 px      |
| Analysed four-ply game at 390 × 844 |    3,605 px | Board ends at 523 px; review at 1,274 px; Analysis at 3,171 px |

At desktop width, the board scrolls out of view while the much longer right
column continues, leaving most of the left column empty. Clicking a review
moment at a typical scroll position changed the selected position while the
entire board remained above the viewport and the Analysis panel remained far
below it. The action therefore gave little immediate visual confirmation.

The current component order also gives setup controls permanent priority:

- the full PGN textarea remains open after a game is loaded;
- the FEN editor remains prominent during game review even though using it
  leaves that mode;
- selected-position navigation and details are separated by game-analysis and
  review content; and
- an arbitrarily long move list increases the height of the whole document.

These are information-placement problems, not reasons for a visual redesign.
The established dark palette, typography, restrained review wording, board
highlights, and ordinary button styling should remain.

## 3. Scope

- Make the board remain available while scrolling the desktop workbench.
- Reduce the header's vertical cost inside the working view.
- Give standalone-position setup priority in standalone mode.
- Collapse the PGN editor after a game has loaded, with an explicit way to load
  a replacement game.
- Collapse the standalone FEN loader while an imported game is active and make
  its mode-changing effect explicit.
- Place selected-game-position status and navigation immediately after the game
  summary.
- Divide loaded-game sidebar content into two small task views: **Review** and
  **Position details**.
- Bound the height of the main-line move list and keep its selected move visible
  inside that list.
- Make review-moment and move-list navigation reveal the board on narrow
  screens.
- Preserve keyboard access and announce position changes.
- Add component and application tests for the new presentation behavior.
- Validate representative desktop, laptop-height, and narrow browser layouts.
- Update architecture and the project journal after implementation.

No npm package is needed.

## 4. Product and architecture boundaries

### Presentation change only

The existing `Workspace` union remains authoritative:

- `{ kind: "position", fen, changes }`; or
- `{ kind: "game", game, positionIndex }`.

The milestone must not introduce a second selected position, duplicate FEN,
duplicate imported game, global store, router, or URL state. Existing navigation
callbacks continue to change the game position index. Existing engine and
review-moment state remain unchanged.

The selected sidebar task view and whether a replacement input is expanded are
ordinary local presentation state. They do not survive a reload and do not
change chess behavior.

### Do not solve length by removing information

The move list, Review moments, Position insights, What changed?, Analysis, PGN
input, and FEN input must remain available. The design should prioritize,
collapse, or bound them rather than deleting them.

## 5. Proposed desktop layout

At the existing desktop breakpoint, retain two columns:

```text
┌──────────────────────────────┬─────────────────────────────────┐
│ Board                        │ Active workspace                │
│                              │                                 │
│ sticky while sidebar scrolls │ game summary + move navigation  │
│                              │ Review | Position details       │
│                              │ selected task content           │
└──────────────────────────────┴─────────────────────────────────┘
```

### Sticky board

Wrap or style the board column with `position: sticky` and a modest top offset
at desktop widths only. Cap its size using the available viewport height as well
as the existing width limit, so a low-height laptop viewport does not produce a
sticky element taller than the visible area.

The exact CSS can remain straightforward, for example a desktop maximum based
on both `42rem` and `100vh` minus the compact header/top allowance. Do not use
JavaScript resize listeners or calculate pixel dimensions in React.

At page load the user should still see the application identity, board, and top
of the active controls. Once scrolling begins, the board should settle near the
top of the viewport rather than leaving an empty left column.

### Compact header

Keep the title and one-sentence description, but reduce their vertical margins
and large-screen size enough that the board is not pushed unnecessarily far
down. Do not add global navigation, a toolbar, logo artwork, or branding work.

## 6. Workspace-specific setup controls

### Standalone-position mode

The standalone FEN form should be the first sidebar control because it affects
the active workspace. The PGN importer remains clearly available as **Review a
game**, but it need not occupy the first and largest card.

No explicit mode switch is required. The authoritative workspace already says
which mode is active; conditional layout is simpler than adding a separate mode
state that could disagree with it.

### Game-review mode

After a valid PGN load:

- replace the expanded textarea with the existing game summary;
- provide a quiet **Load another game** action that expands the existing PGN
  draft and form;
- keep the draft unchanged when the form is collapsed;
- collapse it again after a successful replacement load; and
- leave it expanded with its error visible after an invalid replacement.

The standalone FEN form should appear behind a native disclosure labelled
**Load a standalone FEN**. Its note must say that a valid load leaves game
review. An invalid FEN continues to preserve the game and should keep the
disclosure open so the error is visible.

Use ordinary buttons and native `<details>`/`<summary>` where they fit. Do not add
a modal, drawer, router, or animated panel system.

## 7. Loaded-game task views

After the compact game summary and selected-position toolbar, add two accessible
task views:

1. **Review**
2. **Position details**

Use a small tab interface with `role="tablist"`, named tabs, corresponding
`role="tabpanel"` regions, keyboard-operable buttons, `aria-selected`, and
stable IDs. Only the active panel is rendered or exposed to assistive
technology.

### Default and persistence

- A newly loaded game opens **Review**.
- Navigation does not change the selected task view.
- Clicking a review moment does not silently switch task views.
- Replacing the game resets to **Review**.
- Leaving game review removes the game task-view state with the rest of that UI.

This is local display state only. Do not store it in `ImportedGame` or the engine
hook.

### Review view

Render, in this order:

1. whole-game analysis controls and progress;
2. Review moments; and
3. the bounded main-line move list.

This order keeps the primary “analyse, then inspect the shortlist” workflow
together. The position toolbar above the tabs provides previous/next navigation
without requiring the move list to remain visible.

### Position details view

Render, in this order:

1. Analysis;
2. What changed?; and
3. Position insights.

The selected FEN may be shown as read-only copyable text in the toolbar or at
the start of this view if it can reuse the current FEN control cleanly. The
editable mode-changing FEN form remains in its explicit disclosure; do not make
an editable field look like harmless position metadata.

Analysis comes first because it changes asynchronously and is a frequent reason
to inspect a selected ply. What changed? then explains the producing move, while
the broader static snapshot remains available afterward.

## 8. Selected-position toolbar

In game mode, put a compact toolbar directly below the game summary and above
the task tabs. It should contain:

- **Start position** or **After _move number and SAN_**;
- `_current_ of _total_ plies`;
- First, Previous, Next, and Last controls; and
- the matching retained evaluation when available.

Do not add duplicate navigation state. Reuse `onNavigate` and the existing
FEN-matched game-analysis result.

Keep the current `aria-live="polite"` position announcement. The move controls
must remain ordinary buttons with the same disabled boundaries. The toolbar may
wrap on narrow screens rather than forcing a single horizontal row.

Do not put the entire engine PV or Position insights into the toolbar.

## 9. Bounded move list

The main-line move list should have a clear label and a maximum height of roughly
`16rem`–`20rem`, with vertical overflow inside the list. A 100-move game should
not make the whole page thousands of pixels taller.

When navigation selects a move outside the list's visible area, scroll only the
list container enough to reveal the selected button. Use `scrollIntoView` on the
selected move with the nearest alignment or an equivalent small effect; do not
scroll the document merely because Previous/Next was pressed.

The existing SAN, move numbering, retained evaluation, `aria-current="step"`,
and button behavior remain unchanged.

## 10. Narrow-screen behavior

Below the desktop breakpoint:

- use the existing single-column order with board first;
- do not make the board sticky;
- keep the selected-position toolbar immediately after the compact game
  summary;
- let toolbar buttons wrap without horizontal overflow;
- keep the Review/Position details tabs visible before their content;
- retain the bounded move list; and
- allow long SAN principal variations to wrap.

When **Show position** or a move-list button is activated on a narrow screen:

1. update the existing selected position;
2. scroll the board/position target into view;
3. move focus to a programmatically focusable selected-position heading or
   status adjacent to the board; and
4. preserve an accessible announcement of the new move.

Do not use smooth scrolling; respect reduced-motion preferences and make the
destination immediate and predictable. First/Previous/Next/Last in the compact
toolbar should not repeatedly force document scrolling because the user is
already operating beside the selected-position status.

At desktop widths, do not scroll the page after a review or move-list action;
the sticky board supplies immediate visual feedback.

Use the existing CSS media breakpoint as the source of layout behavior. If
React must decide whether to reveal the board after an action, prefer a small
`matchMedia` helper local to the UI rather than storing viewport dimensions or
adding a responsiveness package.

## 11. Component responsibilities

### `App.tsx`

- Preserve all current workspace and engine ownership.
- Render controls in workspace-appropriate order.
- Own only the selected game task view if it must coordinate sibling panels.
- Keep using `handleGameNavigation` as the only game-selection action.
- Coordinate the narrow-screen reveal target without embedding chess logic in
  layout code.

### `GameReviewPanel.tsx`

- Separate the expanded PGN-import state from the loaded-game view.
- Put game summary and selected-position navigation before task content.
- Render the Review view's analysis controls, moments, and bounded move list.
- Continue receiving typed state and callbacks; do not gain engine or PGN rules.

Small presentation components such as `GamePositionToolbar` or `GameTaskTabs`
may be extracted if they make the reorganized component easier to read and test.
Do not create a generic tabs framework, layout library, or component design
system for one use.

### Existing panels

`AnalysisPanel`, `PositionChangesPanel`, and `PositionInsightsPanel` should be
reused in the Position details task view. Their chess meaning, formatting, and
tests remain unchanged. CSS may receive task-view and sticky-layout classes,
but the panels should not learn about viewport dimensions.

## 12. Accessibility and interaction details

- The tab list has an accessible name such as **Game review view**.
- Left/Right arrow-key tab activation is optional for this milestone; standard
  tab-focus plus Enter/Space activation is sufficient if ARIA state is correct.
- Focus indicators remain visible on tabs, disclosures, navigation, review
  actions, and moves.
- Collapsing the PGN form must not discard its draft.
- Expanding a replacement form should move focus to its PGN textarea.
- A failed submission leaves focus/error association usable and does not hide
  the form containing the error.
- Programmatic narrow-screen navigation moves focus to a meaningful named
  destination, not the document body.
- The sticky board must not overlap content, dialogs, or keyboard focus rings.
- Browser zoom to 200% must not introduce horizontal scrolling.
- Reduced-motion users receive no animated scroll or large layout transition.

## 13. Error and lifecycle behavior

- Invalid PGN keeps the currently loaded game, analysis results, review moments,
  selected ply, and active task view.
- A valid replacement PGN resets existing analysis through the established
  lifecycle and returns to the Review view.
- Invalid FEN in game mode keeps its disclosure and error visible and preserves
  game review.
- A valid FEN leaves game review exactly as it does now.
- Engine loading, running, cancellation, completion, and error do not switch
  tabs automatically.
- Partial Review moments remain available in the Review view after engine
  cancellation or failure.
- Promotion, legal moves, illegal moves, and selected insight highlights retain
  their existing behavior.
- A zero-move game still has usable navigation boundaries and task views.

## 14. Testing strategy

### Component tests

Prove that:

- the PGN form is expanded when no game is loaded;
- a loaded game shows summary/navigation while its PGN form is collapsed;
- **Load another game** expands the same retained draft;
- invalid replacement input leaves its form and error visible;
- selected-position status and navigation precede the task tabs in the
  accessible structure;
- Review is the default selected tab;
- Review exposes game analysis, Review moments, and move list but not Position
  details;
- Position details exposes Analysis, What changed?, and Position insights but
  not Review content;
- tab selection survives ordinary move navigation;
- the move list retains SAN/evaluation behavior and marks the current step;
- the selected move is revealed inside an overflowed list; and
- the standalone FEN disclosure clearly describes leaving game review.

Test user-observable behavior rather than CSS class implementation details.

### Application integration tests

Prove that:

- standalone mode gives the FEN workflow priority while keeping PGN import
  available;
- loading a game enters the compact game workspace and defaults to Review;
- review-moment, move-list, and toolbar navigation still synchronize board,
  FEN, insights, What changed?, and Analysis;
- changing task views never changes the selected position or engine result;
- valid/invalid replacement PGN and FEN retain the established lifecycle;
- Analyse again, cancellation, and engine failure do not disturb task-view
  selection; and
- narrow-navigation focus is sent to the documented position target.

Use the existing fake engine seam. No test requires a real Stockfish search.

### CSS and browser behavior

JSDOM cannot prove sticky positioning, document height, overflow, or responsive
placement. Cover those with the manual production-preview checks below rather
than assertions against style implementation details.

## 15. Manual browser checks

### Desktop and laptop-height

1. At approximately 1280 × 720, confirm the compact header, board, and active
   controls establish the workspace without an oversized empty introduction.
2. Scroll through a loaded game and confirm the board remains fully usable and
   does not overlap the header or content.
3. Analyse the four-ply mating example from Milestone 8 and click each Review
   moment; confirm the board visibly changes without document scrolling.
4. Switch between Review and Position details; confirm the selected move and
   board do not change.
5. Confirm Analysis is near the top of Position details rather than at the end
   of the whole page.
6. Load a game of at least 40 plies and confirm the move list scrolls internally
   while the overall Review view remains a practical height.
7. Navigate to the first and last move; confirm the selected move becomes
   visible inside the list.
8. Confirm the collapsed PGN and FEN setup actions remain discoverable.

### Narrow screen

9. At 390 × 844, confirm board, toolbar, tabs, and content use one column without
   horizontal overflow.
10. Click a review moment and a distant move-list entry; confirm each reveals a
    named board/position destination and places focus there.
11. Use toolbar Previous/Next repeatedly; confirm it does not keep jumping the
    document.
12. Confirm long engine lines wrap and the move list scrolls internally.
13. Test both task views at 200% browser zoom.

### Regression checks

14. Load valid and invalid PGN and FEN input in both workspace modes.
15. Run, cancel, and rerun real Stockfish game analysis.
16. Exercise a legal move, illegal move, promotion, and an insight highlight.
17. Confirm the browser console has no unexpected warnings or errors.
18. Repeat the core flow against the deployed production URL after release.

## 16. Acceptance criteria

Milestone 9 is complete when:

- the established workspace remains the only position/game authority;
- the desktop board remains visible and usable while the sidebar scrolls;
- a low-height desktop viewport never receives a sticky board taller than its
  usable viewport;
- the header uses materially less vertical space without losing identity;
- standalone mode prioritizes FEN setup and game mode prioritizes game review;
- a successfully loaded game no longer leaves the full PGN textarea permanently
  expanded;
- the game-mode FEN editor is collapsed behind an action that explains it leaves
  review;
- selected-position status and navigation sit directly after the game summary;
- Review and Position details are accessible task views with the documented
  content and lifecycle;
- the main-line list has bounded height and reveals its selected move;
- Review-moment and move-list actions visibly reveal the board on narrow screens
  while desktop navigation relies on the sticky board;
- Analysis is the first panel in Position details;
- page layout remains free of horizontal overflow at 390 px and 200% zoom;
- no existing PGN, FEN, board, promotion, insights, move-comparison, engine,
  whole-game analysis, or Review-moment semantics change;
- no dependency, router, global store, or JavaScript layout-sizing system is
  introduced;
- deterministic component and application tests pass;
- `npm run verify` passes under Node 24;
- local production-build browser checks pass; and
- `docs/architecture.md` and `docs/journal.md` describe the implemented layout.

## 17. Explicit non-goals

- New chess analysis, review rules, tactical motifs, or explanations
- Changes to the 75-centipawn threshold or mate-transition ranking
- MultiPV, evaluation bar, graph, board arrows, or engine move playback
- PGN files, side variations, editing, annotations, export, or persistence
- Accounts, backend, analytics, or cross-device preferences
- URL routing or browser-history state
- Global state-management library
- CSS framework or component library
- Generic design system or reusable tabs package
- Drag-resizable panes
- User-configurable layouts or panel ordering
- Mobile sticky board
- Modal PGN/FEN editors
- Animated/smooth scrolling
- Visual rebranding, new color theme, icon set, or decorative artwork
- Broad accessibility rewrite unrelated to the changed workspace

## Decisions requiring owner approval

1. Approve a sticky, viewport-capped board at desktop widths only.
2. Approve deriving setup priority from the existing workspace instead of
   adding a separate Position/Game mode switch.
3. Approve collapsing the PGN editor after a successful load and the FEN editor
   during game review.
4. Approve two loaded-game task views—Review and Position details—with Review as
   the default.
5. Approve a bounded, internally scrolling move list.
6. Approve narrow-screen review/move actions scrolling and moving focus to the
   selected-position destination, while toolbar navigation does not.
