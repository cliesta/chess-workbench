import { useState, type FormEvent } from "react";
import {
  STARTING_FEN,
  attemptMove,
  parsePosition,
  type PromotionPiece,
} from "./chess/position";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { PositionBoard } from "./components/PositionBoard";
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

  function commitPosition(fen: string) {
    setPositionFen(fen);
    setFenDraft(fen);
    setFenError(null);
  }

  function handleFenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parsePosition(fenDraft);

    if (result.kind === "invalid") {
      setFenError(result.message);
      return;
    }

    commitPosition(result.fen);
    setPendingPromotion(null);
  }

  function handleMove(from: string, to: string) {
    const result = attemptMove(positionFen, from, to);

    if (result.kind === "moved") {
      commitPosition(result.fen);
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
      commitPosition(result.fen);
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
