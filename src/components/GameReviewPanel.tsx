import type { FormEvent } from "react";
import type { ImportedGame } from "../chess/game";
import type { ImportedGamePosition } from "../chess/game";

type GameReviewPanelProps = {
  pgnDraft: string;
  error: string | null;
  game: ImportedGame | null;
  positionIndex: number | null;
  onDraftChange: (pgn: string) => void;
  onLoad: () => void;
  onNavigate: (positionIndex: number) => void;
};

export function GameReviewPanel({
  pgnDraft,
  error,
  game,
  positionIndex,
  onDraftChange,
  onLoad,
  onNavigate,
}: GameReviewPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLoad();
  }

  const lastIndex = game ? game.positions.length - 1 : 0;
  const moveRows = game ? groupMoves(game) : [];

  return (
    <section className="game-review-panel" aria-labelledby="game-review-title">
      <h2 id="game-review-title">Game review</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="pgn-input">PGN</label>
        <textarea
          id="pgn-input"
          value={pgnDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? "pgn-help pgn-error" : "pgn-help"}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          rows={7}
        />
        <p id="pgn-help" className="field-note">
          Main line only. Comments and annotations are not displayed.
        </p>
        {error && (
          <p id="pgn-error" className="error-message" role="alert">
            {error}
          </p>
        )}
        <button type="submit">Load game</button>
      </form>

      {game && positionIndex !== null && (
        <div className="game-navigation">
          <div className="game-summary">{formatGameSummary(game)}</div>
          <p className="game-position-status" aria-live="polite">
            <strong>
              {positionIndex === 0
                ? "Start position"
                : `After ${formatMoveLabel(game.positions[positionIndex])}`}
            </strong>
            <span>
              {positionIndex} of {lastIndex} plies
            </span>
          </p>
          <div className="game-navigation-buttons" aria-label="Game navigation">
            <button
              type="button"
              className="secondary-button"
              disabled={positionIndex === 0}
              onClick={() => onNavigate(0)}
            >
              First
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={positionIndex === 0}
              onClick={() => onNavigate(positionIndex - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={positionIndex === lastIndex}
              onClick={() => onNavigate(positionIndex + 1)}
            >
              Next
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={positionIndex === lastIndex}
              onClick={() => onNavigate(lastIndex)}
            >
              Last
            </button>
          </div>
          {lastIndex > 0 && (
            <ol className="game-move-list" aria-label="Main-line moves">
              {moveRows.map((row) => {
                return (
                  <li key={row.moveNumber}>
                    <span className="move-number" aria-hidden="true">
                      {row.white
                        ? `${row.moveNumber}.`
                        : `${row.moveNumber}...`}
                    </span>
                    {row.white &&
                      renderMoveButton(row.white, positionIndex, onNavigate)}
                    {row.black &&
                      renderMoveButton(row.black, positionIndex, onNavigate)}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="game-exit-note">
            Moving a piece or loading a FEN leaves game review.
          </p>
        </div>
      )}
    </section>
  );
}

function formatMoveLabel(position: ImportedGamePosition) {
  if (!position.move || position.moveNumber === undefined) {
    return "unknown move";
  }

  const separator = position.move.color === "white" ? ". " : "... ";
  return `${position.moveNumber}${separator}${position.move.san}`;
}

type IndexedMove = {
  position: ImportedGamePosition;
  positionIndex: number;
};

type MoveRow = {
  moveNumber: number;
  white?: IndexedMove;
  black?: IndexedMove;
};

function groupMoves(game: ImportedGame): MoveRow[] {
  const rows: MoveRow[] = [];

  game.positions.slice(1).forEach((position, index) => {
    if (!position.move || position.moveNumber === undefined) {
      return;
    }

    let row = rows.at(-1);
    if (!row || row.moveNumber !== position.moveNumber) {
      row = { moveNumber: position.moveNumber };
      rows.push(row);
    }

    row[position.move.color] = { position, positionIndex: index + 1 };
  });

  return rows;
}

function renderMoveButton(
  indexedMove: IndexedMove,
  currentPositionIndex: number,
  onNavigate: (positionIndex: number) => void,
) {
  const { position, positionIndex } = indexedMove;
  const label = formatMoveLabel(position);

  return (
    <button
      type="button"
      className={`move-button move-${position.move?.color}`}
      aria-label={`Go to after ${label}`}
      aria-current={positionIndex === currentPositionIndex ? "step" : undefined}
      onClick={() => onNavigate(positionIndex)}
    >
      {position.move?.san}
    </button>
  );
}

function formatGameSummary(game: ImportedGame) {
  const { headers } = game;
  const players =
    headers.white || headers.black
      ? `${headers.white ?? "Unknown"} vs ${headers.black ?? "Unknown"}`
      : "Unknown players";
  const details = [
    headers.result,
    headers.date,
    headers.event,
    headers.round ? `Round ${headers.round}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return (
    <>
      <strong>{players}</strong>
      {details.length > 0 && <span>{details.join(" · ")}</span>}
    </>
  );
}
