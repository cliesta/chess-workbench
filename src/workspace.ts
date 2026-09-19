import type { ImportedGame } from "./chess/game";
import type { PositionChanges } from "./chess/positionChanges";

export type HistoryEntry = {
  fen: string;
  changes: PositionChanges | null;
};

export type ExplorationHistory = {
  entries: HistoryEntry[];
  cursor: number;
};

export type Workspace =
  | {
      kind: "position";
      history: ExplorationHistory;
    }
  | {
      kind: "game";
      game: ImportedGame;
      positionIndex: number;
      exploration: ExplorationHistory | null;
    };

export function createPositionWorkspace(fen: string): Workspace {
  return {
    kind: "position",
    history: createHistory({ fen, changes: null }),
  };
}

export function createGameWorkspace(game: ImportedGame): Workspace {
  return {
    kind: "game",
    game,
    positionIndex: 0,
    exploration: null,
  };
}

export function displayedEntry(workspace: Workspace): HistoryEntry {
  if (workspace.kind === "position") {
    return workspace.history.entries[workspace.history.cursor];
  }

  if (workspace.exploration) {
    return workspace.exploration.entries[workspace.exploration.cursor];
  }

  const position = workspace.game.positions[workspace.positionIndex];
  return { fen: position.fen, changes: position.changes ?? null };
}

export function appendExplorationMove(
  workspace: Workspace,
  entry: HistoryEntry,
): Workspace {
  if (workspace.kind === "position") {
    return {
      ...workspace,
      history: appendHistory(workspace.history, entry),
    };
  }

  const history =
    workspace.exploration ?? createHistory(displayedEntry(workspace));
  return {
    ...workspace,
    exploration: appendHistory(history, entry),
  };
}

export function navigateExploration(
  workspace: Workspace,
  cursor: number,
): Workspace {
  const history = getExploration(workspace);
  if (!history) {
    return workspace;
  }

  const nextHistory = {
    ...history,
    cursor: Math.max(0, Math.min(cursor, history.entries.length - 1)),
  };
  return workspace.kind === "position"
    ? { ...workspace, history: nextHistory }
    : { ...workspace, exploration: nextHistory };
}

export function resetExploration(workspace: Workspace): Workspace {
  const history = getExploration(workspace);
  if (!history) {
    return workspace;
  }

  const resetHistory = createHistory(history.entries[0]);
  return workspace.kind === "position"
    ? { ...workspace, history: resetHistory }
    : { ...workspace, exploration: resetHistory };
}

export function returnToGame(workspace: Workspace): Workspace {
  return workspace.kind === "game"
    ? { ...workspace, exploration: null }
    : workspace;
}

export function navigateGame(
  workspace: Workspace,
  positionIndex: number,
): Workspace {
  if (workspace.kind !== "game") {
    return workspace;
  }

  const boundedIndex = Math.max(
    0,
    Math.min(positionIndex, workspace.game.positions.length - 1),
  );
  return {
    ...workspace,
    positionIndex: boundedIndex,
    exploration: null,
  };
}

export function getExploration(
  workspace: Workspace,
): ExplorationHistory | null {
  return workspace.kind === "position"
    ? workspace.history
    : workspace.exploration;
}

function createHistory(root: HistoryEntry): ExplorationHistory {
  return { entries: [root], cursor: 0 };
}

function appendHistory(
  history: ExplorationHistory,
  entry: HistoryEntry,
): ExplorationHistory {
  const entries = [...history.entries.slice(0, history.cursor + 1), entry];
  return { entries, cursor: entries.length - 1 };
}
