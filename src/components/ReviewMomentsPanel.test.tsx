import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ReviewMoment } from "../analysis/reviewMoments";
import type { AppliedMove } from "../chess/position";
import { ReviewMomentsPanel } from "./ReviewMomentsPanel";

test.each([
  ["idle", "Analyse the game to find review moments."],
  ["running", "Review moments will settle when the quick pass stops."],
  ["complete", "No large evaluation swings were found in this quick pass."],
] as const)("renders the %s explanatory state", (status, message) => {
  render(
    <ReviewMomentsPanel
      status={status}
      moments={[]}
      selectedPositionIndex={0}
      onNavigate={vi.fn()}
    />,
  );

  expect(screen.getByText(message)).toBeVisible();
  expect(screen.getByText(/list is not a move grade/i)).toBeVisible();
});

test.each(["cancelled", "error"] as const)(
  "marks a %s empty result as partial",
  (status) => {
    render(
      <ReviewMomentsPanel
        status={status}
        moments={[]}
        selectedPositionIndex={0}
        onNavigate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Partial review moments" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "No large evaluation swings were found in the retained results.",
      ),
    ).toBeVisible();
  },
);

test("renders a centipawn loss, SAN line, and selected navigation action", () => {
  const onNavigate = vi.fn();
  render(
    <ReviewMomentsPanel
      status="complete"
      moments={[
        moment({
          lossCentipawns: 137,
          engineLineBeforeMove: "14. Nxe5 Nxe5 15. dxe5",
        }),
      ]}
      selectedPositionIndex={1}
      onNavigate={onNavigate}
    />,
  );

  expect(screen.getByText("Review 1 · After 1. Qc2")).toBeVisible();
  expect(screen.getByText("Evaluation: +0.35 → −1.02")).toBeVisible();
  expect(
    screen.getByText("White's position worsened by about 1.37 pawns."),
  ).toBeVisible();
  expect(
    screen.getByText("Engine line before the move: 14. Nxe5 Nxe5 15. dxe5"),
  ).toBeVisible();

  const button = screen.getByRole("button", {
    name: "Show position after 1. Qc2",
  });
  expect(button).toHaveAttribute("aria-current", "location");
  fireEvent.click(button);
  expect(onNavigate).toHaveBeenCalledWith(1);
});

test.each([
  ["allowed-mate", "Black allowed a forced mate."],
  ["lost-mate", "Black lost a forced mate."],
  [
    "mate-reversal",
    "The move changed a forced mate for Black into a forced mate for White.",
  ],
] as const)("renders factual %s wording", (kind, wording) => {
  render(
    <ReviewMomentsPanel
      status="complete"
      moments={[
        moment({
          kind,
          move: move("black", "Qxd4"),
          beforeEvaluation: { kind: "mate", whiteMateIn: -3 },
          afterEvaluation: { kind: "mate", whiteMateIn: 2 },
          lossCentipawns: undefined,
        }),
      ]}
      selectedPositionIndex={0}
      onNavigate={vi.fn()}
    />,
  );

  expect(screen.getByText(wording)).toBeVisible();
  expect(screen.getByText("Evaluation: −M3 → +M2")).toBeVisible();
});

test("distinguishes missing PV from suppressed raw notation", () => {
  render(
    <ReviewMomentsPanel
      status="complete"
      moments={[
        moment({ positionIndex: 1, engineLineBeforeMove: null }),
        moment({
          positionIndex: 2,
          moveNumber: 2,
          engineLineBeforeMove: null,
          engineLineBeforeMoveUsesRawNotation: true,
        }),
      ]}
      selectedPositionIndex={0}
      onNavigate={vi.fn()}
    />,
  );

  expect(
    screen.getByText("No engine line was retained for this position."),
  ).toBeVisible();
  expect(
    screen.getByText("Engine line notation was unavailable."),
  ).toBeVisible();
  expect(screen.queryByText(/e2e4/)).not.toBeInTheDocument();
});

function moment(overrides: Partial<ReviewMoment> = {}): ReviewMoment {
  return {
    kind: "centipawn-loss",
    positionIndex: 1,
    moveNumber: 1,
    move: move("white", "Qc2"),
    beforeEvaluation: { kind: "centipawns", whiteCentipawns: 35 },
    afterEvaluation: { kind: "centipawns", whiteCentipawns: -102 },
    lossCentipawns: 137,
    engineLineBeforeMove: null,
    engineLineBeforeMoveUsesRawNotation: false,
    ...overrides,
  };
}

function move(color: AppliedMove["color"], san: string): AppliedMove {
  return {
    color,
    piece: "queen",
    from: "d1",
    to: "c2",
    san,
  };
}
