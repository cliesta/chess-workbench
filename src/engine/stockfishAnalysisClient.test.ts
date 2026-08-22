import { afterEach, describe, expect, test, vi } from "vitest";
import { STARTING_FEN } from "../chess/position";
import {
  CURRENT_POSITION_MOVE_TIME_MS,
  GAME_POSITION_MOVE_TIME_MS,
  type AnalysisRequest,
} from "./types";
import {
  StockfishAnalysisClient,
  type StockfishWorker,
} from "./stockfishAnalysisClient";

class ScriptedWorker implements StockfishWorker {
  messages: string[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;

  postMessage(message: string) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(message: string) {
    this.onmessage?.(new MessageEvent("message", { data: message }));
  }

  emitError(message: string) {
    this.onerror?.(new ErrorEvent("error", { message }));
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("StockfishAnalysisClient", () => {
  test("completes UCI initialization before starting a search", async () => {
    const { client, worker } = createReadyClient();
    const initialized = client.initialize();

    expect(worker.messages).toEqual(["uci"]);
    worker.emit("id name Stockfish 18\nuciok");
    expect(worker.messages).toEqual(["uci", "isready"]);
    worker.emit("readyok");
    await initialized;

    const updates = vi.fn();
    const completed = client.analyse(request(1, STARTING_FEN), updates);
    expect(worker.messages.slice(-2)).toEqual([
      `position fen ${STARTING_FEN}`,
      "go movetime 1500",
    ]);

    worker.emit("info depth 12 score cp 34 nodes 100 pv e2e4 e7e5 g1f3");
    expect(updates).toHaveBeenLastCalledWith({
      requestId: 1,
      fen: STARTING_FEN,
      depth: 12,
      evaluation: { kind: "centipawns", whiteCentipawns: 34 },
      principalVariation: "1. e4 e5 2. Nf3",
      principalVariationUsesRawNotation: false,
    });

    worker.emit("bestmove e2e4");
    await expect(completed).resolves.toBe("complete");
  });

  test("uses the requested game-analysis time limit", async () => {
    const { client, worker } = await initializedClient();
    const completed = client.analyse(
      {
        requestId: 1,
        fen: STARTING_FEN,
        moveTimeMs: GAME_POSITION_MOVE_TIME_MS,
      },
      vi.fn(),
    );

    expect(worker.messages.at(-1)).toBe("go movetime 500");
    worker.emit("bestmove e2e4");
    await expect(completed).resolves.toBe("complete");
  });

  test("rejects a non-positive time limit without starting a search", async () => {
    const { client, worker } = await initializedClient();

    await expect(
      client.analyse(
        { requestId: 1, fen: STARTING_FEN, moveTimeMs: 0 },
        vi.fn(),
      ),
    ).rejects.toThrow(/must be positive/i);
    expect(worker.messages).not.toContain("go movetime 0");
  });

  test("serializes a replacement search and keeps late output assigned to the old request", async () => {
    const { client, worker } = await initializedClient();
    const updatesA = vi.fn();
    const updatesB = vi.fn();
    const analysisA = client.analyse(request(1, STARTING_FEN), updatesA);
    const fenB = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const analysisB = client.analyse(request(2, fenB), updatesB);

    expect(worker.messages.at(-1)).toBe("stop");
    expect(worker.messages).not.toContain(`position fen ${fenB}`);

    worker.emit("info depth 13 score cp 20 pv e2e4");
    expect(updatesA).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 1, fen: STARTING_FEN }),
    );
    expect(updatesB).not.toHaveBeenCalled();

    worker.emit("bestmove e2e4");
    await expect(analysisA).resolves.toBe("superseded");
    expect(worker.messages.slice(-2)).toEqual([
      `position fen ${fenB}`,
      "go movetime 1500",
    ]);

    worker.emit("info depth 8 score cp 25 pv e7e5");
    expect(updatesB).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 2,
        fen: fenB,
        evaluation: { kind: "centipawns", whiteCentipawns: -25 },
      }),
    );
    worker.emit("bestmove e7e5");
    await expect(analysisB).resolves.toBe("complete");
  });

  test("collapses multiple queued positions to the latest request", async () => {
    const { client, worker } = await initializedClient();
    const analysisA = client.analyse(request(1, STARTING_FEN), vi.fn());
    const analysisB = client.analyse(request(2, fenWithTurn("b")), vi.fn());
    const analysisC = client.analyse(request(3, fenWithTurn("w")), vi.fn());

    await expect(analysisB).resolves.toBe("superseded");
    worker.emit("bestmove e2e4");
    await expect(analysisA).resolves.toBe("superseded");
    expect(worker.messages).not.toContain(`position fen ${fenWithTurn("b")}`);
    expect(worker.messages).toContain(`position fen ${fenWithTurn("w")}`);

    worker.emit("bestmove e1e2");
    await expect(analysisC).resolves.toBe("complete");
  });

  test("turns a stop timeout into an engine error without starting pending work", async () => {
    vi.useFakeTimers();
    const { client, worker } = await initializedClient();
    const analysisA = client.analyse(request(1, STARTING_FEN), vi.fn());
    const fenB = fenWithTurn("b");
    const analysisB = client.analyse(request(2, fenB), vi.fn());
    const failureA = expect(analysisA).rejects.toThrow(/did not stop/i);
    const failureB = expect(analysisB).rejects.toThrow(/did not stop/i);

    await vi.advanceTimersByTimeAsync(2500);

    await failureA;
    await failureB;
    expect(worker.terminated).toBe(true);
    expect(worker.messages).not.toContain(`position fen ${fenB}`);
  });

  test("contains Worker errors and disposes cleanly", async () => {
    const worker = new ScriptedWorker();
    const client = new StockfishAnalysisClient(() => worker);
    const initialized = client.initialize();
    const failed = expect(initialized).rejects.toThrow("Wasm failed");

    worker.emitError("Wasm failed");

    await failed;
    expect(worker.terminated).toBe(true);
    client.dispose();
    expect(worker.onmessage).toBeNull();
  });
});

function createReadyClient() {
  const worker = new ScriptedWorker();
  return {
    worker,
    client: new StockfishAnalysisClient(() => worker),
  };
}

async function initializedClient() {
  const result = createReadyClient();
  const initialized = result.client.initialize();
  result.worker.emit("uciok");
  result.worker.emit("readyok");
  await initialized;
  return result;
}

function request(requestId: number, fen: string): AnalysisRequest {
  return {
    requestId,
    fen,
    moveTimeMs: CURRENT_POSITION_MOVE_TIME_MS,
  };
}

function fenWithTurn(turn: "w" | "b") {
  return `4k3/8/8/8/8/8/8/4K3 ${turn} - - 0 1`;
}
