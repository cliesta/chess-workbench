import { useMemo, useState, type FormEvent } from "react";
import { findReviewMoments } from "./analysis/reviewMoments";
import { parseGame, type ImportedGame } from "./chess/game";
import {
  STARTING_FEN,
  attemptMove,
  getPositionInsights,
  parsePosition,
  type AppliedMove,
  type PromotionPiece,
} from "./chess/position";
import {
  comparePositionInsights,
  type PositionChanges,
} from "./chess/positionChanges";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { GameReviewPanel } from "./components/GameReviewPanel";
import { PositionBoard } from "./components/PositionBoard";
import { PositionChangesPanel } from "./components/PositionChangesPanel";
import { PositionInsightsPanel } from "./components/PositionInsightsPanel";
import { PromotionDialog } from "./components/PromotionDialog";
import {
  useWorkbenchAnalysis,
  type PositionAnalysisEngineFactory,
} from "./engine/useWorkbenchAnalysis";

type PendingPromotion = {
  from: string;
  to: string;
  choices: PromotionPiece[];
};

type Workspace =
  | {
      kind: "position";
      fen: string;
      changes: PositionChanges | null;
    }
  | {
      kind: "game";
      game: ImportedGame;
      positionIndex: number;
    };

type AppProps = {
  createEngine?: PositionAnalysisEngineFactory;
};

function App({ createEngine }: AppProps = {}) {
  const [workspace, setWorkspace] = useState<Workspace>({
    kind: "position",
    fen: STARTING_FEN,
    changes: null,
  });
  const [fenDraft, setFenDraft] = useState(STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnDraft, setPgnDraft] = useState("");
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);
  const [selectedInsightSquare, setSelectedInsightSquare] = useState<
    string | null
  >(null);
  const positionFen =
    workspace.kind === "position"
      ? workspace.fen
      : workspace.game.positions[workspace.positionIndex].fen;
  const lastPositionChanges =
    workspace.kind === "position"
      ? workspace.changes
      : (workspace.game.positions[workspace.positionIndex].changes ?? null);
  const currentGame = workspace.kind === "game" ? workspace.game : null;
  const currentGamePositionIndex =
    workspace.kind === "game" ? workspace.positionIndex : null;
  const analysis = useWorkbenchAnalysis({
    fen: positionFen,
    game: currentGame,
    positionIndex: currentGamePositionIndex,
    ...(createEngine ? { createEngine } : {}),
  });
  const insights = useMemo(
    () => getPositionInsights(positionFen),
    [positionFen],
  );
  const selectedFinding = insights.attackedAndUndefended.find(
    ({ piece }) => piece.square === selectedInsightSquare,
  );
  const reviewMoments = useMemo(
    () =>
      currentGame
        ? findReviewMoments(currentGame, analysis.gameAnalysis.results)
        : [],
    [currentGame, analysis.gameAnalysis.results],
  );

  function commitPosition(fen: string, changes: PositionChanges | null) {
    setWorkspace({ kind: "position", fen, changes });
    setFenDraft(fen);
    setFenError(null);
    setSelectedInsightSquare(null);
  }

  function commitMove(fen: string, move: AppliedMove) {
    const nextInsights = getPositionInsights(fen);
    commitPosition(fen, comparePositionInsights(insights, nextInsights, move));
  }

  function handleFenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parsePosition(fenDraft);

    if (result.kind === "invalid") {
      setFenError(result.message);
      return;
    }

    commitPosition(result.fen, null);
    setPendingPromotion(null);
  }

  function handleGameLoad() {
    const result = parseGame(pgnDraft);

    if (result.kind === "invalid") {
      setPgnError(result.message);
      return;
    }

    const initialFen = result.game.positions[0].fen;
    setWorkspace({ kind: "game", game: result.game, positionIndex: 0 });
    setFenDraft(initialFen);
    setFenError(null);
    setPgnError(null);
    setPendingPromotion(null);
    setSelectedInsightSquare(null);
  }

  function handleGameNavigation(positionIndex: number) {
    if (workspace.kind !== "game") {
      return;
    }

    const boundedIndex = Math.max(
      0,
      Math.min(positionIndex, workspace.game.positions.length - 1),
    );
    const fen = workspace.game.positions[boundedIndex].fen;

    setWorkspace({ ...workspace, positionIndex: boundedIndex });
    setFenDraft(fen);
    setFenError(null);
    setPendingPromotion(null);
    setSelectedInsightSquare(null);
  }

  function handleMove(from: string, to: string) {
    const result = attemptMove(positionFen, from, to);

    if (result.kind === "moved") {
      commitMove(result.fen, result.move);
      return true;
    }

    if (result.kind === "promotion-required") {
      setPendingPromotion({
        from: result.from,
        to: result.to,
        choices: result.choices,
      });
    }

    return false;
  }

  function handlePromotion(piece: PromotionPiece) {
    if (!pendingPromotion) {
      return;
    }

    const result = attemptMove(
      positionFen,
      pendingPromotion.from,
      pendingPromotion.to,
      piece,
    );

    if (result.kind === "moved") {
      commitMove(result.fen, result.move);
    }

    setPendingPromotion(null);
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Chess Workbench</h1>
        <p>Load a position or move a piece to explore the board.</p>
      </header>

      <div className="workbench">
        <PositionBoard
          position={positionFen}
          allowDragging={pendingPromotion === null}
          onMove={handleMove}
          highlightedTargetSquare={selectedFinding?.piece.square}
          highlightedAttackerSquares={selectedFinding?.attackers.map(
            ({ square }) => square,
          )}
        />

        <div className="side-panel">
          <GameReviewPanel
            pgnDraft={pgnDraft}
            error={pgnError}
            game={currentGame}
            positionIndex={currentGamePositionIndex}
            gameAnalysis={analysis.gameAnalysis}
            reviewMoments={reviewMoments}
            canAnalyseGame={analysis.canAnalyseGame}
            onDraftChange={setPgnDraft}
            onLoad={handleGameLoad}
            onNavigate={handleGameNavigation}
            onStartAnalysis={analysis.startGameAnalysis}
            onCancelAnalysis={analysis.cancelGameAnalysis}
          />

          <section
            className="position-controls"
            aria-labelledby="position-title"
          >
            <h2 id="position-title">Position</h2>
            <form onSubmit={handleFenSubmit}>
              <label htmlFor="fen-input">FEN</label>
              <input
                id="fen-input"
                type="text"
                value={fenDraft}
                onChange={(event) => setFenDraft(event.target.value)}
                aria-invalid={fenError !== null}
                aria-describedby={fenError ? "fen-error" : undefined}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
              {fenError && (
                <p id="fen-error" className="error-message" role="alert">
                  {fenError}
                </p>
              )}
              <button type="submit">Load position</button>
            </form>
          </section>

          <PositionInsightsPanel
            insights={insights}
            selectedSquare={selectedInsightSquare}
            onSelectSquare={setSelectedInsightSquare}
          />

          <PositionChangesPanel changes={lastPositionChanges} />

          <AnalysisPanel analysis={analysis.positionAnalysis} />
        </div>
      </div>

      {pendingPromotion && (
        <PromotionDialog
          choices={pendingPromotion.choices}
          onChoose={handlePromotion}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </main>
  );
}

export default App;
