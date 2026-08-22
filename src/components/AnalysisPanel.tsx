import { formatEvaluation } from "../engine/formatEvaluation";
import { STOCKFISH_SOURCE_URL } from "../engine/stockfishAssets";
import type { PositionAnalysisState } from "../engine/types";

type AnalysisPanelProps = {
  analysis: PositionAnalysisState;
};

const statusLabels = {
  loading: "Loading engine",
  ready: "Ready",
  "analysing-position": "Analysing position",
  "analysing-game": "Analysing game",
  "waiting-for-game": "Waiting for game analysis",
  error: "Error",
} as const;

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  return (
    <section className="analysis-panel" aria-labelledby="analysis-title">
      <h2 id="analysis-title">Analysis</h2>
      <dl className="analysis-results">
        <div>
          <dt>Engine</dt>
          <dd>{statusLabels[analysis.status]}</dd>
        </div>
        <div>
          <dt>Depth</dt>
          <dd>{analysis.depth ?? "—"}</dd>
        </div>
        <div>
          <dt>Evaluation</dt>
          <dd>{formatEvaluation(analysis.evaluation)}</dd>
        </div>
        <div>
          <dt>Best line</dt>
          <dd>
            {analysis.principalVariation ?? "—"}
            {analysis.principalVariationUsesRawNotation && (
              <span className="analysis-note"> PV notation unavailable</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="analysis-convention">Positive values favour White.</p>
      {analysis.errorMessage && (
        <p className="error-message" role="alert">
          {analysis.errorMessage}
        </p>
      )}
      <a className="analysis-license" href={STOCKFISH_SOURCE_URL}>
        Stockfish source and licence
      </a>
    </section>
  );
}
