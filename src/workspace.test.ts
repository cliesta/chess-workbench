import { describe, expect, test } from "vitest";
import type { ImportedGame } from "./chess/game";
import { STARTING_FEN } from "./chess/position";
import {
  appendExplorationMove,
  createGameWorkspace,
  createPositionWorkspace,
  displayedEntry,
  navigateExploration,
  navigateGame,
  resetExploration,
  returnToGame,
} from "./workspace";

const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const afterD4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1";

describe("workspace exploration", () => {
  test("preserves forward history until a successful move replaces it", () => {
    let workspace = createPositionWorkspace(STARTING_FEN);
    workspace = appendExplorationMove(workspace, {
      fen: afterE4,
      changes: null,
    });
    workspace = navigateExploration(workspace, 0);

    expect(displayedEntry(workspace).fen).toBe(STARTING_FEN);
    workspace = navigateExploration(workspace, 1);
    expect(displayedEntry(workspace).fen).toBe(afterE4);

    workspace = navigateExploration(workspace, 0);
    workspace = appendExplorationMove(workspace, {
      fen: afterD4,
      changes: null,
    });
    workspace = navigateExploration(workspace, 2);
    expect(displayedEntry(workspace).fen).toBe(afterD4);
  });

  test("keeps a game and source ply while exploration resets and returns", () => {
    const game: ImportedGame = {
      headers: {},
      positions: [{ fen: STARTING_FEN }, { fen: afterE4 }],
    };
    let workspace = navigateGame(createGameWorkspace(game), 1);
    workspace = appendExplorationMove(workspace, {
      fen: "branch",
      changes: null,
    });

    expect(workspace).toMatchObject({
      kind: "game",
      game,
      positionIndex: 1,
      exploration: { cursor: 1 },
    });
    workspace = resetExploration(workspace);
    expect(displayedEntry(workspace).fen).toBe(afterE4);
    expect(workspace).toMatchObject({
      kind: "game",
      exploration: { entries: [{ fen: afterE4 }], cursor: 0 },
    });

    workspace = returnToGame(workspace);
    expect(workspace).toMatchObject({
      kind: "game",
      game,
      positionIndex: 1,
      exploration: null,
    });
  });

  test("uses a loaded standalone FEN as the reset root", () => {
    let workspace = createPositionWorkspace(afterE4);
    workspace = appendExplorationMove(workspace, {
      fen: "continuation",
      changes: null,
    });
    workspace = resetExploration(workspace);

    expect(displayedEntry(workspace).fen).toBe(afterE4);
  });
});
