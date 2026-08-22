import { render, screen } from "@testing-library/react";
import type { ChessboardOptions } from "react-chessboard";
import { expect, test, vi } from "vitest";
import { STARTING_FEN } from "../chess/position";
import { PositionBoard } from "./PositionBoard";

const { chessboardOptions } = vi.hoisted(() => ({
  chessboardOptions: vi.fn(),
}));

vi.mock("react-chessboard", () => ({
  Chessboard: ({ options }: { options: ChessboardOptions }) => {
    chessboardOptions(options);
    return <div data-testid="chessboard" />;
  },
}));

test("renders the real board component for a FEN position", () => {
  render(
    <PositionBoard position={STARTING_FEN} allowDragging onMove={vi.fn()} />,
  );

  expect(
    screen.getByRole("region", { name: "Chess board" }),
  ).not.toBeEmptyDOMElement();
});

test("maps target and attacker highlights to distinct square styles", () => {
  const onMove = vi.fn(() => true);
  render(
    <PositionBoard
      position={STARTING_FEN}
      allowDragging
      onMove={onMove}
      highlightedTargetSquare="d4"
      highlightedAttackerSquares={["a4", "h4"]}
    />,
  );

  const options = chessboardOptions.mock.lastCall?.[0] as ChessboardOptions;
  expect(options.squareStyles?.d4).not.toEqual(options.squareStyles?.a4);
  expect(options.squareStyles?.a4).toEqual(options.squareStyles?.h4);
  expect(options.position).toBe(STARTING_FEN);
  expect(options.allowDragging).toBe(true);

  options.onPieceDrop?.({
    sourceSquare: "e2",
    targetSquare: "e4",
    piece: { isSparePiece: false, position: "e2", pieceType: "wP" },
  });
  expect(onMove).toHaveBeenCalledWith("e2", "e4");
});
