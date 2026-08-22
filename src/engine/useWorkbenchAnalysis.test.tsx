import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ImportedGame } from "../chess/game";
import { STARTING_FEN } from "../chess/position";
import {
  CURRENT_POSITION_MOVE_TIME_MS,
  GAME_POSITION_MOVE_TIME_MS,
  type AnalysisCompletion,
  type AnalysisRequest,
  type AnalysisUpdate,
  type PositionAnalysisEngine,
} from "./types";
import { useWorkbenchAnalysis } from "./useWorkbenchAnalysis";

const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const afterE5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

const game: ImportedGame = {
  headers: {},
  positions: [
    { fen: STARTING_FEN },
    {
      fen: afterE4,
      moveNumber: 1,
      move: {
        color: "white",
        piece: "pawn",
        from: "e2",
        to: "e4",
        san: "e4",
      },
    },
    {
      fen: afterE5,
      moveNumber: 1,
      move: {
        color: "black",
        piece: "pawn",
        from: "e7",
        to: "e5",
        san: "e5",
      },
    },
  ],
};

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
    update: Partial<AnalysisUpdate> &
      Pick<AnalysisUpdate, "depth" | "evaluation" | "principalVariation">,
  ) {
    const entry = this.requests[requestIndex];
    if (!entry) {
      throw new Error(`No fake request at index ${requestIndex}.`);
    }

    entry.onUpdate({
      requestId: entry.request.requestId,
      fen: entry.request.fen,
      principalVariationUsesRawNotation: false,
      ...update,
    });
  }
}

