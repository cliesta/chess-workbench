import {
  Chess,
  SQUARES,
  type Color,
  type PieceSymbol,
  type Square,
} from "chess.js";

export const STARTING_FEN = new Chess().fen();

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;

export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

export type ParsePositionResult =
  { kind: "valid"; fen: string } | { kind: "invalid"; message: string };

export type MoveAttempt =
  | { kind: "moved"; fen: string; move: AppliedMove }
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

export type InsightColor = "white" | "black";

export type InsightPieceType =
  "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export type InsightPiece = {
  color: InsightColor;
  type: InsightPieceType;
  square: string;
};

export type AppliedMove = {
  color: InsightColor;
  piece: InsightPieceType;
  from: string;
  to: string;
  san: string;
  promotion?: InsightPieceType;
  captured?: InsightPiece;
  castlingRook?: {
    from: string;
    to: string;
  };
};

export type MaterialCounts = Record<Exclude<InsightPieceType, "king">, number>;

export type PositionInsights = {
  sideToMove: InsightColor;
  inCheck: boolean;
  material: {
    white: MaterialCounts;
    black: MaterialCounts;
    whitePoints: number;
    blackPoints: number;
    whiteMinusBlack: number;
  };
  attackedAndUndefended: Array<{
    piece: InsightPiece;
    attackers: InsightPiece[];
  }>;
};

const squareSet = new Set<string>(SQUARES);

const pieceTypeNames: Record<PieceSymbol, InsightPieceType> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export const MATERIAL_VALUES: Readonly<Record<keyof MaterialCounts, number>> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
};

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

    const captured = getCapturedPiece(chess, selectedMove);
    const appliedMove = chess.move({ from, to, promotion });

    return {
      kind: "moved",
      fen: chess.fen(),
      move: {
        color: toInsightColor(appliedMove.color),
        piece: pieceTypeNames[appliedMove.piece],
        from: appliedMove.from,
        to: appliedMove.to,
        san: appliedMove.san,
        ...(appliedMove.promotion
          ? { promotion: pieceTypeNames[appliedMove.promotion] }
          : {}),
        ...(captured ? { captured } : {}),
        ...(getCastlingRookMove(appliedMove) ?? {}),
      },
    };
  } catch {
    return { kind: "illegal" };
  }
}

export function getPositionInsights(fen: string): PositionInsights {
  const chess = new Chess(fen);
  const pieces = chess
    .board()
    .flat()
    .filter((piece) => piece !== null)
    .map((piece) => toInsightPiece(piece.color, piece.type, piece.square));
  const white = emptyMaterialCounts();
  const black = emptyMaterialCounts();

  for (const piece of pieces) {
    if (piece.type !== "king") {
      const counts = piece.color === "white" ? white : black;
      counts[piece.type] += 1;
    }
  }

  const attackedAndUndefended = pieces
    .filter((piece) => piece.type !== "king")
    .flatMap((piece) => {
      const square = asSquare(piece.square);
      const ownColor = piece.color === "white" ? "w" : "b";
      const opposingColor = ownColor === "w" ? "b" : "w";
      const attackerSquares = chess.attackers(square, opposingColor);
      const defenderSquares = chess.attackers(square, ownColor);

      if (attackerSquares.length === 0 || defenderSquares.length > 0) {
        return [];
      }

      const attackers = attackerSquares
        .map((attackerSquare) => {
          const attacker = chess.get(attackerSquare);
          if (!attacker) {
            throw new Error(`Missing attacker on ${attackerSquare}`);
          }
          return toInsightPiece(attacker.color, attacker.type, attackerSquare);
        })
        .sort(compareInsightPieces);

      return [{ piece, attackers }];
    })
    .sort((left, right) => {
      const colorOrder =
        (left.piece.color === "white" ? 0 : 1) -
        (right.piece.color === "white" ? 0 : 1);
      return colorOrder || compareInsightPieces(left.piece, right.piece);
    });

  const whitePoints = materialPoints(white);
  const blackPoints = materialPoints(black);

  return {
    sideToMove: chess.turn() === "w" ? "white" : "black",
    inCheck: chess.inCheck(),
    material: {
      white,
      black,
      whitePoints,
      blackPoints,
      whiteMinusBlack: whitePoints - blackPoints,
    },
    attackedAndUndefended,
  };
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

function asSquare(value: string): Square {
  if (!isSquare(value)) {
    throw new Error(`Invalid board square: ${value}`);
  }
  return value;
}

function toInsightPiece(
  color: Color,
  type: PieceSymbol,
  square: Square,
): InsightPiece {
  return {
    color: toInsightColor(color),
    type: pieceTypeNames[type],
    square,
  };
}

function toInsightColor(color: Color): InsightColor {
  return color === "w" ? "white" : "black";
}

function getCapturedPiece(
  chess: Chess,
  move: ReturnType<Chess["move"]>,
): InsightPiece | undefined {
  if (!move.captured) {
    return undefined;
  }

  const square = move.isEnPassant()
    ? asSquare(
        `${move.to[0]}${Number(move.to[1]) + (move.color === "w" ? -1 : 1)}`,
      )
    : move.to;
  const piece = chess.get(square);

  if (!piece) {
    throw new Error(`Missing captured piece on ${square}`);
  }

  return toInsightPiece(piece.color, piece.type, square);
}

function getCastlingRookMove(
  move: ReturnType<Chess["move"]>,
): Pick<AppliedMove, "castlingRook"> | undefined {
  const rank = move.color === "w" ? "1" : "8";

  if (move.isKingsideCastle()) {
    return { castlingRook: { from: `h${rank}`, to: `f${rank}` } };
  }
  if (move.isQueensideCastle()) {
    return { castlingRook: { from: `a${rank}`, to: `d${rank}` } };
  }
  return undefined;
}

function emptyMaterialCounts(): MaterialCounts {
  return { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 };
}

function materialPoints(counts: MaterialCounts) {
  return (Object.keys(MATERIAL_VALUES) as Array<keyof MaterialCounts>).reduce(
    (total, pieceType) =>
      total + counts[pieceType] * MATERIAL_VALUES[pieceType],
    0,
  );
}

function compareInsightPieces(left: InsightPiece, right: InsightPiece) {
  return left.square.localeCompare(right.square);
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
