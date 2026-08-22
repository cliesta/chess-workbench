import {
  getPositionInsights,
  parsePgn,
  type ImportedGameHeaders,
  type ParsedGame,
  type ParsedGamePosition,
} from "./position";
import {
  comparePositionInsights,
  type PositionChanges,
} from "./positionChanges";

export type ImportedGamePosition = ParsedGamePosition & {
  changes?: PositionChanges;
};

export type ImportedGame = Omit<ParsedGame, "positions"> & {
  headers: ImportedGameHeaders;
  positions: ImportedGamePosition[];
};

export type ParseGameResult =
  { kind: "valid"; game: ImportedGame } | { kind: "invalid"; message: string };

export function parseGame(pgn: string): ParseGameResult {
  const parsed = parsePgn(pgn);

  if (parsed.kind === "invalid") {
    return parsed;
  }

  return {
    kind: "valid",
    game: {
      headers: parsed.game.headers,
      positions: parsed.game.positions.map((position, index, positions) => {
        if (!position.move || index === 0) {
          return position;
        }

        return {
          ...position,
          changes: comparePositionInsights(
            getPositionInsights(positions[index - 1].fen),
            getPositionInsights(position.fen),
            position.move,
          ),
        };
      }),
    },
  };
}
