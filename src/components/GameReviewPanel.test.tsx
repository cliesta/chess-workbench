import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, test, vi } from "vitest";
import type { ImportedGame } from "../chess/game";
import { STARTING_FEN } from "../chess/position";
import type { GameAnalysisState } from "../engine/types";
import { GameReviewPanel } from "./GameReviewPanel";

const game: ImportedGame = {
  headers: {
    white: "Jane Player",
    black: "Alex Opponent",
    result: "1-0",
    date: "2026.08.14",
    event: "Club Championship",
    round: "3",
  },
  positions: [
    { fen: STARTING_FEN },
    {
      fen: "after-e4",
      moveNumber: 1,
      move: {
        color: "white",
        piece: "pawn",
        from: "e2",
        to: "e4",
        san: "e4",
      },
    },
    {
      fen: "after-e5",
      moveNumber: 1,
      move: {
        color: "black",
        piece: "pawn",
        from: "e7",
        to: "e5",
        san: "e5",
      },
    },
  ],
};

const idleGameAnalysis: GameAnalysisState = {
  status: "idle",
  results: [null, null, null],
  completedCount: 0,
  totalCount: 3,
  activePositionIndex: null,
  activeResult: null,
  errorMessage: null,
};

function renderPanel(
  overrides: Partial<ComponentProps<typeof GameReviewPanel>> = {},
) {
  const props: ComponentProps<typeof GameReviewPanel> = {
    pgnDraft: "1. e4 e5",
    error: null,
    game: null,
    positionIndex: null,
    gameAnalysis: { ...idleGameAnalysis, results: [], totalCount: 0 },
    reviewMoments: [],
    canAnalyseGame: false,
    onDraftChange: vi.fn(),
    onLoad: vi.fn(),
    onNavigate: vi.fn(),
    onStartAnalysis: vi.fn(),
    onCancelAnalysis: vi.fn(),
    ...overrides,
  };
  render(<GameReviewPanel {...props} />);
  return props;
}

