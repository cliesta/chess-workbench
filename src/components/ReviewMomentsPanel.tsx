import type { ReviewMoment } from "../analysis/reviewMoments";
import { formatEvaluation } from "../engine/formatEvaluation";
import type { GameAnalysisStatus } from "../engine/types";

type ReviewMomentsPanelProps = {
  status: GameAnalysisStatus;
  moments: ReviewMoment[];
  selectedPositionIndex: number;
  onNavigate: (positionIndex: number) => void;
};

export function ReviewMomentsPanel({
  status,
  moments,
  selectedPositionIndex,
  onNavigate,
}: ReviewMomentsPanelProps) {
  const isPartial = status === "cancelled" || status === "error";
  const title = isPartial ? "Partial review moments" : "Review moments";

  return (
    <section className="review-moments" aria-labelledby="review-moments-title">
      <h3 id="review-moments-title">{title}</h3>
      <p className="review-moments-introduction">
        These are the largest clear deteriorations found by the quick engine
        pass. Smaller changes are ignored, and the list is not a move grade.
      </p>

      {status === "idle" && <p>Analyse the game to find review moments.</p>}
      {status === "running" && (
        <p aria-live="polite">
          Review moments will settle when the quick pass stops.
        </p>
      )}
      {(status === "complete" || isPartial) && moments.length === 0 && (
        <p>
          {isPartial
            ? "No large evaluation swings were found in the retained results."
            : "No large evaluation swings were found in this quick pass."}
        </p>
      )}
      {(status === "complete" || isPartial) && moments.length > 0 && (
        <ol className="review-moment-list">
          {moments.map((moment, index) => (
            <li key={moment.positionIndex} className="review-moment">
              <h4>
                Review {index + 1} · After {formatMoveLabel(moment)}
              </h4>
              <p className="review-evaluation">
                Evaluation: {formatEvaluation(moment.beforeEvaluation)} →{" "}
                {formatEvaluation(moment.afterEvaluation)}
              </p>
              <p>{describeChange(moment)}</p>
              <p className="review-engine-line">{describeEngineLine(moment)}</p>
              <button
                type="button"
                className="secondary-button review-position-button"
                aria-label={`Show position after ${formatMoveLabel(moment)}`}
                aria-current={
                  moment.positionIndex === selectedPositionIndex
                    ? "location"
                    : undefined
                }
                onClick={() => onNavigate(moment.positionIndex)}
              >
                Show position
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function describeChange(moment: ReviewMoment) {
  const mover = moment.move.color === "white" ? "White" : "Black";

  switch (moment.kind) {
    case "centipawn-loss":
      return `${mover}'s position worsened by about ${(
        (moment.lossCentipawns ?? 0) / 100
      ).toFixed(2)} pawns.`;
    case "allowed-mate":
      return `${mover} allowed a forced mate.`;
    case "lost-mate":
      return `${mover} lost a forced mate.`;
    case "mate-reversal": {
      const opponent = mover === "White" ? "Black" : "White";
      return `The move changed a forced mate for ${mover} into a forced mate for ${opponent}.`;
    }
  }
}

function describeEngineLine(moment: ReviewMoment) {
  if (moment.engineLineBeforeMoveUsesRawNotation) {
    return "Engine line notation was unavailable.";
  }
  if (!moment.engineLineBeforeMove) {
    return "No engine line was retained for this position.";
  }
  return `Engine line before the move: ${moment.engineLineBeforeMove}`;
}

function formatMoveLabel(moment: ReviewMoment) {
  if (moment.moveNumber === undefined) {
    return moment.move.san;
  }
  const separator = moment.move.color === "white" ? ". " : "... ";
  return `${moment.moveNumber}${separator}${moment.move.san}`;
}
