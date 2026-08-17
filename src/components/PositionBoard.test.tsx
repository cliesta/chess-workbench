import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { STARTING_FEN } from "../chess/position";
import { PositionBoard } from "./PositionBoard";

test("renders the real board component for a FEN position", () => {
  render(
    <PositionBoard position={STARTING_FEN} allowDragging onMove={vi.fn()} />,
  );

  expect(
    screen.getByRole("region", { name: "Chess board" }),
  ).not.toBeEmptyDOMElement();
});
