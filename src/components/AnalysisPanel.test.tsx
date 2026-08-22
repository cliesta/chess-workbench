import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { formatEvaluation } from "../engine/formatEvaluation";
import type {
  Evaluation,
  PositionAnalysisState,
  PositionAnalysisStatus,
} from "../engine/types";
import { AnalysisPanel } from "./AnalysisPanel";

const readyAnalysis: PositionAnalysisState = {
  status: "ready",
  depth: 12,
  evaluation: { kind: "centipawns", whiteCentipawns: 34 },
  principalVariation: "1. e4 e5 2. Nf3",
  principalVariationUsesRawNotation: false,
  errorMessage: null,
};

describe("AnalysisPanel", () => {
  test("shows a completed typed result", () => {
    render(<AnalysisPanel analysis={readyAnalysis} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("+0.34")).toBeInTheDocument();
    expect(screen.getByText("1. e4 e5 2. Nf3")).toBeInTheDocument();
  });

  test.each([
    ["loading", "Loading engine"],
    ["analysing-position", "Analysing position"],
    ["analysing-game", "Analysing game"],
    ["waiting-for-game", "Waiting for game analysis"],
  ] as Array<[PositionAnalysisStatus, string]>)(
    "labels the %s state without stale values",
    (status, label) => {
      render(
        <AnalysisPanel
          analysis={{
            ...readyAnalysis,
            status,
            depth: null,
            evaluation: null,
            principalVariation: null,
          }}
        />,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getAllByText("—")).toHaveLength(3);
      expect(screen.queryByText("+0.34")).not.toBeInTheDocument();
    },
  );

  test("shows an engine error without dropping the licence link", () => {
    render(
      <AnalysisPanel
        analysis={{
          ...readyAnalysis,
          status: "error",
          depth: null,
          evaluation: null,
          principalVariation: null,
          errorMessage: "Wasm unavailable",
        }}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Wasm unavailable");
    expect(
      screen.getByRole("link", { name: "Stockfish source and licence" }),
    ).toHaveAttribute("href", "/stockfish/18.0.8/SOURCE.txt");
  });
});

describe("formatEvaluation", () => {
  test.each([
    [null, "—"],
    [{ kind: "centipawns", whiteCentipawns: 0 }, "0.00"],
    [{ kind: "centipawns", whiteCentipawns: 34 }, "+0.34"],
    [{ kind: "centipawns", whiteCentipawns: -127 }, "−1.27"],
    [{ kind: "mate", whiteMateIn: 3 }, "+M3"],
    [{ kind: "mate", whiteMateIn: -2 }, "−M2"],
  ] as Array<[Evaluation | null, string]>)(
    "formats an evaluation for display",
    (evaluation, expected) => {
      expect(formatEvaluation(evaluation)).toBe(expected);
    },
  );
});
