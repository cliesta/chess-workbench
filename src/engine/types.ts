export const CURRENT_POSITION_MOVE_TIME_MS = 1_500;
export const GAME_POSITION_MOVE_TIME_MS = 500;

export type Evaluation =
  | { kind: "centipawns"; whiteCentipawns: number }
  | { kind: "mate"; whiteMateIn: number };

export interface AnalysisRequest {
  requestId: number;
  fen: string;
  moveTimeMs: number;
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

export type PositionAnalysisStatus =
  | "loading"
  | "ready"
  | "analysing-position"
  | "analysing-game"
  | "waiting-for-game"
  | "error";

export type PositionAnalysisState = {
  status: PositionAnalysisStatus;
  depth: number | null;
  evaluation: Evaluation | null;
  principalVariation: string | null;
  principalVariationUsesRawNotation: boolean;
  errorMessage: string | null;
};

export type CompletedPositionAnalysis = {
  fen: string;
  depth: number | null;
  evaluation: Evaluation | null;
  principalVariation: string | null;
  principalVariationUsesRawNotation: boolean;
};

export type GameAnalysisStatus =
  "idle" | "running" | "cancelled" | "complete" | "error";

export type GameAnalysisState = {
  status: GameAnalysisStatus;
  results: Array<CompletedPositionAnalysis | null>;
  completedCount: number;
  totalCount: number;
  activePositionIndex: number | null;
  activeResult: CompletedPositionAnalysis | null;
  errorMessage: string | null;
};

export interface PositionAnalysisEngine {
  initialize(): Promise<void>;
  analyse(
    request: AnalysisRequest,
    onUpdate: (update: AnalysisUpdate) => void,
  ): Promise<AnalysisCompletion>;
  stop(requestId: number): void;
  dispose(): void;
}
