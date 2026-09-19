import type { ExplorationHistory } from "../workspace";

type ExplorationControlsProps = {
  history: ExplorationHistory;
  gameSourceLabel?: string;
  onBack: () => void;
  onForward: () => void;
  onReset: () => void;
  onReturnToGame?: () => void;
};

export function ExplorationControls({
  history,
  gameSourceLabel,
  onBack,
  onForward,
  onReset,
  onReturnToGame,
}: ExplorationControlsProps) {
  const lastCursor = history.entries.length - 1;
  const hasMoves = lastCursor > 0;

  return (
    <section
      className="exploration-controls"
      aria-labelledby="exploration-title"
    >
      <div className="exploration-status" aria-live="polite">
        <h3 id="exploration-title">
          {gameSourceLabel ? "Temporary exploration" : "Exploration line"}
        </h3>
        <p>
          {gameSourceLabel && <span>From {gameSourceLabel} · </span>}
          {history.cursor === 0
            ? "Root position"
            : `Move ${history.cursor} of ${lastCursor}`}
        </p>
      </div>
      <div className="exploration-buttons">
        <button
          type="button"
          className="secondary-button"
          disabled={history.cursor === 0}
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={history.cursor === lastCursor}
          onClick={onForward}
        >
          Forward
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!hasMoves}
          onClick={onReset}
        >
          Reset line
        </button>
        {onReturnToGame && (
          <button type="button" onClick={onReturnToGame}>
            Return to game
          </button>
        )}
      </div>
    </section>
  );
}
