import type { ImportedGame } from "../chess/game";
import type { AppliedMove } from "../chess/position";
import type { CompletedPositionAnalysis, Evaluation } from "../engine/types";

export const MIN_REVIEW_LOSS_CENTIPAWNS = 75;

export type ReviewMomentKind =
  "centipawn-loss" | "lost-mate" | "allowed-mate" | "mate-reversal";

export type ReviewMoment = {
  kind: ReviewMomentKind;
  positionIndex: number;
  moveNumber?: number;
  move: AppliedMove;
  beforeEvaluation: Evaluation;
  afterEvaluation: Evaluation;
  lossCentipawns?: number;
  engineLineBeforeMove: string | null;
  engineLineBeforeMoveUsesRawNotation: boolean;
};

type MatePerspective = "winning" | "losing" | "unrankable";

const kindPriority: Record<ReviewMomentKind, number> = {
  "mate-reversal": 0,
  "allowed-mate": 1,
  "lost-mate": 2,
  "centipawn-loss": 3,
};

export function findReviewMoments(
  game: ImportedGame,
  results: Array<CompletedPositionAnalysis | null>,
): ReviewMoment[] {
  const candidates: ReviewMoment[] = [];

  for (
    let positionIndex = 1;
    positionIndex < game.positions.length;
    positionIndex += 1
  ) {
    const beforePosition = game.positions[positionIndex - 1];
    const afterPosition = game.positions[positionIndex];
    const beforeResult = results[positionIndex - 1];
    const afterResult = results[positionIndex];
    const move = afterPosition.move;

    if (
      !beforeResult ||
      !afterResult ||
      !move ||
      beforeResult.fen !== beforePosition.fen ||
      afterResult.fen !== afterPosition.fen ||
      !beforeResult.evaluation ||
      !afterResult.evaluation
    ) {
      continue;
    }

    const kind = classifyChange(
      move,
      beforeResult.evaluation,
      afterResult.evaluation,
    );
    if (!kind) {
      continue;
    }

    const engineLineUsesRawNotation =
      beforeResult.principalVariationUsesRawNotation;
    candidates.push({
      kind: kind.kind,
      positionIndex,
      moveNumber: afterPosition.moveNumber,
      move,
      beforeEvaluation: beforeResult.evaluation,
      afterEvaluation: afterResult.evaluation,
      ...(kind.kind === "centipawn-loss"
        ? { lossCentipawns: kind.lossCentipawns }
        : {}),
      engineLineBeforeMove: engineLineUsesRawNotation
        ? null
        : beforeResult.principalVariation,
      engineLineBeforeMoveUsesRawNotation: engineLineUsesRawNotation,
    });
  }

  return candidates
    .sort((left, right) => {
      const priorityDifference =
        kindPriority[left.kind] - kindPriority[right.kind];
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (left.kind === "centipawn-loss" && right.kind === "centipawn-loss") {
        const lossDifference =
          (right.lossCentipawns ?? 0) - (left.lossCentipawns ?? 0);
        if (lossDifference !== 0) {
          return lossDifference;
        }
      }

      return left.positionIndex - right.positionIndex;
    })
    .slice(0, 3);
}

function classifyChange(
  move: AppliedMove,
  before: Evaluation,
  after: Evaluation,
):
  | { kind: Exclude<ReviewMomentKind, "centipawn-loss"> }
  | { kind: "centipawn-loss"; lossCentipawns: number }
  | null {
  if (before.kind === "centipawns" && after.kind === "centipawns") {
    const direction = move.color === "white" ? 1 : -1;
    const lossCentipawns =
      direction * before.whiteCentipawns - direction * after.whiteCentipawns;

    return lossCentipawns >= MIN_REVIEW_LOSS_CENTIPAWNS
      ? { kind: "centipawn-loss", lossCentipawns }
      : null;
  }

  const beforeMate = matePerspective(before, move.color);
  const afterMate = matePerspective(after, move.color);

  if (beforeMate === "unrankable" || afterMate === "unrankable") {
    return null;
  }
  if (beforeMate === "winning" && afterMate === "losing") {
    return { kind: "mate-reversal" };
  }
  if (beforeMate !== "losing" && afterMate === "losing") {
    return { kind: "allowed-mate" };
  }
  if (beforeMate === "winning" && afterMate !== "winning") {
    return { kind: "lost-mate" };
  }

  return null;
}

function matePerspective(
  evaluation: Evaluation,
  mover: AppliedMove["color"],
): MatePerspective | null {
  if (evaluation.kind === "centipawns") {
    return null;
  }
  if (evaluation.whiteMateIn === 0) {
    return "unrankable";
  }

  const whiteWins = evaluation.whiteMateIn > 0;
  return whiteWins === (mover === "white") ? "winning" : "losing";
}
