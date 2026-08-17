import { describe, expect, test } from "vitest";
import { normalizeEvaluation, parseUciMessage } from "./uci";

describe("parseUciMessage", () => {
  test("parses the analysis fields used by the application", () => {
    expect(
      parseUciMessage(
        "info depth 14 seldepth 21 multipv 1 score cp 34 nodes 1234 pv e2e4 e7e5 g1f3",
      ),
    ).toEqual({
      type: "info",
      depth: 14,
      score: { kind: "centipawns", value: 34 },
      scoreIsBound: false,
      multipv: 1,
      principalVariation: ["e2e4", "e7e5", "g1f3"],
    });
  });

  test("parses mate and tolerates a different field order", () => {
    expect(
      parseUciMessage("info score mate -2 nodes 50 depth 9 pv h7h8q"),
    ).toMatchObject({
      type: "info",
      depth: 9,
      score: { kind: "mate", value: -2 },
    });
  });

  test("defaults omitted multipv to the primary line and preserves explicit values", () => {
    expect(parseUciMessage("info depth 4 score cp 10")).toMatchObject({
      type: "info",
      multipv: 1,
    });
    expect(parseUciMessage("info depth 4 multipv 2 score cp 8")).toMatchObject({
      type: "info",
      multipv: 2,
    });
  });

  test("marks bound scores and ignores malformed numbers", () => {
    expect(
      parseUciMessage("info depth 8 score cp 40 lowerbound pv e2e4"),
    ).toMatchObject({ type: "info", scoreIsBound: true });
    expect(parseUciMessage("info depth nope score cp unknown")).toMatchObject({
      type: "info",
      depth: null,
      score: null,
    });
  });

  test.each([
    ["uciok", { type: "uciok" }],
    ["readyok", { type: "readyok" }],
    ["bestmove e2e4 ponder e7e5", { type: "bestmove" }],
    ["id name Stockfish 18", { type: "other" }],
    ["info string diagnostic text", { type: "other" }],
  ])("recognizes %s", (line, expected) => {
    expect(parseUciMessage(line)).toEqual(expected);
  });
});

describe("normalizeEvaluation", () => {
  const whiteToMove = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  const blackToMove = "4k3/8/8/8/8/8/8/4K3 b - - 0 1";

  test.each([
    [
      whiteToMove,
      { kind: "centipawns", value: 34 },
      { kind: "centipawns", whiteCentipawns: 34 },
    ],
    [
      blackToMove,
      { kind: "centipawns", value: 34 },
      { kind: "centipawns", whiteCentipawns: -34 },
    ],
    [whiteToMove, { kind: "mate", value: 3 }, { kind: "mate", whiteMateIn: 3 }],
    [
      blackToMove,
      { kind: "mate", value: 3 },
      { kind: "mate", whiteMateIn: -3 },
    ],
    [
      whiteToMove,
      { kind: "mate", value: -2 },
      { kind: "mate", whiteMateIn: -2 },
    ],
    [
      blackToMove,
      { kind: "mate", value: -2 },
      { kind: "mate", whiteMateIn: 2 },
    ],
  ] as const)(
    "normalizes a side-to-move score to White's perspective",
    (fen, score, expected) => {
      expect(normalizeEvaluation(score, fen)).toEqual(expected);
    },
  );

  test("returns null when the FEN has no valid active colour", () => {
    expect(
      normalizeEvaluation({ kind: "centipawns", value: 0 }, "not a fen"),
    ).toBeNull();
  });
});
