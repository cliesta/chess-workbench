import { formatPrincipalVariation } from "../chess/position";
import type {
  AnalysisCompletion,
  AnalysisRequest,
  AnalysisUpdate,
  PositionAnalysisEngine,
} from "./types";
import { STOCKFISH_WORKER_URL } from "./stockfishAssets";
import { normalizeEvaluation, parseUciMessage } from "./uci";

const STARTUP_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 2_500;

export interface StockfishWorker {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
}

export type StockfishWorkerFactory = () => StockfishWorker;

type ClientState =
  | "idle"
  | "awaiting-uciok"
  | "awaiting-readyok"
  | "ready"
  | "searching"
  | "error"
  | "disposed";

type PendingAnalysis = {
  request: AnalysisRequest;
  onUpdate: (update: AnalysisUpdate) => void;
  resolve: (completion: AnalysisCompletion) => void;
  reject: (error: Error) => void;
  completionAfterBestmove: AnalysisCompletion;
  latestUpdate: AnalysisUpdate;
};

type Initialization = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

export class StockfishAnalysisClient implements PositionAnalysisEngine {
  private state: ClientState = "idle";
  private worker: StockfishWorker | null = null;
  private initialization: Initialization | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private activeAnalysis: PendingAnalysis | null = null;
  private pendingAnalysis: PendingAnalysis | null = null;
  private failure: Error | null = null;

  constructor(private readonly createWorker: StockfishWorkerFactory) {}