describe("useWorkbenchAnalysis", () => {
  test("runs ordinary selected-position analysis at the existing limit", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const { result, unmount } = renderHook(() =>
      useWorkbenchAnalysis({
        fen: STARTING_FEN,
        game: null,
        positionIndex: null,
        createEngine: factory,
      }),
    );

    expect(result.current.positionAnalysis.status).toBe("loading");
    await act(async () => engine.finishInitialization());
    expect(engine.requests[0]?.request).toMatchObject({
      fen: STARTING_FEN,
      moveTimeMs: CURRENT_POSITION_MOVE_TIME_MS,
    });

    act(() => {
      engine.emit(0, {
        depth: 12,
        evaluation: { kind: "centipawns", whiteCentipawns: 34 },
        principalVariation: "1. e4 e5",
      });
    });
    expect(result.current.positionAnalysis).toMatchObject({
      status: "analysing-position",
      depth: 12,
      evaluation: { kind: "centipawns", whiteCentipawns: 34 },
    });

    await act(async () => engine.requests[0]?.resolve("complete"));
    expect(result.current.positionAnalysis.status).toBe("ready");
    unmount();
    expect(engine.dispose).toHaveBeenCalledOnce();
  });

  test("clears an old selected-position result and ignores its late update", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const { result, rerender } = renderHook(
      ({ fen }) =>
        useWorkbenchAnalysis({
          fen,
          game: null,
          positionIndex: null,
          createEngine: factory,
        }),
      { initialProps: { fen: STARTING_FEN } },
    );
    await act(async () => engine.finishInitialization());
    act(() => {
      engine.emit(0, {
        depth: 10,
        evaluation: { kind: "centipawns", whiteCentipawns: 50 },
        principalVariation: "1. d4",
      });
    });

    rerender({ fen: afterE4 });
    expect(result.current.positionAnalysis).toMatchObject({
      status: "analysing-position",
      evaluation: null,
    });
    act(() => {
      engine.emit(0, {
        depth: 30,
        evaluation: { kind: "centipawns", whiteCentipawns: 999 },
        principalVariation: "stale",
      });
      engine.emit(1, {
        depth: 8,
        evaluation: { kind: "centipawns", whiteCentipawns: -25 },
        principalVariation: "1... e5",
      });
    });

    expect(result.current.positionAnalysis).toMatchObject({
      depth: 8,
      evaluation: { kind: "centipawns", whiteCentipawns: -25 },
    });
  });

  test("analyses every game position sequentially and resumes the selected position", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const { result } = renderHook(() =>
      useWorkbenchAnalysis({
        fen: STARTING_FEN,
        game,
        positionIndex: 0,
        createEngine: factory,
      }),
    );
    await act(async () => engine.finishInitialization());

    act(() => result.current.startGameAnalysis());
    expect(engine.requests[1]?.request).toMatchObject({
      fen: STARTING_FEN,
      moveTimeMs: GAME_POSITION_MOVE_TIME_MS,
    });
    expect(engine.requests).toHaveLength(2);

    act(() => {
      engine.emit(1, {
        depth: 10,
        evaluation: { kind: "centipawns", whiteCentipawns: 20 },
        principalVariation: "1. e4",
      });
    });
    expect(result.current.positionAnalysis).toMatchObject({
      status: "analysing-game",
      depth: 10,
      evaluation: { kind: "centipawns", whiteCentipawns: 20 },
    });

    await act(async () => engine.requests[1]?.resolve("complete"));
    expect(engine.requests[2]?.request.fen).toBe(afterE4);
    expect(result.current.gameAnalysis.completedCount).toBe(1);
    expect(result.current.gameAnalysis.results[0]).toMatchObject({
      fen: STARTING_FEN,
      depth: 10,
    });

    act(() => {
      engine.emit(2, {
        depth: 11,
        evaluation: { kind: "centipawns", whiteCentipawns: 12 },
        principalVariation: "1... e5",
      });
    });
    await act(async () => engine.requests[2]?.resolve("complete"));
    expect(engine.requests[3]?.request.fen).toBe(afterE5);
    await act(async () => engine.requests[3]?.resolve("complete"));

    expect(result.current.gameAnalysis.status).toBe("complete");
    expect(result.current.gameAnalysis.completedCount).toBe(3);
    expect(
      result.current.gameAnalysis.results.map((entry) => entry?.fen),
    ).toEqual([STARTING_FEN, afterE4, afterE5]);
    expect(engine.requests[4]?.request).toMatchObject({
      fen: STARTING_FEN,
      moveTimeMs: CURRENT_POSITION_MOVE_TIME_MS,
    });
  });

  test("navigation during a run shows waiting rather than another position's result", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const { result, rerender } = renderHook(
      ({ fen, positionIndex }) =>
        useWorkbenchAnalysis({
          fen,
          game,
          positionIndex,
          createEngine: factory,
        }),
      { initialProps: { fen: STARTING_FEN, positionIndex: 0 } },
    );
    await act(async () => engine.finishInitialization());
    act(() => result.current.startGameAnalysis());
    act(() => {
      engine.emit(1, {
        depth: 9,
        evaluation: { kind: "centipawns", whiteCentipawns: 18 },
        principalVariation: "1. e4",
      });
    });

    rerender({ fen: afterE4, positionIndex: 1 });
    expect(result.current.positionAnalysis).toMatchObject({
      status: "waiting-for-game",
      depth: null,
      evaluation: null,
      principalVariation: null,
    });
    expect(engine.stop).not.toHaveBeenCalled();

    rerender({ fen: STARTING_FEN, positionIndex: 0 });
    expect(result.current.positionAnalysis).toMatchObject({
      status: "analysing-game",
      depth: 9,
    });
  });

  test("cancels cooperatively, retains completed results, and resumes current analysis", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const { result } = renderHook(() =>
      useWorkbenchAnalysis({
        fen: afterE4,
        game,
        positionIndex: 1,
        createEngine: factory,
      }),
    );
    await act(async () => engine.finishInitialization());
    act(() => result.current.startGameAnalysis());
    act(() => {
      engine.emit(1, {
        depth: 8,
        evaluation: null,
        principalVariation: null,
      });
    });
    await act(async () => engine.requests[1]?.resolve("complete"));

    act(() => result.current.cancelGameAnalysis());
    expect(engine.stop).toHaveBeenCalledWith(
      engine.requests[2]?.request.requestId,
    );
    await act(async () => engine.requests[2]?.resolve("interrupted"));

    expect(result.current.gameAnalysis).toMatchObject({
      status: "cancelled",
      completedCount: 1,
    });
    expect(result.current.gameAnalysis.results[0]?.evaluation).toBeNull();
    expect(result.current.gameAnalysis.results[1]).toBeNull();
    expect(engine.requests[3]?.request).toMatchObject({
      fen: afterE4,
      moveTimeMs: CURRENT_POSITION_MOVE_TIME_MS,
    });
  });

  test("replacing a game discards results and ignores stale output", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const replacement: ImportedGame = {
      headers: {},
      positions: [{ fen: afterE5 }],
    };
    const { result, rerender } = renderHook(
      ({ currentGame, fen }) =>
        useWorkbenchAnalysis({
          fen,
          game: currentGame,
          positionIndex: 0,
          createEngine: factory,
        }),
      { initialProps: { currentGame: game, fen: STARTING_FEN } },
    );
    await act(async () => engine.finishInitialization());
    act(() => result.current.startGameAnalysis());

    rerender({ currentGame: replacement, fen: afterE5 });
    expect(result.current.gameAnalysis).toMatchObject({
      status: "idle",
      totalCount: 1,
      completedCount: 0,
    });
    expect(engine.stop).toHaveBeenCalledWith(
      engine.requests[1]?.request.requestId,
    );

    act(() => {
      engine.emit(1, {
        depth: 30,
        evaluation: { kind: "centipawns", whiteCentipawns: 999 },
        principalVariation: "stale",
      });
    });
    await act(async () => engine.requests[1]?.resolve("superseded"));
    expect(result.current.gameAnalysis.results).toEqual([null]);
  });

  test("contains initialization and game-search failures", async () => {
    const initializationEngine = new FakeAnalysisEngine();
    const initFactory = () => initializationEngine;
    const initializedView = renderHook(() =>
      useWorkbenchAnalysis({
        fen: STARTING_FEN,
        game,
        positionIndex: 0,
        createEngine: initFactory,
      }),
    );
    await act(async () =>
      initializationEngine.failInitialization(new Error("Wasm unavailable")),
    );
    expect(initializedView.result.current.positionAnalysis).toMatchObject({
      status: "error",
      errorMessage: "Wasm unavailable",
    });
    expect(initializedView.result.current.canAnalyseGame).toBe(false);
    initializedView.unmount();

    const searchEngine = new FakeAnalysisEngine();
    const searchFactory = () => searchEngine;
    const searchView = renderHook(() =>
      useWorkbenchAnalysis({
        fen: STARTING_FEN,
        game,
        positionIndex: 0,
        createEngine: searchFactory,
      }),
    );
    await act(async () => searchEngine.finishInitialization());
    act(() => searchView.result.current.startGameAnalysis());
    await act(async () =>
      searchEngine.requests[1]?.reject(new Error("Worker failed")),
    );

    expect(searchView.result.current.gameAnalysis).toMatchObject({
      status: "error",
      completedCount: 0,
      errorMessage: "Worker failed",
    });
    expect(searchView.result.current.positionAnalysis).toMatchObject({
      status: "error",
      errorMessage: "Worker failed",
    });
  });

  test("analyses a zero-move game once and keeps rerun generations separate", async () => {
    const engine = new FakeAnalysisEngine();
    const factory = () => engine;
    const zeroMoveGame: ImportedGame = {
      headers: {},
      positions: [{ fen: STARTING_FEN }],
    };
    const { result } = renderHook(() =>
      useWorkbenchAnalysis({
        fen: STARTING_FEN,
        game: zeroMoveGame,
        positionIndex: 0,
        createEngine: factory,
      }),
    );
    await act(async () => engine.finishInitialization());
    act(() => result.current.startGameAnalysis());
    act(() => {
      engine.emit(1, {
        depth: 7,
        evaluation: { kind: "centipawns", whiteCentipawns: 10 },
        principalVariation: null,
      });
    });
    await act(async () => engine.requests[1]?.resolve("complete"));
    expect(result.current.gameAnalysis).toMatchObject({
      status: "complete",
      completedCount: 1,
      totalCount: 1,
    });

    act(() => result.current.startGameAnalysis());
    expect(result.current.gameAnalysis.results).toEqual([null]);
    act(() => {
      engine.emit(1, {
        depth: 99,
        evaluation: { kind: "centipawns", whiteCentipawns: 999 },
        principalVariation: "stale",
      });
    });
    expect(result.current.gameAnalysis.activeResult).toBeNull();

    act(() => {
      engine.emit(3, {
        depth: 8,
        evaluation: { kind: "mate", whiteMateIn: -2 },
        principalVariation: null,
      });
    });
    await act(async () => engine.requests[3]?.resolve("complete"));
    expect(result.current.gameAnalysis.results[0]).toMatchObject({
      depth: 8,
      evaluation: { kind: "mate", whiteMateIn: -2 },
    });
  });
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
