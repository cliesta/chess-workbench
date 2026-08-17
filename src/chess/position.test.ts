import { describe, expect, test } from "vitest";
import { STARTING_FEN, attemptMove, parsePosition } from "./position";

describe("parsePosition", () => {
  test("accepts and normalizes a valid position", () => {
    expect(
      parsePosition("  r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1  "),
    ).toEqual({
      kind: "valid",
      fen: "r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1",
    });
  });

  test("rejects malformed FEN", () => {
    const result = parsePosition("not a fen");

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.message).toMatch(/invalid fen/i);
    }
  });

  test("rejects a position with a missing king", () => {
    const result = parsePosition("4k3/8/8/8/8/8/8/8 w - - 0 1");

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.message).toMatch(/missing white king/i);
    }
  });
});

describe("attemptMove", () => {
  test("applies an ordinary legal move", () => {
    expect(attemptMove(STARTING_FEN, "e2", "e4")).toEqual({
      kind: "moved",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    });
  });

  test("rejects an illegal move without changing the supplied position", () => {
    expect(attemptMove(STARTING_FEN, "e2", "e5")).toEqual({
      kind: "illegal",
    });
    expect(STARTING_FEN).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  test("applies kingside castling and updates castling rights", () => {
    expect(
      attemptMove("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1", "g1"),
    ).toEqual({
      kind: "moved",
      fen: "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1",
    });
  });

  test("applies en passant and removes the captured pawn", () => {
    expect(
      attemptMove("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5", "d6"),
    ).toEqual({
      kind: "moved",
      fen: "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1",
    });
  });

  test("requires an explicit choice before promotion", () => {
    expect(attemptMove("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7", "a8")).toEqual({
      kind: "promotion-required",
      from: "a7",
      to: "a8",
      choices: ["q", "r", "b", "n"],
    });
  });

  test.each([
    ["q", "Q3k3/8/8/8/8/8/8/4K3 b - - 0 1"],
    ["n", "N3k3/8/8/8/8/8/8/4K3 b - - 0 1"],
  ] as const)("completes promotion to %s", (piece, expectedFen) => {
    expect(
      attemptMove("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7", "a8", piece),
    ).toEqual({ kind: "moved", fen: expectedFen });
  });

  test("detects and completes a black promotion", () => {
    const fen = "4k3/8/8/8/8/8/p7/4K3 b - - 0 1";

    expect(attemptMove(fen, "a2", "a1")).toMatchObject({
      kind: "promotion-required",
      choices: ["q", "r", "b", "n"],
    });
    expect(attemptMove(fen, "a2", "a1", "r")).toEqual({
      kind: "moved",
      fen: "4k3/8/8/8/8/8/8/r3K3 w - - 0 2",
    });
  });
});
