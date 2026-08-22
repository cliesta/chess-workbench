import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { STARTING_FEN } from "./chess/position";
import App from "./App";

const analysisMocks = vi.hoisted(() => ({
  startGameAnalysis: vi.fn(),
  cancelGameAnalysis: vi.fn(),
}));

vi.mock("./components/PositionBoard", () => ({
  PositionBoard: ({
    position,
    allowDragging,
    onMove,
    highlightedTargetSquare,
    highlightedAttackerSquares,
  }: {
    position: string;
    allowDragging: boolean;
    onMove: (from: string, to: string) => boolean;
    highlightedTargetSquare?: string;
    highlightedAttackerSquares?: string[];
  }) => (
    <section aria-label="Chess board">
      <span data-testid="board-position">{position}</span>
      <span data-testid="dragging-enabled">{String(allowDragging)}</span>
      <span data-testid="highlighted-target">
        {highlightedTargetSquare ?? "none"}
      </span>
      <span data-testid="highlighted-attackers">
        {highlightedAttackerSquares?.join(",") ?? "none"}
      </span>
      <button type="button" onClick={() => onMove("e2", "e4")}>
        Move e2 to e4
      </button>
      <button type="button" onClick={() => onMove("e2", "e5")}>
        Move e2 to e5
      </button>
      <button type="button" onClick={() => onMove("e7", "e5")}>
        Move e7 to e5
      </button>
      <button type="button" onClick={() => onMove("e4", "d5")}>
        Capture e4 on d5
      </button>
      <button type="button" onClick={() => onMove("d4", "e3")}>
        Move d4 to e3
      </button>
      <button type="button" onClick={() => onMove("a7", "a8")}>
        Promote a7 to a8
      </button>
    </section>
  ),
}));

vi.mock("./components/AnalysisPanel", () => ({
  AnalysisPanel: ({
    analysis,
  }: {
    analysis: { principalVariation: string | null };
  }) => (
    <section aria-label="Analysis">
      <p>Engine unavailable</p>
      <span data-testid="analysis-position">{analysis.principalVariation}</span>
    </section>
  ),
}));

vi.mock("./engine/useWorkbenchAnalysis", () => ({
  useWorkbenchAnalysis: ({
    fen,
    game,
  }: {
    fen: string;
    game: { positions: unknown[] } | null;
  }) => ({
    positionAnalysis: {
      status: "error",
      depth: null,
      evaluation: null,
      principalVariation: fen,
      principalVariationUsesRawNotation: false,
      errorMessage: "Engine unavailable",
    },
    gameAnalysis: {
      status: "idle",
      results: game?.positions.map(() => null) ?? [],
      completedCount: 0,
      totalCount: game?.positions.length ?? 0,
      activePositionIndex: null,
      activeResult: null,
      errorMessage: null,
    },
    canAnalyseGame: game !== null,
    startGameAnalysis: analysisMocks.startGameAnalysis,
    cancelGameAnalysis: analysisMocks.cancelGameAnalysis,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const shortGame = `
[White "Jane Player"]
[Black "Alex Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0
`;

function loadGame(pgn = shortGame) {
  if (!screen.queryByLabelText("PGN")) {
    fireEvent.click(screen.getByRole("button", { name: "Load another game" }));
  }
  fireEvent.change(screen.getByLabelText("PGN"), { target: { value: pgn } });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));
}

function showPositionDetails() {
  fireEvent.click(screen.getByRole("tab", { name: "Position details" }));
}

function openStandaloneFen() {
  fireEvent.click(screen.getByText("Load a standalone FEN"));
}

test("shows the starting position in the board and FEN input", () => {
  render(<App />);

  expect(
    screen.getByRole("region", { name: "Chess board" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
  expect(screen.getByLabelText("FEN")).toHaveValue(STARTING_FEN);
  expect(screen.getByText("White to move")).toBeInTheDocument();
  expect(screen.getByText("No loose pieces found.")).toBeInTheDocument();
  expect(
    screen.getByText(/not proof that the piece can be won/i),
  ).toBeVisible();
  expect(
    screen.getByText("Make a move on the board to see what changed."),
  ).toBeVisible();
});

test("loads a valid FEN into the board and input", () => {
  render(<App />);
  const fen = "4k3/8/8/8/8/8/8/4K3 b - - 7 23";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: `  ${fen}  ` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.getByTestId("board-position")).toHaveTextContent(fen);
  expect(screen.getByTestId("analysis-position")).toHaveTextContent(fen);
  expect(screen.getByLabelText("FEN")).toHaveValue(fen);
  expect(screen.getByText("Black to move")).toBeInTheDocument();
});

test("shows an accessible error and keeps the board for invalid FEN", () => {
  render(<App />);

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "not a fen" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/invalid fen/i);
  expect(screen.getByLabelText("FEN")).toHaveValue("not a fen");
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
  expect(screen.getByTestId("analysis-position")).toHaveTextContent(
    STARTING_FEN,
  );
  expect(screen.getByText("White to move")).toBeInTheDocument();
});

test("clears a FEN error after loading a corrected position", () => {
  render(<App />);
  const correctedFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "not a fen" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: correctedFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByTestId("board-position")).toHaveTextContent(correctedFen);
});

test("updates the FEN after a legal board move", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));

  const movedFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  expect(screen.getByLabelText("FEN")).toHaveValue(movedFen);
  expect(screen.getByTestId("board-position")).toHaveTextContent(movedFen);
  expect(screen.getByText("Black to move")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
  expect(
    screen.getByText(
      "No tracked material, check, or loose-piece status changed.",
    ),
  ).toBeVisible();
});

test("replaces the previous report after the next legal move", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));
  fireEvent.click(screen.getByRole("button", { name: "Move e7 to e5" }));

  const report = screen.getByRole("region", { name: "What changed?" });
  expect(report).toHaveTextContent("After e5");
  expect(report).not.toHaveTextContent("After e4");
});