  initialize(): Promise<void> {
    if (this.state === "disposed") {
      return Promise.reject(
        new Error("The Stockfish client has been disposed."),
      );
    }

    if (this.failure) {
      return Promise.reject(this.failure);
    }

    if (this.state === "ready" || this.state === "searching") {
      return Promise.resolve();
    }

    if (this.initialization) {
      return this.initialization.promise;
    }

    let resolveInitialization!: () => void;
    let rejectInitialization!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveInitialization = resolve;
      rejectInitialization = reject;
    });

    this.initialization = {
      promise,
      resolve: resolveInitialization,
      reject: rejectInitialization,
    };

    try {
      this.worker = this.createWorker();
      this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
      this.worker.onerror = (event) => {
        this.fail(new Error(event.message || "The Stockfish Worker failed."));
      };
      this.worker.onmessageerror = () => {
        this.fail(
          new Error("The Stockfish Worker sent an unreadable message."),
        );
      };
      this.state = "awaiting-uciok";
      this.startupTimer = setTimeout(() => {
        this.fail(new Error("Stockfish did not finish starting in time."));
      }, STARTUP_TIMEOUT_MS);
      this.worker.postMessage("uci");
    } catch (error) {
      this.fail(toError(error, "The Stockfish Worker could not be created."));
    }

    return promise;
  }

  analyse(
    request: AnalysisRequest,
    onUpdate: (update: AnalysisUpdate) => void,
  ): Promise<AnalysisCompletion> {
    if (!Number.isFinite(request.moveTimeMs) || request.moveTimeMs <= 0) {
      return Promise.reject(new Error("Analysis move time must be positive."));
    }

    if (this.state !== "ready" && this.state !== "searching") {
      return Promise.reject(
        this.failure ?? new Error("Stockfish is not ready to analyse."),
      );
    }

    return new Promise<AnalysisCompletion>((resolve, reject) => {
      const analysis: PendingAnalysis = {
        request,
        onUpdate,
        resolve,
        reject,
        completionAfterBestmove: "complete",
        latestUpdate: {
          requestId: request.requestId,
          fen: request.fen,
          depth: null,
          evaluation: null,
          principalVariation: null,
          principalVariationUsesRawNotation: false,
        },
      };

      if (!this.activeAnalysis) {
        this.startAnalysis(analysis);
        return;
      }

      if (this.pendingAnalysis) {
        this.pendingAnalysis.resolve("superseded");
      }

      this.pendingAnalysis = analysis;
      this.activeAnalysis.completionAfterBestmove = "superseded";
      this.requestActiveSearchStop();
    });
  }

  stop(requestId: number): void {
    if (this.pendingAnalysis?.request.requestId === requestId) {
      this.pendingAnalysis.resolve("interrupted");
      this.pendingAnalysis = null;
      return;
    }

    if (this.activeAnalysis?.request.requestId !== requestId) {
      return;
    }

    this.activeAnalysis.completionAfterBestmove = "interrupted";
    this.requestActiveSearchStop();
  }

  dispose(): void {
    if (this.state === "disposed") {
      return;
    }

    this.state = "disposed";
    this.clearTimers();
    this.initialization?.reject(
      new Error("Stockfish was disposed before initialization completed."),
    );
    this.initialization = null;
    this.activeAnalysis?.resolve("interrupted");
    this.pendingAnalysis?.resolve("interrupted");
    this.activeAnalysis = null;
    this.pendingAnalysis = null;
    this.detachAndTerminateWorker();
  }

  private handleWorkerMessage(data: unknown): void {
    if (this.state === "disposed" || this.state === "error") {
      return;
    }

    for (const line of String(data).split(/\r?\n/)) {
      const message = parseUciMessage(line);

      if (message.type === "uciok" && this.state === "awaiting-uciok") {
        this.state = "awaiting-readyok";
        this.worker?.postMessage("isready");
        continue;
      }

      if (message.type === "readyok" && this.state === "awaiting-readyok") {
        this.finishInitialization();
        continue;
      }

      if (message.type === "info") {
        this.handleInfo(message);
        continue;
      }

      if (message.type === "bestmove") {
        this.finishActiveAnalysis();
      }
    }
  }

  private handleInfo(
    message: Extract<ReturnType<typeof parseUciMessage>, { type: "info" }>,
  ): void {
    const analysis = this.activeAnalysis;
    if (!analysis || message.multipv !== 1) {
      return;
    }

    let changed = false;
    const nextUpdate = { ...analysis.latestUpdate };

    if (message.depth !== null) {
      nextUpdate.depth = message.depth;
      changed = true;
    }

    if (message.score && !message.scoreIsBound) {
      const evaluation = normalizeEvaluation(
        message.score,
        analysis.request.fen,
      );
      if (evaluation) {
        nextUpdate.evaluation = evaluation;
        changed = true;
      }
    }

    if (message.principalVariation.length > 0) {
      const formatted = formatPrincipalVariation(
        analysis.request.fen,
        message.principalVariation,
      );
      nextUpdate.principalVariation = formatted.notation;
      nextUpdate.principalVariationUsesRawNotation = formatted.usesRawNotation;
      changed = true;
    }

    if (changed) {
      analysis.latestUpdate = nextUpdate;
      analysis.onUpdate(nextUpdate);
    }
  }

  private finishInitialization(): void {
    this.clearStartupTimer();
    this.state = "ready";
    const initialization = this.initialization;
    this.initialization = null;
    initialization?.resolve();
  }

  private startAnalysis(analysis: PendingAnalysis): void {
    this.activeAnalysis = analysis;
    this.state = "searching";
    this.worker?.postMessage(`position fen ${analysis.request.fen}`);
    this.worker?.postMessage(`go movetime ${analysis.request.moveTimeMs}`);
  }

  private requestActiveSearchStop(): void {
    if (!this.activeAnalysis || this.stopTimer) {
      return;
    }

    this.worker?.postMessage("stop");
    this.stopTimer = setTimeout(() => {
      this.fail(
        new Error("Stockfish did not stop the previous search in time."),
      );
    }, STOP_TIMEOUT_MS);
  }

  private finishActiveAnalysis(): void {
    if (!this.activeAnalysis) {
      return;
    }

    this.clearStopTimer();
    const finished = this.activeAnalysis;
    this.activeAnalysis = null;
    finished.resolve(finished.completionAfterBestmove);

    if (this.pendingAnalysis) {
      const next = this.pendingAnalysis;
      this.pendingAnalysis = null;
      this.startAnalysis(next);
    } else {
      this.state = "ready";
    }
  }

  private fail(error: Error): void {
    if (this.state === "disposed" || this.state === "error") {
      return;
    }

    this.failure = error;
    this.state = "error";
    this.clearTimers();
    this.initialization?.reject(error);
    this.initialization = null;
    this.activeAnalysis?.reject(error);
    this.pendingAnalysis?.reject(error);
    this.activeAnalysis = null;
    this.pendingAnalysis = null;
    this.detachAndTerminateWorker();
  }

  private clearTimers(): void {
    this.clearStartupTimer();
    this.clearStopTimer();
  }

  private clearStartupTimer(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
  }

  private clearStopTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private detachAndTerminateWorker(): void {
    if (!this.worker) {
      return;
    }

    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.worker = null;
  }
}

export function createStockfishAnalysisClient(): PositionAnalysisEngine {
  return new StockfishAnalysisClient(() => {
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
      throw new Error(
        "This browser does not support Web Workers and WebAssembly.",
      );
    }

    return new Worker(STOCKFISH_WORKER_URL, { name: "stockfish-analysis" });
  });
}

function toError(value: unknown, fallbackMessage: string): Error {
  return value instanceof Error ? value : new Error(fallbackMessage);
}
