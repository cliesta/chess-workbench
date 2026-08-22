import type {
  InsightPiece,
  MaterialCounts,
  PositionInsights,
} from "../chess/position";

type PositionInsightsPanelProps = {
  insights: PositionInsights;
  selectedSquare: string | null;
  onSelectSquare: (square: string | null) => void;
};

const materialOrder: Array<keyof MaterialCounts> = [
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];

export function PositionInsightsPanel({
  insights,
  selectedSquare,
  onSelectSquare,
}: PositionInsightsPanelProps) {
  return (
    <section
      className="position-insights-panel"
      aria-labelledby="position-insights-title"
    >
      <h2 id="position-insights-title">Position insights</h2>

      <div className="position-status">
        <strong>{titleCase(insights.sideToMove)} to move</strong>
        <span className={insights.inCheck ? "check-status" : "quiet-status"}>
          {insights.inCheck ? "In check" : "Not in check"}
        </span>
      </div>

      <section className="insight-section" aria-labelledby="material-title">
        <h3 id="material-title">Material</h3>
        <p className="material-summary">
          {formatMaterialBalance(insights.material.whiteMinusBlack)}
          <span>
            {insights.material.whitePoints}–{insights.material.blackPoints}
          </span>
        </p>
        <p>
          <strong>White:</strong>{" "}
          {formatMaterialCounts(insights.material.white)}
        </p>
        <p>
          <strong>Black:</strong>{" "}
          {formatMaterialCounts(insights.material.black)}
        </p>
      </section>

      <section className="insight-section" aria-labelledby="loose-pieces-title">
        <h3 id="loose-pieces-title">Attacked and undefended</h3>
        <p className="insight-explanation">
          A loose piece is attacked and has no friendly piece attacking its
          square. This is a warning, not proof that the piece can be won.
        </p>
        {insights.attackedAndUndefended.length === 0 ? (
          <p className="insight-empty">No loose pieces found.</p>
        ) : (
          <ul className="insight-findings">
            {insights.attackedAndUndefended.map((finding) => {
              const isSelected = finding.piece.square === selectedSquare;
              const description = formatFinding(
                finding.piece,
                finding.attackers,
              );

              return (
                <li key={`${finding.piece.color}-${finding.piece.square}`}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onSelectSquare(isSelected ? null : finding.piece.square)
                    }
                  >
                    {description}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

function formatMaterialBalance(whiteMinusBlack: number) {
  if (whiteMinusBlack === 0) {
    return "Equal";
  }
  return whiteMinusBlack > 0
    ? `White +${whiteMinusBlack}`
    : `Black +${Math.abs(whiteMinusBlack)}`;
}

function formatMaterialCounts(counts: MaterialCounts) {
  return materialOrder
    .map((type) => `${pluralPieceName(type, counts[type])} ${counts[type]}`)
    .join(" · ");
}

function formatFinding(piece: InsightPiece, attackers: InsightPiece[]) {
  return `${formatPiece(piece)} — attacked by ${formatList(
    attackers.map(formatPiece),
  )}.`;
}

function formatPiece(piece: InsightPiece) {
  return `${titleCase(piece.color)} ${piece.type} on ${piece.square}`;
}

function formatList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "an unknown piece";
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function pluralPieceName(type: keyof MaterialCounts, count: number) {
  const name = titleCase(type);
  return count === 1 ? name : `${name}s`;
}

function titleCase(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
