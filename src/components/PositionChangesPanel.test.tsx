import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import type { PositionChanges } from "../chess/positionChanges";
import { PositionChangesPanel } from "./PositionChangesPanel";

const quietMove: PositionChanges = {
  move: {
    color: "white",
    piece: "pawn",
    from: "e2",
    to: "e4",
    san: "e4",
  },
  material: {
    countChanges: [],
    whitePointsBefore: 39,
    whitePointsAfter: 39,
    blackPointsBefore: 39,
    blackPointsAfter: 39,
    whiteMinusBlackBefore: 0,
    whiteMinusBlackAfter: 0,
  },
  check: { entered: [], left: [] },
  becameAttackedAndUndefended: [],
  stoppedBeingAttackedAndUndefended: [],
};

test("invites a board move when there is no comparison", () => {
  render(<PositionChangesPanel changes={null} />);

  expect(
    screen.getByText("Make a move on the board to see what changed."),
  ).toBeVisible();
});

test("shows SAN and a neutral result for a quiet move", () => {
  render(<PositionChangesPanel changes={quietMove} />);

  expect(screen.getByText("After", { exact: false })).toHaveTextContent(
    "After e4",
  );
  expect(
    screen.getByText(
      "No tracked material, check, or loose-piece status changed.",
    ),
  ).toBeVisible();
  expect(screen.queryByText(/best|mistake|blunder/i)).not.toBeInTheDocument();
});

test("phrases check, material, and loose-piece transitions factually", () => {
  render(
    <PositionChangesPanel
      changes={{
        ...quietMove,
        move: { ...quietMove.move, san: "Bxh7+" },
        material: {
          ...quietMove.material,
          countChanges: [
            {
              color: "black",
              type: "pawn",
              before: 8,
              after: 7,
              pointDelta: -1,
            },
          ],
          blackPointsAfter: 38,
          whiteMinusBlackAfter: 1,
        },
        check: { entered: ["black"], left: ["white"] },
        becameAttackedAndUndefended: [
          {
            piece: { color: "white", type: "bishop", square: "h7" },
            attackers: [{ color: "black", type: "king", square: "g8" }],
          },
        ],
        stoppedBeingAttackedAndUndefended: [
          {
            piece: { color: "black", type: "knight", square: "c6" },
          },
        ],
      }}
    />,
  );

  expect(screen.getByText("Black is now in check.")).toBeVisible();
  expect(screen.getByText("White is no longer in check.")).toBeVisible();
  expect(
    screen.getByText("Black's pawn count changed from 8 to 7 (−1 point)."),
  ).toBeVisible();
  expect(
    screen.getByText("Material balance changed from Equal to White +1."),
  ).toBeVisible();
  expect(
    screen.getByText(
      /White bishop on h7 became attacked and undefended.*Black king on g8/,
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Black knight on c6 is no longer attacked and undefended.",
    ),
  ).toBeVisible();
  expect(screen.getByText(/does not prove a piece can be won/i)).toBeVisible();
});

test("shows promotion counts, net points, and a Black advantage", () => {
  render(
    <PositionChangesPanel
      changes={{
        ...quietMove,
        move: { ...quietMove.move, san: "a1=Q" },
        material: {
          countChanges: [
            {
              color: "black",
              type: "queen",
              before: 0,
              after: 1,
              pointDelta: 9,
            },
            {
              color: "black",
              type: "pawn",
              before: 1,
              after: 0,
              pointDelta: -1,
            },
          ],
          whitePointsBefore: 0,
          whitePointsAfter: 0,
          blackPointsBefore: 1,
          blackPointsAfter: 9,
          whiteMinusBlackBefore: -1,
          whiteMinusBlackAfter: -9,
        },
      }}
    />,
  );

  expect(
    screen.getByText("Black's queen count changed from 0 to 1 (+9 points)."),
  ).toBeVisible();
  expect(
    screen.getByText("Black's material total changed from 1 to 9 (+8 points)."),
  ).toBeVisible();
  expect(
    screen.getByText("Material balance changed from Black +1 to Black +9."),
  ).toBeVisible();
});
