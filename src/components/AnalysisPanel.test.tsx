import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { STARTING_FEN } from "../chess/position";
import { formatEvaluation } from "../engine/formatEvaluation";
import type {
  AnalysisCompletion,
  AnalysisRequest,
  AnalysisUpdate,
  Evaluation,
  PositionAnalysisEngine,
} from "../engine/types";
import { AnalysisPanel } from "./AnalysisPanel";

class FakeAnalysisEngine implements PositionAnalysisEngine {
  initialize = vi.fn(() => this.initialization.promise);
  stop = vi.fn();
  dispose = vi.fn();
  requests: Array<{
    request: AnalysisRequest;
    onUpdate: (update: AnalysisUpdate) => void;
    resolve: (completion: AnalysisCompletion) => void;
    reject: (error: Error) => void;
  }> = [];
  private initialization = deferred<void>();

  analyse(
    request: AnalysisRequest,
    onUpdate: (update: AnalysisUpdate) => void,
  ) {
    return new Promise<AnalysisCompletion>((resolve, reject) => {
      this.requests.push({ request, onUpdate, resolve, reject });
    });
  }

  finishInitialization() {
    this.initialization.resolve();
  }

  failInitialization(error: Error) {
    this.initialization.reject(error);
  }

  emit(
    requestIndex: number,
    update: Omit<AnalysisUpdate, "requestId" | "fen">,
  ) {
    const entry = this.requests[requestIndex];
    if (!entry) {
      throw new Error(`No fake request at index ${requestIndex}.`);
    }

    entry.onUpdate({
      requestId: entry.request.requestId,
      fen: entry.request.fen,
      ...update,
    });
  }
}

describe("AnalysisPanel", () => {
  test("shows loading, iterative analysis, and a completed result", async () => {
    const engine = new FakeAnalysisEngine();
    render(<AnalysisPanel fen={STARTING_FEN} createEngine={() => engine} />);

    expect(screen.getByText("Loading")).toBeInTheDocument();

    await act(async () => engine.finishInitialization());
    expect(await screen.findByText("Analysing")).toBeInTheDocument();

    act(() => {
      engine.emit(0, {
        depth: 12,
        evaluation: { kind: "centipawns", whiteCentipawns: 34 },
        principalVariation: "1. e4 e5 2. Nf3",
        principalVariationUsesRawNotation: false,
      });
    });

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("+0.34")).toBeInTheDocument();
    expect(screen.getByText("1. e4 e5 2. Nf3")).toBeInTheDocument();

    await act(async () => engine.requests[0]?.resolve("complete"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("clears old values and ignores a stale update after the FEN changes", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const view = render(
      <AnalysisPanel fen={STARTING_FEN} createEngine={factory} />,
    );
    await act(async () => engine.finishInitialization());
    act(() => {
      engine.emit(0, {
        depth: 10,
        evaluation: { kind: "centipawns", whiteCentipawns: 50 },
        principalVariation: "1. d4",
        principalVariationUsesRawNotation: false,
      });
    });

    const fenB = "4k3/8/8/8/8/8/8/4K3 b - - 0 1";
    view.rerender(<AnalysisPanel fen={fenB} createEngine={factory} />);

    expect(screen.queryByText("+0.50")).not.toBeInTheDocument();
    expect(engine.stop).toHaveBeenCalledWith(1);
    expect(engine.requests[1]?.request.fen).toBe(fenB);

    act(() => {
      engine.emit(0, {
        depth: 20,
        evaluation: { kind: "centipawns", whiteCentipawns: 999 },
        principalVariation: "stale line",
        principalVariationUsesRawNotation: false,
      });
    });
    expect(screen.queryByText("+9.99")).not.toBeInTheDocument();

    act(() => {
      engine.emit(1, {
        depth: 7,
        evaluation: { kind: "centipawns", whiteCentipawns: -25 },
        principalVariation: "1... Kf7",
        principalVariationUsesRawNotation: false,
      });
    });
    expect(screen.getByText("−0.25")).toBeInTheDocument();
  });

  test("contains an initialization error and disposes on unmount", async () => {
    const engine = new FakeAnalysisEngine();
    const view = render(
      <AnalysisPanel fen={STARTING_FEN} createEngine={() => engine} />,
    );

    await act(async () =>
      engine.failInitialization(new Error("Wasm unavailable")),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wasm unavailable",
    );
    expect(screen.getByText("Error")).toBeInTheDocument();

    view.unmount();
    expect(engine.dispose).toHaveBeenCalledOnce();
  });

  test("links to the source and licence for the deployed engine version", () => {
    const engine = new FakeAnalysisEngine();
    render(<AnalysisPanel fen={STARTING_FEN} createEngine={() => engine} />);

    expect(
      screen.getByRole("link", { name: "Stockfish source and licence" }),
    ).toHaveAttribute("href", "/stockfish/18.0.8/SOURCE.txt");
  });
});

describe("formatEvaluation", () => {
  test.each([
    [null, "—"],
    [{ kind: "centipawns", whiteCentipawns: 0 }, "0.00"],
    [{ kind: "centipawns", whiteCentipawns: 34 }, "+0.34"],
    [{ kind: "centipawns", whiteCentipawns: -127 }, "−1.27"],
    [{ kind: "mate", whiteMateIn: 3 }, "+M3"],
    [{ kind: "mate", whiteMateIn: -2 }, "−M2"],
  ] as Array<[Evaluation | null, string]>)(
    "formats an evaluation for display",
    (evaluation, expected) => {
      expect(formatEvaluation(evaluation)).toBe(expected);
    },
  );
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
