import { Chess, SQUARES, type Square } from "chess.js";

export const STARTING_FEN = new Chess().fen();

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;

export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

export type ParsePositionResult =
  { kind: "valid"; fen: string } | { kind: "invalid"; message: string };

export type MoveAttempt =
  | { kind: "moved"; fen: string }
  | {
      kind: "promotion-required";
      from: Square;
      to: Square;
      choices: PromotionPiece[];
    }
  | { kind: "illegal" };

const squareSet = new Set<string>(SQUARES);

export function parsePosition(fen: string): ParsePositionResult {
  try {
    return { kind: "valid", fen: new Chess(fen.trim()).fen() };
  } catch (error) {
    return {
      kind: "invalid",
      message: error instanceof Error ? error.message : "Invalid FEN",
    };
  }
}

export function attemptMove(
  fen: string,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): MoveAttempt {
  if (!isSquare(from) || !isSquare(to)) {
    return { kind: "illegal" };
  }

  try {
    const chess = new Chess(fen);
    const candidates = chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);

    if (candidates.length === 0) {
      return { kind: "illegal" };
    }

    const promotionChoices = PROMOTION_PIECES.filter((piece) =>
      candidates.some((move) => move.promotion === piece),
    );

    if (promotionChoices.length > 0 && promotion === undefined) {
      return {
        kind: "promotion-required",
        from,
        to,
        choices: promotionChoices,
      };
    }

    const selectedMove = candidates.find((move) =>
      promotion === undefined
        ? move.promotion === undefined
        : move.promotion === promotion,
    );

    if (!selectedMove) {
      return { kind: "illegal" };
    }

    chess.move({ from, to, promotion });
    return { kind: "moved", fen: chess.fen() };
  } catch {
    return { kind: "illegal" };
  }
}

function isSquare(value: string): value is Square {
  return squareSet.has(value);
}
