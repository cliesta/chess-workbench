import type { PromotionPiece } from "../chess/position";

const promotionNames: Record<PromotionPiece, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

type PromotionDialogProps = {
  choices: PromotionPiece[];
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

export function PromotionDialog({
  choices,
  onChoose,
  onCancel,
}: PromotionDialogProps) {
  return (
    <div className="dialog-backdrop">
      <div
        className="promotion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
      >
        <h2 id="promotion-title">Choose promotion piece</h2>
        <div className="promotion-choices">
          {choices.map((piece, index) => (
            <button
              key={piece}
              type="button"
              autoFocus={index === 0}
              onClick={() => onChoose(piece)}
            >
              {promotionNames[piece]}
            </button>
          ))}
        </div>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
