import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "./App";
import type {
  AnalysisCompletion,
  AnalysisRequest,
  AnalysisUpdate,
  PositionAnalysisEngine,
} from "./engine/types";

vi.mock("./components/PositionBoard", () => ({
  PositionBoard: ({
    position,
    onMove,
  }: {
    position: string;
    onMove: (from: string, to: string) => boolean;
  }) => (
    <section aria-label="Chess board">
      <span data-testid="board-position">{position}</span>
      <button type="button" onClick={() => onMove("e2", "e4")}>
        Move e2 to e4
      </button>
    </section>
  ),
}));

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

const shortGame = `
[White "Jane Player"]
[Black "Alex Opponent"]

1. e4 e5 *
`;

test("runs, navigates, and cancels a whole-game pass through the application", async () => {
  const engine = new FakeAnalysisEngine();
  const factory = () => engine;
  render(<App createEngine={factory} />);
  loadGame();

  expect(screen.getByRole("button", { name: "Analyse game" })).toBeDisabled();
  await act(async () => engine.finishInitialization());
  expect(screen.getByRole("button", { name: "Analyse game" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));

  expect(engine.requests[1]?.request).toMatchObject({ moveTimeMs: 500 });
  expect(screen.getByText("Analysing game: 0 of 3 positions")).toBeVisible();
  act(() => {
    engine.emit(1, {
      depth: 10,
      evaluation: { kind: "centipawns", whiteCentipawns: 20 },
      principalVariation: "1. e4",
      principalVariationUsesRawNotation: false,
    });
  });
  expect(screen.getByText("Analysing game")).toBeVisible();
  expect(screen.getByText("+0.20")).toBeVisible();

  await act(async () => engine.requests[1]?.resolve("complete"));
  expect(screen.getByText("Analysing game: 1 of 3 positions")).toBeVisible();
  expect(
    screen.getByText("Starting evaluation:").parentElement,
  ).toHaveTextContent("+0.20");

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  act(() => {
    engine.emit(2, {
      depth: 11,
      evaluation: { kind: "centipawns", whiteCentipawns: 12 },
      principalVariation: "1... e5",
      principalVariationUsesRawNotation: false,
    });
  });
  expect(screen.getByText("Analysing game")).toBeVisible();
  expect(screen.getByText("+0.12")).toBeVisible();

  await act(async () => engine.requests[2]?.resolve("complete"));
  expect(
    screen.getByRole("button", {
      name: "Go to after 1. e4, evaluation +0.12",
    }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
  await act(async () => engine.requests[3]?.resolve("interrupted"));

  expect(
    screen.getByText("Analysis cancelled: 2 of 3 positions retained."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Analyse again" })).toBeEnabled();
  expect(engine.requests[4]?.request).toMatchObject({
    fen: expect.stringContaining(" b "),
    moveTimeMs: 1500,
  });
});

test("invalid input preserves a run while a valid FEN exits and cancels it", async () => {
  const engine = new FakeAnalysisEngine();
  const factory = () => engine;
  render(<App createEngine={factory} />);
  loadGame();
  await act(async () => engine.finishInitialization());
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));

  fireEvent.change(screen.getByLabelText("PGN"), {
    target: { value: "1. e4 e5 2. NotAMove" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/^Invalid PGN:/);
  expect(engine.stop).not.toHaveBeenCalled();
  expect(screen.getByText("Analysing game: 0 of 3 positions")).toBeVisible();

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "4k3/8/8/8/8/8/8/4K3 w - - 0 1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.queryByLabelText("Game navigation")).not.toBeInTheDocument();
  expect(engine.stop).toHaveBeenCalledWith(
    engine.requests[1]?.request.requestId,
  );

  await act(async () => engine.requests[1]?.resolve("superseded"));
  expect(screen.getByTestId("board-position")).toHaveTextContent(
    "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
  );
});

test("turns a completed game pass into a navigable review shortlist", async () => {
  const engine = new FakeAnalysisEngine();
  render(<App createEngine={() => engine} />);
  loadGame();
  await act(async () => engine.finishInitialization());
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));

  emitResult(engine, 1, 100, "1. d4 d5");
  await act(async () => engine.requests[1]?.resolve("complete"));
  emitResult(engine, 2, -80, "1... e5 2. Nf3");
  await act(async () => engine.requests[2]?.resolve("complete"));
  emitResult(engine, 3, -70, "2. Nf3");
  await act(async () => engine.requests[3]?.resolve("complete"));

  expect(
    screen.getByRole("region", { name: "Review moments" }),
  ).toHaveTextContent("White's position worsened by about 1.80 pawns.");
  expect(
    screen.getByText("Engine line before the move: 1. d4 d5"),
  ).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "Show position after 1. e4" }),
  );

  expect(screen.getByText("After 1. e4")).toBeVisible();
  expect(screen.getByTestId("board-position")).toHaveTextContent(
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  );
  expect(screen.getByLabelText("FEN")).toHaveValue(
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  );
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
  expect(
    screen.getByRole("button", { name: "Show position after 1. e4" }),
  ).toHaveAttribute("aria-current", "location");
});

test("settles retained partial moments after cancellation and clears them on rerun", async () => {
  const engine = new FakeAnalysisEngine();
  render(<App createEngine={() => engine} />);
  loadGame();
  await act(async () => engine.finishInitialization());
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));

  emitResult(engine, 1, 100, "1. d4");
  await act(async () => engine.requests[1]?.resolve("complete"));
  emitResult(engine, 2, -100, "1... e5");
  await act(async () => engine.requests[2]?.resolve("complete"));

  expect(
    screen.getByText("Review moments will settle when the quick pass stops."),
  ).toBeVisible();
  expect(screen.queryByText(/worsened by about/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
  await act(async () => engine.requests[3]?.resolve("interrupted"));

  expect(
    screen.getByRole("region", { name: "Partial review moments" }),
  ).toHaveTextContent("White's position worsened by about 2.00 pawns.");

  fireEvent.change(screen.getByLabelText("PGN"), {
    target: { value: "1. e4 e5 2. NotAMove" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));
  expect(
    screen.getByRole("region", { name: "Partial review moments" }),
  ).toHaveTextContent("2.00 pawns");

  fireEvent.click(screen.getByRole("button", { name: "Analyse again" }));
  expect(
    screen.getByText("Review moments will settle when the quick pass stops."),
  ).toBeVisible();
  expect(screen.queryByText(/2.00 pawns/)).not.toBeInTheDocument();
});

function loadGame() {
  fireEvent.change(screen.getByLabelText("PGN"), {
    target: { value: shortGame },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));
}

function emitResult(
  engine: FakeAnalysisEngine,
  requestIndex: number,
  whiteCentipawns: number,
  principalVariation: string,
) {
  act(() => {
    engine.emit(requestIndex, {
      depth: 10,
      evaluation: { kind: "centipawns", whiteCentipawns },
      principalVariation,
      principalVariationUsesRawNotation: false,
    });
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
