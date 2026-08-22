import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ReviewMoment } from "../analysis/reviewMoments";
import type { ImportedGame, ImportedGamePosition } from "../chess/game";
import { formatEvaluation } from "../engine/formatEvaluation";
import {
  GAME_POSITION_MOVE_TIME_MS,
  type GameAnalysisState,
} from "../engine/types";
import { ReviewMomentsPanel } from "./ReviewMomentsPanel";

export type GameTaskView = "review" | "position-details";

type GameReviewPanelProps = {
  pgnDraft: string;
  error: string | null;
  game: ImportedGame | null;
  positionIndex: number | null;
  gameAnalysis: GameAnalysisState;
  reviewMoments: ReviewMoment[];
  canAnalyseGame: boolean;
  positionDetails: ReactNode;
  onDraftChange: (pgn: string) => void;
  onLoad: () => void;
  onNavigate: (positionIndex: number) => void;
  onRevealPosition: (positionIndex: number) => void;
  onStartAnalysis: () => void;
  onCancelAnalysis: () => void;
};

export function GameReviewPanel({
  pgnDraft,
  error,
  game,
  positionIndex,
  gameAnalysis,
  reviewMoments,
  canAnalyseGame,
  positionDetails,
  onDraftChange,
  onLoad,
  onNavigate,
  onRevealPosition,
  onStartAnalysis,
  onCancelAnalysis,
}: GameReviewPanelProps) {
  const [showPgnForm, setShowPgnForm] = useState(game === null);
  const [activeView, setActiveView] = useState<GameTaskView>("review");
  const pgnInputRef = useRef<HTMLTextAreaElement>(null);
  const moveListRef = useRef<HTMLOListElement>(null);
  const trackedGameRef = useRef(game);

  useEffect(() => {
    if (trackedGameRef.current === game) {
      return;
    }

    trackedGameRef.current = game;
    setShowPgnForm(game === null);
    setActiveView("review");
  }, [game]);

  useEffect(() => {
    if (game && showPgnForm) {
      pgnInputRef.current?.focus();
    }
  }, [game, showPgnForm]);

  useEffect(() => {
    if (activeView !== "review") {
      return;
    }

    const selectedMove = moveListRef.current?.querySelector<HTMLElement>(
      '[aria-current="step"]',
    );
    selectedMove?.scrollIntoView?.({ block: "nearest" });
  }, [activeView, positionIndex]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLoad();
  }

  const lastIndex = game ? game.positions.length - 1 : 0;
  const moveRows = game ? groupMoves(game) : [];
  const selectedEvaluation =
    game && positionIndex !== null
      ? matchingEvaluation(game, positionIndex, gameAnalysis)
      : null;

  return (
    <section className="game-review-panel" aria-labelledby="game-review-title">
      <h2 id="game-review-title">{game ? "Game review" : "Review a game"}</h2>

      {game && !showPgnForm && (
        <button
          type="button"
          className="secondary-button game-replace-button"
          onClick={() => setShowPgnForm(true)}
        >
          Load another game
        </button>
      )}

      {showPgnForm && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="pgn-input">PGN</label>
          <textarea
            ref={pgnInputRef}
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
          <div className="form-actions">
            <button type="submit">Load game</button>
            {game && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowPgnForm(false)}
              >
                Keep current game
              </button>
            )}
          </div>
        </form>
      )}

      {game && positionIndex !== null && (
        <div className="game-navigation">
          <div className="game-summary">{formatGameSummary(game)}</div>

          <div className="game-position-toolbar">
            <p className="game-position-status" aria-live="polite">
              <strong>
                {positionIndex === 0
                  ? "Start position"
                  : `After ${formatMoveLabel(game.positions[positionIndex])}`}
              </strong>
              <span>
                {positionIndex} of {lastIndex} plies
              </span>
              {selectedEvaluation && (
                <span>Evaluation {selectedEvaluation}</span>
              )}
            </p>
            <GameNavigationButtons
              positionIndex={positionIndex}
              lastIndex={lastIndex}
              onNavigate={onNavigate}
            />
          </div>

          <div
            className="game-task-tabs"
            role="tablist"
            aria-label="Game review view"
          >
            <TaskTab
              id="game-review-tab"
              controls="game-review-view"
              selected={activeView === "review"}
              onSelect={() => setActiveView("review")}
            >
              Review
            </TaskTab>
            <TaskTab
              id="position-details-tab"
              controls="position-details-view"
              selected={activeView === "position-details"}
              onSelect={() => setActiveView("position-details")}
            >
              Position details
            </TaskTab>
          </div>

          {activeView === "review" ? (
            <div
              id="game-review-view"
              className="game-task-panel"
              role="tabpanel"
              aria-labelledby="game-review-tab"
            >
              <GameAnalysisControls
                analysis={gameAnalysis}
                canAnalyse={canAnalyseGame}
                initialFen={game.positions[0].fen}
                onStart={onStartAnalysis}
                onCancel={onCancelAnalysis}
              />
              <ReviewMomentsPanel
                status={gameAnalysis.status}
                moments={reviewMoments}
                selectedPositionIndex={positionIndex}
                onNavigate={onRevealPosition}
              />
              {lastIndex > 0 && (
                <div className="game-move-list-container">
                  <h3>Main line</h3>
                  <ol
                    ref={moveListRef}
                    className="game-move-list"
                    aria-label="Main-line moves"
                  >
                    {moveRows.map((row) => (
                      <li key={row.moveNumber}>
                        <span className="move-number" aria-hidden="true">
                          {row.white
                            ? `${row.moveNumber}.`
                            : `${row.moveNumber}...`}
                        </span>
                        {row.white &&
                          renderMoveButton(
                            row.white,
                            positionIndex,
                            gameAnalysis,
                            onRevealPosition,
                          )}
                        {row.black &&
                          renderMoveButton(
                            row.black,
                            positionIndex,
                            gameAnalysis,
                            onRevealPosition,
                          )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div
              id="position-details-view"
              className="game-task-panel game-position-details"
              role="tabpanel"
              aria-labelledby="position-details-tab"
            >
              {positionDetails}
            </div>
          )}

          <p className="game-exit-note">
            Moving a piece or loading a standalone FEN leaves game review.
          </p>
        </div>
      )}
    </section>
  );
}

function TaskTab({
  id,
  controls,
  selected,
  onSelect,
  children,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      className="game-task-tab"
      aria-selected={selected}
      aria-controls={controls}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function GameNavigationButtons({
  positionIndex,
  lastIndex,
  onNavigate,
}: {
  positionIndex: number;
  lastIndex: number;
  onNavigate: (positionIndex: number) => void;
}) {
  return (
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
  gameAnalysis: GameAnalysisState,
  onNavigate: (positionIndex: number) => void,
) {
  const { position, positionIndex } = indexedMove;
  const label = formatMoveLabel(position);
  const result = gameAnalysis.results[positionIndex];
  const evaluation =
    result?.fen === position.fen ? formatEvaluation(result.evaluation) : null;
  const accessibleEvaluation = evaluation ? `, evaluation ${evaluation}` : "";

  return (
    <button
      type="button"
      className={`move-button move-${position.move?.color}`}
      aria-label={`Go to after ${label}${accessibleEvaluation}`}
      aria-current={positionIndex === currentPositionIndex ? "step" : undefined}
      onClick={() => onNavigate(positionIndex)}
    >
      <span>{position.move?.san}</span>
      {evaluation && <span className="move-evaluation">{evaluation}</span>}
    </button>
  );
}

function matchingEvaluation(
  game: ImportedGame,
  positionIndex: number,
  analysis: GameAnalysisState,
) {
  const position = game.positions[positionIndex];
  const result = analysis.results[positionIndex];
  return result?.fen === position.fen && result.evaluation
    ? formatEvaluation(result.evaluation)
    : null;
}

type GameAnalysisControlsProps = {
  analysis: GameAnalysisState;
  canAnalyse: boolean;
  initialFen: string;
  onStart: () => void;
  onCancel: () => void;
};

function GameAnalysisControls({
  analysis,
  canAnalyse,
  initialFen,
  onStart,
  onCancel,
}: GameAnalysisControlsProps) {
  const initialResult = analysis.results[0];
  const initialEvaluation =
    initialResult?.fen === initialFen
      ? formatEvaluation(initialResult.evaluation)
      : null;

  return (
    <div
      className="game-analysis-controls"
      aria-labelledby="game-analysis-title"
    >
      <h3 id="game-analysis-title">Game analysis</h3>
      <p className="game-analysis-note">
        Quick engine pass · {GAME_POSITION_MOVE_TIME_MS} ms per position
      </p>

      {analysis.status === "running" ? (
        <>
          <p className="game-analysis-progress" aria-live="polite">
            Analysing game: {analysis.completedCount} of {analysis.totalCount}{" "}
            positions
          </p>
          <progress
            aria-label="Game analysis progress"
            max={analysis.totalCount}
            value={analysis.completedCount}
          />
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel analysis
          </button>
        </>
      ) : (
        <>
          {analysis.status === "complete" && (
            <p>Analysis complete: {analysis.completedCount} positions.</p>
          )}
          {analysis.status === "cancelled" && (
            <p>
              Analysis cancelled: {analysis.completedCount} of{" "}
              {analysis.totalCount} positions retained.
            </p>
          )}
          {analysis.status === "error" && (
            <p className="error-message" role="alert">
              Game analysis stopped.{" "}
              {analysis.errorMessage ?? "Engine unavailable."}
            </p>
          )}
          {analysis.status !== "error" && (
            <button
              type="button"
              className="secondary-button"
              disabled={!canAnalyse}
              onClick={onStart}
            >
              {analysis.status === "idle" ? "Analyse game" : "Analyse again"}
            </button>
          )}
        </>
      )}

      {initialEvaluation && (
        <p className="starting-evaluation">
          Starting evaluation: <strong>{initialEvaluation}</strong>
        </p>
      )}
    </div>
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
