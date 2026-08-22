import type {
  LoosePieceStatusChange,
  MaterialCountChange,
  PositionChanges,
} from "../chess/positionChanges";
import type {
  InsightColor,
  InsightPiece,
  InsightPieceType,
} from "../chess/position";

type PositionChangesPanelProps = {
  changes: PositionChanges | null;
};

export function PositionChangesPanel({ changes }: PositionChangesPanelProps) {
  if (!changes) {
    return (
      <section
        className="position-changes-panel"
        aria-labelledby="position-changes-title"
      >
        <h2 id="position-changes-title">What changed?</h2>
        <p className="changes-empty">
          Make a move on the board to see what changed.
        </p>
      </section>
    );
  }

  const hasTrackedChanges =
    changes.material.countChanges.length > 0 ||
    changes.check.entered.length > 0 ||
    changes.check.left.length > 0 ||
    changes.becameAttackedAndUndefended.length > 0 ||
    changes.stoppedBeingAttackedAndUndefended.length > 0;

  return (
    <section
      className="position-changes-panel"
      aria-labelledby="position-changes-title"
    >
      <h2 id="position-changes-title">What changed?</h2>
      <p className="changes-move">
        After <strong>{changes.move.san}</strong>
      </p>

      {hasTrackedChanges ? (
        <>
          <ul className="changes-list">
            {changes.check.entered.map((color) => (
              <li key={`entered-check-${color}`}>
                {titleCase(color)} is now in check.
              </li>
            ))}
            {changes.check.left.map((color) => (
              <li key={`left-check-${color}`}>
                {titleCase(color)} is no longer in check.
              </li>
            ))}
            {changes.material.countChanges.map((change) => (
              <li key={`material-${change.color}-${change.type}`}>
                {formatMaterialCountChange(change)}
              </li>
            ))}
            {materialTotalChanges(changes).map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
            {changes.material.whiteMinusBlackBefore !==
              changes.material.whiteMinusBlackAfter && (
              <li>
                Material balance changed from{" "}
                {formatMaterialBalance(changes.material.whiteMinusBlackBefore)}{" "}
                to{" "}
                {formatMaterialBalance(changes.material.whiteMinusBlackAfter)}.
              </li>
            )}
            {changes.becameAttackedAndUndefended.map((change) => (
              <li key={`became-loose-${pieceKey(change.piece)}`}>
                {formatBecameLoose(change)}
              </li>
            ))}
            {changes.stoppedBeingAttackedAndUndefended.map((change) => (
              <li key={`stopped-loose-${pieceKey(change.piece)}`}>
                {formatStoppedBeingLoose(change)}
              </li>
            ))}
          </ul>
          {changes.becameAttackedAndUndefended.length > 0 && (
            <p className="changes-note">
              This uses the static loose-piece rule above; it does not prove a
              piece can be won.
            </p>
          )}
        </>
      ) : (
        <p className="changes-empty">
          No tracked material, check, or loose-piece status changed.
        </p>
      )}
    </section>
  );
}

function formatMaterialCountChange(change: MaterialCountChange) {
  return `${titleCase(change.color)}'s ${change.type} count changed from ${change.before} to ${change.after} (${formatSignedPoints(change.pointDelta)}).`;
}

function materialTotalChanges(changes: PositionChanges) {
  const totals = {
    white: [
      changes.material.whitePointsBefore,
      changes.material.whitePointsAfter,
    ],
    black: [
      changes.material.blackPointsBefore,
      changes.material.blackPointsAfter,
    ],
  } satisfies Record<InsightColor, [number, number]>;

  return (["white", "black"] as const).flatMap((color) => {
    const countChangeCount = changes.material.countChanges.filter(
      (change) => change.color === color,
    ).length;
    const [before, after] = totals[color];

    return countChangeCount > 1 && before !== after
      ? [
          `${titleCase(color)}'s material total changed from ${before} to ${after} (${formatSignedPoints(after - before)}).`,
        ]
      : [];
  });
}

function formatMaterialBalance(balance: number) {
  if (balance === 0) {
    return "Equal";
  }
  return balance > 0 ? `White +${balance}` : `Black +${Math.abs(balance)}`;
}

function formatSignedPoints(points: number) {
  const sign = points > 0 ? "+" : "−";
  const amount = Math.abs(points);
  return `${sign}${amount} ${amount === 1 ? "point" : "points"}`;
}

function formatPieceList(pieces: InsightPiece[]) {
  const items = pieces.map(formatPiece);
  if (items.length <= 1) {
    return items[0] ?? "an unknown piece";
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function formatBecameLoose(change: LoosePieceStatusChange) {
  const movement = change.previousSquare
    ? ` after moving from ${change.previousSquare}`
    : "";
  return `${formatPiece(change.piece)} became attacked and undefended${movement} — attacked by ${formatPieceList(change.attackers ?? [])}.`;
}

function formatStoppedBeingLoose(change: LoosePieceStatusChange) {
  const movement = change.previousSquare
    ? ` after moving from ${change.previousSquare}`
    : "";
  return `${formatPiece(change.piece)} is no longer attacked and undefended${movement}.`;
}

function formatPiece(piece: InsightPiece) {
  return `${titleCase(piece.color)} ${piece.type} on ${piece.square}`;
}

function pieceKey(piece: InsightPiece) {
  return `${piece.color}-${piece.type}-${piece.square}`;
}

function titleCase(value: InsightColor | InsightPieceType) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
