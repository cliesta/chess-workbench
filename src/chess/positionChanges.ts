import {
  MATERIAL_VALUES,
  type AppliedMove,
  type InsightColor,
  type InsightPiece,
  type InsightPieceType,
  type MaterialCounts,
  type PositionInsights,
} from "./position";

type MaterialPieceType = Exclude<InsightPieceType, "king">;
type LooseFinding = PositionInsights["attackedAndUndefended"][number];

export type MaterialCountChange = {
  color: InsightColor;
  type: MaterialPieceType;
  before: number;
  after: number;
  pointDelta: number;
};

export type LoosePieceStatusChange = {
  piece: InsightPiece;
  previousSquare?: string;
  attackers?: InsightPiece[];
};

export type PositionChanges = {
  move: AppliedMove;
  material: {
    countChanges: MaterialCountChange[];
    whitePointsBefore: number;
    whitePointsAfter: number;
    blackPointsBefore: number;
    blackPointsAfter: number;
    whiteMinusBlackBefore: number;
    whiteMinusBlackAfter: number;
  };
  check: {
    entered: InsightColor[];
    left: InsightColor[];
  };
  becameAttackedAndUndefended: LoosePieceStatusChange[];
  stoppedBeingAttackedAndUndefended: LoosePieceStatusChange[];
};

const materialOrder: MaterialPieceType[] = [
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];
const colorOrder: InsightColor[] = ["white", "black"];

export function comparePositionInsights(
  before: PositionInsights,
  after: PositionInsights,
  move: AppliedMove,
): PositionChanges {
  const mappedBefore = before.attackedAndUndefended.flatMap((finding) =>
    mapBeforeFinding(finding, move),
  );
  const mappedBeforeKeys = new Set(
    mappedBefore.map(({ piece }) => pieceKey(piece)),
  );
  const afterKeys = new Set(
    after.attackedAndUndefended.map(({ piece }) => pieceKey(piece)),
  );

  const becameAttackedAndUndefended = after.attackedAndUndefended
    .filter(({ piece }) => !mappedBeforeKeys.has(pieceKey(piece)))
    .map(({ piece, attackers }) => ({
      piece,
      attackers,
      ...previousSquareFor(piece, move),
    }))
    .sort(compareLooseChanges);

  const stoppedBeingAttackedAndUndefended = mappedBefore
    .filter(({ piece }) => !afterKeys.has(pieceKey(piece)))
    .map(({ piece, previousSquare }) => ({
      piece,
      ...(previousSquare ? { previousSquare } : {}),
    }))
    .sort(compareLooseChanges);

  return {
    move,
    material: {
      countChanges: compareMaterialCounts(before, after),
      whitePointsBefore: before.material.whitePoints,
      whitePointsAfter: after.material.whitePoints,
      blackPointsBefore: before.material.blackPoints,
      blackPointsAfter: after.material.blackPoints,
      whiteMinusBlackBefore: before.material.whiteMinusBlack,
      whiteMinusBlackAfter: after.material.whiteMinusBlack,
    },
    check: {
      entered: after.inCheck ? [after.sideToMove] : [],
      left: before.inCheck ? [before.sideToMove] : [],
    },
    becameAttackedAndUndefended,
    stoppedBeingAttackedAndUndefended,
  };
}

function compareMaterialCounts(
  before: PositionInsights,
  after: PositionInsights,
) {
  return colorOrder.flatMap((color) =>
    materialOrder.flatMap((type) => {
      const beforeCount = materialFor(before, color)[type];
      const afterCount = materialFor(after, color)[type];
      const delta = afterCount - beforeCount;

      return delta === 0
        ? []
        : [
            {
              color,
              type,
              before: beforeCount,
              after: afterCount,
              pointDelta: delta * MATERIAL_VALUES[type],
            },
          ];
    }),
  );
}

function materialFor(
  insights: PositionInsights,
  color: InsightColor,
): MaterialCounts {
  return insights.material[color];
}

function mapBeforeFinding(
  finding: LooseFinding,
  move: AppliedMove,
): LoosePieceStatusChange[] {
  if (move.captured && samePiece(finding.piece, move.captured)) {
    return [];
  }

  if (
    finding.piece.color === move.color &&
    finding.piece.type === move.piece &&
    finding.piece.square === move.from
  ) {
    return [
      {
        piece: {
          ...finding.piece,
          type: move.promotion ?? finding.piece.type,
          square: move.to,
        },
        ...(move.from === move.to ? {} : { previousSquare: move.from }),
      },
    ];
  }

  if (
    move.castlingRook &&
    finding.piece.color === move.color &&
    finding.piece.type === "rook" &&
    finding.piece.square === move.castlingRook.from
  ) {
    return [
      {
        piece: { ...finding.piece, square: move.castlingRook.to },
        previousSquare: move.castlingRook.from,
      },
    ];
  }

  return [{ piece: finding.piece }];
}

function previousSquareFor(piece: InsightPiece, move: AppliedMove) {
  if (
    piece.color === move.color &&
    piece.type === (move.promotion ?? move.piece) &&
    piece.square === move.to
  ) {
    return { previousSquare: move.from };
  }
  if (
    move.castlingRook &&
    piece.color === move.color &&
    piece.type === "rook" &&
    piece.square === move.castlingRook.to
  ) {
    return { previousSquare: move.castlingRook.from };
  }
  return {};
}

function samePiece(left: InsightPiece, right: InsightPiece) {
  return pieceKey(left) === pieceKey(right);
}

function pieceKey(piece: InsightPiece) {
  return `${piece.color}:${piece.type}:${piece.square}`;
}

function compareLooseChanges(
  left: LoosePieceStatusChange,
  right: LoosePieceStatusChange,
) {
  const colors =
    (left.piece.color === "white" ? 0 : 1) -
    (right.piece.color === "white" ? 0 : 1);
  return colors || left.piece.square.localeCompare(right.piece.square);
}
