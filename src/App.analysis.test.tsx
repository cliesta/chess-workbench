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

function loadGame() {
  fireEvent.change(screen.getByLabelText("PGN"), {
    target: { value: shortGame },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));
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
