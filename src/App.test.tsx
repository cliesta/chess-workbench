import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { STARTING_FEN } from "./chess/position";
import App from "./App";

vi.mock("./components/PositionBoard", () => ({
  PositionBoard: ({
    position,
    allowDragging,
    onMove,
  }: {
    position: string;
    allowDragging: boolean;
    onMove: (from: string, to: string) => boolean;
  }) => (
    <section aria-label="Chess board">
      <span data-testid="board-position">{position}</span>
      <span data-testid="dragging-enabled">{String(allowDragging)}</span>
      <button type="button" onClick={() => onMove("e2", "e4")}>
        Move e2 to e4
      </button>
      <button type="button" onClick={() => onMove("e2", "e5")}>
        Move e2 to e5
      </button>
      <button type="button" onClick={() => onMove("a7", "a8")}>
        Promote a7 to a8
      </button>
    </section>
  ),
}));

vi.mock("./components/AnalysisPanel", () => ({
  AnalysisPanel: ({ fen }: { fen: string }) => (
    <section aria-label="Analysis">
      <span data-testid="analysis-position">{fen}</span>
    </section>
  ),
}));

test("shows the starting position in the board and FEN input", () => {
  render(<App />);

  expect(
    screen.getByRole("region", { name: "Chess board" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("board-position")).toHaveTextContent(STARTING_FEN);
  expect(screen.getByLabelText("FEN")).toHaveValue(STARTING_FEN);
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
