import { useMemo, useState, type FormEvent } from "react";
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
import { PositionBoard } from "./components/PositionBoard";
import { PositionChangesPanel } from "./components/PositionChangesPanel";
import { PositionInsightsPanel } from "./components/PositionInsightsPanel";
import { PromotionDialog } from "./components/PromotionDialog";

type PendingPromotion = {
  from: string;
  to: string;
  choices: PromotionPiece[];
};

function App() {
  const [positionFen, setPositionFen] = useState(STARTING_FEN);
  const [fenDraft, setFenDraft] = useState(STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);
  const [selectedInsightSquare, setSelectedInsightSquare] = useState<
    string | null
  >(null);
  const [lastPositionChanges, setLastPositionChanges] =
    useState<PositionChanges | null>(null);
  const insights = useMemo(
    () => getPositionInsights(positionFen),
    [positionFen],
  );
  const selectedFinding = insights.attackedAndUndefended.find(
    ({ piece }) => piece.square === selectedInsightSquare,
  );

  function commitPosition(fen: string, changes: PositionChanges | null) {
    setPositionFen(fen);
    setFenDraft(fen);
    setFenError(null);
    setSelectedInsightSquare(null);
    setLastPositionChanges(changes);
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

          <AnalysisPanel fen={positionFen} />
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
