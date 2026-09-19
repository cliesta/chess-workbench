import { useMemo, useRef, useState, type FormEvent } from "react";
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
import { comparePositionInsights } from "./chess/positionChanges";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ExplorationControls } from "./components/ExplorationControls";
import { GameReviewPanel } from "./components/GameReviewPanel";
import { PositionBoard } from "./components/PositionBoard";
import { PositionChangesPanel } from "./components/PositionChangesPanel";
import { PositionControls } from "./components/PositionControls";
import { PositionInsightsPanel } from "./components/PositionInsightsPanel";
import { PromotionDialog } from "./components/PromotionDialog";
import {
  useWorkbenchAnalysis,
  type PositionAnalysisEngineFactory,
} from "./engine/useWorkbenchAnalysis";
import {
  appendExplorationMove,
  createGameWorkspace,
  createPositionWorkspace,
  displayedEntry,
  getExploration,
  navigateExploration,
  navigateGame,
  resetExploration,
  returnToGame,
  type Workspace,
} from "./workspace";

type PendingPromotion = {
  from: string;
  to: string;
  choices: PromotionPiece[];
};

type AppProps = {
  createEngine?: PositionAnalysisEngineFactory;
};

function App({ createEngine }: AppProps = {}) {
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    createPositionWorkspace(STARTING_FEN),
  );
  const [fenDraft, setFenDraft] = useState(STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnDraft, setPgnDraft] = useState("");
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);
  const [selectedInsightSquare, setSelectedInsightSquare] = useState<
    string | null
  >(null);
  const boardPositionRef = useRef<HTMLElement>(null);
  const currentEntry = displayedEntry(workspace);
  const positionFen = currentEntry.fen;
  const lastPositionChanges = currentEntry.changes;
  const exploration = getExploration(workspace);
  const currentGame = workspace.kind === "game" ? workspace.game : null;
  const currentGamePositionIndex =
    workspace.kind === "game" && workspace.exploration === null
      ? workspace.positionIndex
      : null;
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
  const gameSourceLabel =
    workspace.kind === "game"
      ? formatGamePositionLabel(
          workspace.game.positions[workspace.positionIndex],
        )
      : null;
  const boardPositionLabel =
    workspace.kind === "game"
      ? workspace.exploration
        ? `Exploration from ${gameSourceLabel}`
        : (gameSourceLabel ?? "Game position")
      : "Current position";

  function replaceWithPosition(fen: string) {
    setWorkspace(createPositionWorkspace(fen));
    setFenDraft(fen);
    setFenError(null);
    setSelectedInsightSquare(null);
  }

  function commitMove(fen: string, move: AppliedMove) {
    const nextInsights = getPositionInsights(fen);
    const changes = comparePositionInsights(insights, nextInsights, move);
    setWorkspace((current) => appendExplorationMove(current, { fen, changes }));
    setFenDraft(fen);
    setFenError(null);
    setSelectedInsightSquare(null);
  }

  function handleFenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parsePosition(fenDraft);

    if (result.kind === "invalid") {
      setFenError(result.message);
      return;
    }

    replaceWithPosition(result.fen);
    setPendingPromotion(null);
  }

  function handleGameLoad() {
    const result = parseGame(pgnDraft);

    if (result.kind === "invalid") {
      setPgnError(result.message);
      return;
    }

    const initialFen = result.game.positions[0].fen;
    setWorkspace(createGameWorkspace(result.game));
    setFenDraft(initialFen);
    setFenError(null);
    setPgnError(null);
    setPendingPromotion(null);
    setSelectedInsightSquare(null);
  }

  function handleGameNavigation(positionIndex: number, revealBoard = false) {
    if (workspace.kind !== "game") {
      return;
    }

    const nextWorkspace = navigateGame(workspace, positionIndex);
    setWorkspace(nextWorkspace);
    setFenDraft(displayedEntry(nextWorkspace).fen);
    setFenError(null);
    setPendingPromotion(null);
    setSelectedInsightSquare(null);

    if (revealBoard) {
      revealBoardOnNarrowScreen();
    }
  }

  function handleExplorationNavigation(cursor: number) {
    const nextWorkspace = navigateExploration(workspace, cursor);
    setWorkspace(nextWorkspace);
    setFenDraft(displayedEntry(nextWorkspace).fen);
    clearPositionPresentation();
  }

  function handleExplorationReset() {
    const nextWorkspace = resetExploration(workspace);
    setWorkspace(nextWorkspace);
    setFenDraft(displayedEntry(nextWorkspace).fen);
    clearPositionPresentation();
  }

  function handleReturnToGame() {
    const nextWorkspace = returnToGame(workspace);
    setWorkspace(nextWorkspace);
    setFenDraft(displayedEntry(nextWorkspace).fen);
    clearPositionPresentation();
  }

  function clearPositionPresentation() {
    setFenError(null);
    setPendingPromotion(null);
    setSelectedInsightSquare(null);
  }

  function revealBoardOnNarrowScreen() {
    if (
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(max-width: 51.999rem)").matches
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      boardPositionRef.current?.scrollIntoView?.({ block: "start" });
      boardPositionRef.current?.focus({ preventScroll: true });
    });
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
        <section
          ref={boardPositionRef}
          className="board-column"
          aria-label={boardPositionLabel}
          tabIndex={-1}
        >
          <PositionBoard
            position={positionFen}
            allowDragging={pendingPromotion === null}
            onMove={handleMove}
            highlightedTargetSquare={selectedFinding?.piece.square}
            highlightedAttackerSquares={selectedFinding?.attackers.map(
              ({ square }) => square,
            )}
          />
        </section>

        <div className="side-panel">
          {workspace.kind === "game" ? (
            <GameReviewPanel
              pgnDraft={pgnDraft}
              error={pgnError}
              game={currentGame}
              positionIndex={workspace.positionIndex}
              isExploring={workspace.exploration !== null}
              gameAnalysis={analysis.gameAnalysis}
              reviewMoments={reviewMoments}
              canAnalyseGame={analysis.canAnalyseGame}
              explorationControls={
                workspace.exploration ? (
                  <ExplorationControls
                    history={workspace.exploration}
                    gameSourceLabel={gameSourceLabel ?? undefined}
                    onBack={() =>
                      handleExplorationNavigation(
                        workspace.exploration!.cursor - 1,
                      )
                    }
                    onForward={() =>
                      handleExplorationNavigation(
                        workspace.exploration!.cursor + 1,
                      )
                    }
                    onReset={handleExplorationReset}
                    onReturnToGame={handleReturnToGame}
                  />
                ) : null
              }
              positionDetails={
                <>
                  <AnalysisPanel analysis={analysis.positionAnalysis} />
                  <PositionChangesPanel changes={lastPositionChanges} />
                  <PositionInsightsPanel
                    insights={insights}
                    selectedSquare={selectedInsightSquare}
                    onSelectSquare={setSelectedInsightSquare}
                  />
                  <PositionControls
                    fenDraft={fenDraft}
                    error={fenError}
                    collapsedForGame
                    onDraftChange={setFenDraft}
                    onSubmit={handleFenSubmit}
                  />
                </>
              }
              onDraftChange={setPgnDraft}
              onLoad={handleGameLoad}
              onNavigate={handleGameNavigation}
              onRevealPosition={(positionIndex) =>
                handleGameNavigation(positionIndex, true)
              }
              onStartAnalysis={analysis.startGameAnalysis}
              onCancelAnalysis={analysis.cancelGameAnalysis}
            />
          ) : (
            <>
              <PositionControls
                fenDraft={fenDraft}
                error={fenError}
                onDraftChange={setFenDraft}
                onSubmit={handleFenSubmit}
              />
              {exploration && (
                <ExplorationControls
                  history={exploration}
                  onBack={() =>
                    handleExplorationNavigation(exploration.cursor - 1)
                  }
                  onForward={() =>
                    handleExplorationNavigation(exploration.cursor + 1)
                  }
                  onReset={handleExplorationReset}
                />
              )}
              <GameReviewPanel
                pgnDraft={pgnDraft}
                error={pgnError}
                game={null}
                positionIndex={null}
                isExploring={false}
                gameAnalysis={analysis.gameAnalysis}
                reviewMoments={[]}
                canAnalyseGame={false}
                explorationControls={null}
                positionDetails={null}
                onDraftChange={setPgnDraft}
                onLoad={handleGameLoad}
                onNavigate={handleGameNavigation}
                onRevealPosition={handleGameNavigation}
                onStartAnalysis={analysis.startGameAnalysis}
                onCancelAnalysis={analysis.cancelGameAnalysis}
              />
              <AnalysisPanel analysis={analysis.positionAnalysis} />
              <PositionChangesPanel changes={lastPositionChanges} />
              <PositionInsightsPanel
                insights={insights}
                selectedSquare={selectedInsightSquare}
                onSelectSquare={setSelectedInsightSquare}
              />
            </>
          )}
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

function formatGamePositionLabel(position: ImportedGame["positions"][number]) {
  if (!position.move || position.moveNumber === undefined) {
    return "Game start position";
  }

  const separator = position.move.color === "white" ? ". " : "... ";
  return `Position after ${position.moveNumber}${separator}${position.move.san}`;
}

export default App;
