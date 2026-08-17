import { formatEvaluation } from "../engine/formatEvaluation";
import {
  usePositionAnalysis,
  type PositionAnalysisEngineFactory,
} from "../engine/usePositionAnalysis";

type AnalysisPanelProps = {
  fen: string;
  createEngine?: PositionAnalysisEngineFactory;
};

const statusLabels = {
  loading: "Loading",
  ready: "Ready",
  analysing: "Analysing",
  error: "Error",
} as const;

export function AnalysisPanel({ fen, createEngine }: AnalysisPanelProps) {
  const analysis = usePositionAnalysis(fen, createEngine);

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
      <a
        className="analysis-license"
        href={`${import.meta.env.BASE_URL}stockfish/SOURCE.txt`}
      >
        Stockfish source and licence
      </a>
    </section>
  );
}