test("reports material changes after a capture", () => {
  render(<App />);
  const captureFen = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: captureFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Capture e4 on d5" }));

  expect(
    screen.getByText("Black's pawn count changed from 1 to 0 (−1 point)."),
  ).toBeVisible();
  expect(
    screen.getByText("Material balance changed from Equal to White +1."),
  ).toBeVisible();
});

test("clears a move report after loading a valid FEN", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));
  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "4k3/8/8/8/8/8/8/4K3 w - - 0 1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(
    screen.getByText("Make a move on the board to see what changed."),
  ).toBeVisible();
});

test("keeps a move report after an invalid FEN or illegal move", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));
  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "not a fen" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e5" }));

  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
});

test("selects a finding for board highlights and clears it on position change", () => {
  render(<App />);
  const loosePieceFen = "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: loosePieceFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(
    screen.getByRole("button", { name: /White queen on d4.*Black rook on a4/ }),
  );

  expect(screen.getByTestId("highlighted-target")).toHaveTextContent("d4");
  expect(screen.getByTestId("highlighted-attackers")).toHaveTextContent("a4");

  fireEvent.click(screen.getByRole("button", { name: "Move d4 to e3" }));

  expect(screen.getByTestId("highlighted-target")).toHaveTextContent("none");
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After Qe3");

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "4k3/8/8/8/8/8/8/4K3 b - - 0 1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.getByTestId("highlighted-target")).toHaveTextContent("none");
  expect(screen.getByTestId("highlighted-attackers")).toHaveTextContent("none");
});

test("keeps insights usable when analysis reports an engine error", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));

  expect(screen.getByText("Engine unavailable")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Position insights" }),
  ).toBeVisible();
  expect(screen.getByText("Equal")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
});

test("keeps the current FEN after an illegal board move", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e5" }));

  expect(screen.getByLabelText("FEN")).toHaveValue(STARTING_FEN);
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
});

