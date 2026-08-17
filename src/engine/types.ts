export const ANALYSIS_MOVE_TIME_MS = 1500 as const;

export type Evaluation =
  | { kind: "centipawns"; whiteCentipawns: number }
  | { kind: "mate"; whiteMateIn: number };

export interface AnalysisRequest {
  requestId: number;
  fen: string;
  moveTimeMs: typeof ANALYSIS_MOVE_TIME_MS;
}

export interface AnalysisUpdate {
  requestId: number;
  fen: string;
  depth: number | null;
  evaluation: Evaluation | null;
  principalVariation: string | null;
  principalVariationUsesRawNotation: boolean;
}

export type AnalysisCompletion = "complete" | "superseded" | "interrupted";

export interface PositionAnalysisEngine {
  initialize(): Promise<void>;
  analyse(
    request: AnalysisRequest,
    onUpdate: (update: AnalysisUpdate) => void,
  ): Promise<AnalysisCompletion>;
  stop(requestId: number): void;
  dispose(): void;
}
