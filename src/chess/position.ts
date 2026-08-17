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

export type FormattedPrincipalVariation = {
  notation: string | null;
  complete: boolean;
  usesRawNotation: boolean;
};

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

export function formatPrincipalVariation(
  fen: string,
  coordinateMoves: string[],
): FormattedPrincipalVariation {
  if (coordinateMoves.length === 0) {
    return { notation: null, complete: true, usesRawNotation: false };
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return rawPrincipalVariation(coordinateMoves);
  }

  const fenFields = fen.trim().split(/\s+/);
  let moveNumber = Number(fenFields[5]);
  const formattedMoves: string[] = [];

  if (!Number.isInteger(moveNumber) || moveNumber < 1) {
    return rawPrincipalVariation(coordinateMoves);
  }

  for (const [index, coordinateMove] of coordinateMoves.entries()) {
    const parsedMove = parseCoordinateMove(coordinateMove);
    if (!parsedMove) {
      return incompletePrincipalVariation(formattedMoves, coordinateMoves);
    }

    const turn = chess.turn();

    try {
      const move = chess.move(parsedMove);

      if (turn === "w") {
        formattedMoves.push(`${moveNumber}. ${move.san}`);
      } else {
        formattedMoves.push(
          index === 0 ? `${moveNumber}... ${move.san}` : move.san,
        );
        moveNumber += 1;
      }
    } catch {
      return incompletePrincipalVariation(formattedMoves, coordinateMoves);
    }
  }

  return {
    notation: formattedMoves.join(" "),
    complete: true,
    usesRawNotation: false,
  };
}

function isSquare(value: string): value is Square {
  return squareSet.has(value);
}

function parseCoordinateMove(move: string) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(move);
  if (!match || !isSquare(match[1]) || !isSquare(match[2])) {
    return null;
  }

  const promotion = match[3] as PromotionPiece | undefined;
  return { from: match[1], to: match[2], promotion };
}

function incompletePrincipalVariation(
  formattedMoves: string[],
  coordinateMoves: string[],
): FormattedPrincipalVariation {
  if (formattedMoves.length === 0) {
    return rawPrincipalVariation(coordinateMoves);
  }

  return {
    notation: formattedMoves.join(" "),
    complete: false,
    usesRawNotation: false,
  };
}

function rawPrincipalVariation(
  coordinateMoves: string[],
): FormattedPrincipalVariation {
  return {
    notation: coordinateMoves.join(" "),
    complete: false,
    usesRawNotation: true,
  };
}