test("opens promotion choices and applies an underpromotion", () => {
  render(<App />);
  const promotionFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: promotionFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Promote a7 to a8" }));

  expect(
    screen.getByRole("dialog", { name: "Choose promotion piece" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("dragging-enabled")).toHaveTextContent("false");
  fireEvent.click(screen.getByRole("button", { name: "Knight" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("FEN")).toHaveValue(
    "N3k3/8/8/8/8/8/8/4K3 b - - 0 1",
  );
  expect(screen.getByText("White:").parentElement).toHaveTextContent(
    "Knight 1",
  );
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After a8=N");
  expect(
    screen.getByText("White's material total changed from 1 to 3 (+2 points)."),
  ).toBeVisible();
});

test("cancels promotion without changing the position", () => {
  render(<App />);
  const promotionFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: promotionFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Promote a7 to a8" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("FEN")).toHaveValue(promotionFen);
});

test("cancels promotion with Escape without changing the position", () => {
  render(<App />);
  const promotionFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";

  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: promotionFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Promote a7 to a8" }));
  fireEvent.keyDown(
    screen.getByRole("dialog", { name: "Choose promotion piece" }),
    { key: "Escape" },
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("FEN")).toHaveValue(promotionFen);
});

test("loads a PGN at its initial position and navigates every position consumer together", () => {
  render(<App />);
  loadGame();
  showPositionDetails();
  openStandaloneFen();

  expect(screen.getByText("Jane Player vs Alex Opponent")).toBeVisible();
  expect(screen.getByText("Start position")).toBeVisible();
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
  expect(screen.getByLabelText("FEN")).toHaveValue(STARTING_FEN);
  expect(screen.getByTestId("analysis-position")).toHaveTextContent(
    STARTING_FEN,
  );
  expect(
    screen.getByText("Make a move on the board to see what changed."),
  ).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  expect(screen.getByText("After 1. e4")).toBeVisible();
  expect(screen.getByTestId("board-position")).toHaveTextContent(afterE4);
  expect(screen.getByLabelText("FEN")).toHaveValue(afterE4);
  expect(screen.getByTestId("analysis-position")).toHaveTextContent(afterE4);
  expect(screen.getByText("Black to move")).toBeVisible();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
});

test("offers explicit whole-game analysis only for a loaded game", () => {
  render(<App />);

  expect(
    screen.queryByRole("button", { name: "Analyse game" }),
  ).not.toBeInTheDocument();
  loadGame();
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));

  expect(analysisMocks.startGameAnalysis).toHaveBeenCalledOnce();
});

test("supports jumping and keeps the producing-move report when navigating backward", () => {
  render(<App />);
  loadGame();
  showPositionDetails();

  fireEvent.click(screen.getByRole("button", { name: "Last" }));
  expect(screen.getByText("After 2. Nf3")).toBeVisible();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After Nf3");

  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(screen.getByText("After 1... e5")).toBeVisible();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e5");

  fireEvent.click(screen.getByRole("tab", { name: "Review" }));
  fireEvent.click(screen.getByRole("button", { name: "Go to after 1. e4" }));
  expect(screen.getByText("After 1. e4")).toBeVisible();
});

test("reveals and focuses the selected board position from a narrow move list", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
  );

  try {
    render(<App />);
    loadGame();
    fireEvent.click(screen.getByRole("button", { name: "Go to after 1. e4" }));

    expect(
      screen.getByRole("region", { name: "Position after 1. e4" }),
    ).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  } finally {
    vi.unstubAllGlobals();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  }
});

test("keeps the selected game position when a replacement PGN is invalid", () => {
  render(<App />);
  loadGame();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  showPositionDetails();
  openStandaloneFen();
  const selectedFen = screen.getByLabelText("FEN").getAttribute("value");

  loadGame("1. e4 e5 2. NotAMove");

  expect(screen.getByRole("alert")).toHaveTextContent(/^Invalid PGN:/);
  expect(screen.getByText("After 1. e4")).toBeVisible();
  expect(screen.getByLabelText("FEN")).toHaveValue(selectedFen);
  expect(screen.getByTestId("analysis-position")).toHaveTextContent(
    selectedFen ?? "",
  );
});

test("a valid FEN exits game review while retaining the PGN draft", () => {
  render(<App />);
  loadGame();
  const standaloneFen = "4k3/8/8/8/8/8/8/4K3 b - - 0 23";

  showPositionDetails();
  openStandaloneFen();
  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: standaloneFen },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));

  expect(screen.queryByLabelText("Game navigation")).not.toBeInTheDocument();
  expect(screen.getByLabelText("PGN")).toHaveValue(shortGame);
  expect(screen.getByTestId("board-position")).toHaveTextContent(standaloneFen);
  expect(
    screen.getByText("Make a move on the board to see what changed."),
  ).toBeVisible();
});

test("invalid FEN and illegal moves stay in game review", () => {
  render(<App />);
  loadGame();

  showPositionDetails();
  openStandaloneFen();
  fireEvent.change(screen.getByLabelText("FEN"), {
    target: { value: "not a fen" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e5" }));

  expect(screen.getByLabelText("Game navigation")).toBeVisible();
  expect(screen.getByText("Start position")).toBeVisible();
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
});

test("a completed legal board move exits review and creates a standalone report", () => {
  render(<App />);
  loadGame();

  fireEvent.click(screen.getByRole("button", { name: "Move e2 to e4" }));

  expect(screen.queryByLabelText("Game navigation")).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After e4");
});

test("promotion cancellation stays in review and completion exits", () => {
  render(<App />);
  loadGame(`
[SetUp "1"]
[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]
[Result "*"]

*
  `);

  fireEvent.click(screen.getByRole("button", { name: "Promote a7 to a8" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("Game navigation")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Promote a7 to a8" }));
  fireEvent.click(screen.getByRole("button", { name: "Knight" }));
  expect(screen.queryByLabelText("Game navigation")).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "What changed?" }),
  ).toHaveTextContent("After a8=N");
});

test("navigation clears a selected insight highlight", () => {
  render(<App />);
  loadGame(`
[SetUp "1"]
[FEN "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1"]

1. Qe3 *
  `);
  showPositionDetails();
  fireEvent.click(
    screen.getByRole("button", { name: /White queen on d4.*Black rook on a4/ }),
  );
  expect(screen.getByTestId("highlighted-target")).toHaveTextContent("d4");

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(screen.getByTestId("highlighted-target")).toHaveTextContent("none");
});