test("labels PGN input, explains main-line scope, and submits the draft", () => {
  const props = renderPanel();

  expect(screen.getByLabelText("PGN")).toHaveValue("1. e4 e5");
  expect(screen.getByText(/Main line only/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("PGN"), {
    target: { value: "1. d4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load game" }));

  expect(props.onDraftChange).toHaveBeenCalledWith("1. d4");
  expect(props.onLoad).toHaveBeenCalledOnce();
});

test("associates and announces a PGN error", () => {
  renderPanel({ error: "Invalid PGN: bad move" });

  expect(screen.getByRole("alert")).toHaveTextContent("Invalid PGN: bad move");
  expect(screen.getByLabelText("PGN")).toHaveAccessibleDescription(
    /Main line only.*Invalid PGN: bad move/,
  );
});

test("renders metadata, move status, current step, and navigation callbacks", () => {
  const props = renderPanel({
    game,
    positionIndex: 1,
    gameAnalysis: idleGameAnalysis,
    canAnalyseGame: true,
  });

  expect(screen.getByText("Jane Player vs Alex Opponent")).toBeVisible();
  expect(
    screen.getByText("1-0 · 2026.08.14 · Club Championship · Round 3"),
  ).toBeVisible();
  expect(screen.getByText("After 1. e4")).toBeVisible();
  expect(screen.getByText("1 of 2 plies")).toBeVisible();
  expect(screen.getByRole("button", { name: "First" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Last" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Go to after 1. e4" }),
  ).toHaveAttribute("aria-current", "step");

  fireEvent.click(screen.getByRole("button", { name: "First" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Last" }));
  fireEvent.click(screen.getByRole("button", { name: "Go to after 1... e5" }));

  expect(props.onNavigate).toHaveBeenNthCalledWith(1, 0);
  expect(props.onNavigate).toHaveBeenNthCalledWith(2, 0);
  expect(props.onNavigate).toHaveBeenNthCalledWith(3, 2);
  expect(props.onNavigate).toHaveBeenNthCalledWith(4, 2);
  expect(props.onNavigate).toHaveBeenNthCalledWith(5, 2);
  expect(
    screen.getByText("Moving a piece or loading a FEN leaves game review."),
  ).toBeVisible();
});

test("shows start and zero-move boundary states with missing headers", () => {
  renderPanel({
    game: { headers: {}, positions: [{ fen: STARTING_FEN }] },
    positionIndex: 0,
    gameAnalysis: { ...idleGameAnalysis, results: [null], totalCount: 1 },
  });

  expect(screen.getByText("Unknown players")).toBeVisible();
  expect(screen.getByText("Start position")).toBeVisible();
  expect(screen.getByText("0 of 0 plies")).toBeVisible();
  expect(screen.getByRole("button", { name: "First" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Last" })).toBeDisabled();
  expect(screen.queryByRole("list", { name: "Main-line moves" })).toBeNull();
});

test("numbers a custom game beginning with Black using ellipsis notation", () => {
  renderPanel({
    game: {
      headers: {},
      positions: [
        { fen: "custom" },
        {
          fen: "after-black-move",
          moveNumber: 17,
          move: {
            color: "black",
            piece: "king",
            from: "e8",
            to: "d7",
            san: "Kd7",
          },
        },
      ],
    },
    positionIndex: 1,
    gameAnalysis: { ...idleGameAnalysis, results: [null, null], totalCount: 2 },
  });

  expect(screen.getByText("After 17... Kd7")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Go to after 17... Kd7" }),
  ).toHaveAttribute("aria-current", "step");
});

test("starts a quick game pass only when the engine is available", () => {
  const props = renderPanel({
    game,
    positionIndex: 0,
    gameAnalysis: idleGameAnalysis,
    canAnalyseGame: true,
  });

  expect(
    screen.getByText("Quick engine pass · 500 ms per position"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Analyse game" }));
  expect(props.onStartAnalysis).toHaveBeenCalledOnce();
});

test("shows accessible progress and cancellation while running", () => {
  const props = renderPanel({
    game,
    positionIndex: 1,
    gameAnalysis: {
      ...idleGameAnalysis,
      status: "running",
      completedCount: 1,
      activePositionIndex: 1,
    },
    canAnalyseGame: false,
  });

  expect(screen.getByText("Analysing game: 1 of 3 positions")).toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: "Game analysis progress" }),
  ).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
  expect(props.onCancelAnalysis).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("maps retained evaluations to the start and correct move", () => {
  renderPanel({
    game,
    positionIndex: 1,
    gameAnalysis: {
      ...idleGameAnalysis,
      status: "complete",
      completedCount: 3,
      results: [
        {
          fen: STARTING_FEN,
          depth: 12,
          evaluation: { kind: "centipawns", whiteCentipawns: 22 },
          principalVariation: "1. e4",
          principalVariationUsesRawNotation: false,
        },
        {
          fen: "after-e4",
          depth: 11,
          evaluation: { kind: "centipawns", whiteCentipawns: -120 },
          principalVariation: "1... e5",
          principalVariationUsesRawNotation: false,
        },
        {
          fen: "wrong-fen",
          depth: 10,
          evaluation: { kind: "mate", whiteMateIn: 3 },
          principalVariation: null,
          principalVariationUsesRawNotation: false,
        },
      ],
    },
    canAnalyseGame: true,
  });

  expect(
    screen.getByText("Starting evaluation:").parentElement,
  ).toHaveTextContent("+0.22");
  expect(
    screen.getByRole("button", {
      name: "Go to after 1. e4, evaluation −1.20",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Go to after 1... e5" }),
  ).not.toHaveTextContent("+M3");
  expect(screen.getByText("Analysis complete: 3 positions.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Analyse again" })).toBeEnabled();
});

test("uses calm cancellation wording and permits a fresh run", () => {
  renderPanel({
    game,
    positionIndex: 0,
    gameAnalysis: {
      ...idleGameAnalysis,
      status: "cancelled",
      completedCount: 1,
    },
    canAnalyseGame: true,
  });

  expect(
    screen.getByText("Analysis cancelled: 1 of 3 positions retained."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Analyse again" })).toBeEnabled();
});

test("reports a terminal engine error without offering a known-broken retry", () => {
  renderPanel({
    game,
    positionIndex: 0,
    gameAnalysis: {
      ...idleGameAnalysis,
      status: "error",
      errorMessage: "Worker failed",
    },
    canAnalyseGame: false,
  });

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Game analysis stopped. Worker failed",
  );
  expect(
    screen.queryByRole("button", { name: "Analyse again" }),
  ).not.toBeInTheDocument();
});
