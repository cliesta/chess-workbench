import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PositionInsights } from "../chess/position";
import { PositionInsightsPanel } from "./PositionInsightsPanel";

const emptyInsights: PositionInsights = {
  sideToMove: "white",
  inCheck: false,
  material: {
    white: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 },
    black: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 },
    whitePoints: 39,
    blackPoints: 39,
    whiteMinusBlack: 0,
  },
  attackedAndUndefended: [],
};

test("shows turn, check, equal material, counts, and an empty state", () => {
  render(
    <PositionInsightsPanel
      insights={emptyInsights}
      selectedSquare={null}
      onSelectSquare={vi.fn()}
    />,
  );

  expect(screen.getByText("White to move")).toBeInTheDocument();
  expect(screen.getByText("Not in check")).toBeInTheDocument();
  expect(screen.getByText("Equal")).toBeInTheDocument();
  expect(screen.getByText("39–39")).toBeInTheDocument();
  expect(screen.getByText("White:").parentElement).toHaveTextContent(
    "White: Queen 1 · Rooks 2 · Bishops 2 · Knights 2 · Pawns 8",
  );
  expect(screen.getByText("No loose pieces found.")).toBeInTheDocument();
});

test("phrases a Black material advantage and check clearly", () => {
  render(
    <PositionInsightsPanel
      insights={{
        ...emptyInsights,
        sideToMove: "black",
        inCheck: true,
        material: {
          ...emptyInsights.material,
          blackPoints: 42,
          whiteMinusBlack: -3,
        },
      }}
      selectedSquare={null}
      onSelectSquare={vi.fn()}
    />,
  );

  expect(screen.getByText("Black to move")).toBeInTheDocument();
  expect(screen.getByText("In check")).toBeInTheDocument();
  expect(screen.getByText("Black +3")).toBeInTheDocument();
});

test("describes attackers, explains the limitation, and toggles selection", () => {
  const onSelectSquare = vi.fn();
  const insights: PositionInsights = {
    ...emptyInsights,
    attackedAndUndefended: [
      {
        piece: { color: "white", type: "bishop", square: "b5" },
        attackers: [
          { color: "black", type: "pawn", square: "a6" },
          { color: "black", type: "knight", square: "c7" },
        ],
      },
    ],
  };
  const { rerender } = render(
    <PositionInsightsPanel
      insights={insights}
      selectedSquare={null}
      onSelectSquare={onSelectSquare}
    />,
  );
  const finding = screen.getByRole("button", {
    name: "White bishop on b5 — attacked by Black pawn on a6 and Black knight on c7.",
  });

  expect(finding).toHaveAttribute("aria-pressed", "false");
  expect(
    screen.getByText(/not proof that the piece can be won/i),
  ).toBeVisible();
  fireEvent.click(finding);
  expect(onSelectSquare).toHaveBeenLastCalledWith("b5");

  rerender(
    <PositionInsightsPanel
      insights={insights}
      selectedSquare="b5"
      onSelectSquare={onSelectSquare}
    />,
  );
  const selectedFinding = screen.getByRole("button", {
    name: /White bishop on b5/,
  });
  expect(selectedFinding).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(selectedFinding);
  expect(onSelectSquare).toHaveBeenLastCalledWith(null);
});
