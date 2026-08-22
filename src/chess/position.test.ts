import { describe, expect, test } from "vitest";
import {
  STARTING_FEN,
  attemptMove,
  formatPrincipalVariation,
  getPositionInsights,
  parsePosition,
} from "./position";

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
      move: {
        color: "white",
        piece: "pawn",
        from: "e2",
        to: "e4",
        san: "e4",
      },
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
      move: {
        color: "white",
        piece: "king",
        from: "e1",
        to: "g1",
        san: "O-O",
        castlingRook: { from: "h1", to: "f1" },
      },
    });
  });

  test("records the rook movement for queenside castling", () => {
    expect(
      attemptMove("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", "e8", "c8"),
    ).toMatchObject({
      kind: "moved",
      move: {
        color: "black",
        san: "O-O-O",
        castlingRook: { from: "a8", to: "d8" },
      },
    });
  });

  test("applies en passant and removes the captured pawn", () => {
    expect(
      attemptMove("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5", "d6"),
    ).toEqual({
      kind: "moved",
      fen: "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1",
      move: {
        color: "white",
        piece: "pawn",
        from: "e5",
        to: "d6",
        san: "exd6",
        captured: { color: "black", type: "pawn", square: "d5" },
      },
    });
  });

  test("records an ordinary capture and its destination square", () => {
    expect(
      attemptMove("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4", "d5"),
    ).toMatchObject({
      kind: "moved",
      move: {
        san: "exd5",
        captured: { color: "black", type: "pawn", square: "d5" },
      },
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
    const promotionType = piece === "q" ? "queen" : "knight";
    expect(
      attemptMove("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7", "a8", piece),
    ).toMatchObject({
      kind: "moved",
      fen: expectedFen,
      move: {
        color: "white",
        piece: "pawn",
        from: "a7",
        to: "a8",
        promotion: promotionType,
      },
    });
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
      move: {
        color: "black",
        piece: "pawn",
        from: "a2",
        to: "a1",
        san: "a1=R+",
        promotion: "rook",
      },
    });
  });

  test("preserves a checkmate suffix in SAN", () => {
    expect(
      attemptMove("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", "g6", "g7"),
    ).toMatchObject({ kind: "moved", move: { san: "Qg7#" } });
  });
});

describe("formatPrincipalVariation", () => {
  test("replays a line from a non-starting position", () => {
    expect(
      formatPrincipalVariation(
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        ["g1f3", "b8c6", "f1b5"],
      ),
    ).toEqual({
      notation: "2. Nf3 Nc6 3. Bb5",
      complete: true,
      usesRawNotation: false,
    });
  });

  test("numbers a line that starts with Black to move", () => {
    expect(
      formatPrincipalVariation(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        ["e7e5", "g1f3"],
      ).notation,
    ).toBe("1... e5 2. Nf3");
  });

  test.each([
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1"], "1. O-O"],
    ["4k3/P7/8/8/8/8/8/4K3 w - - 0 1", ["a7a8q"], "1. a8=Q+"],
  ] as const)("uses chess.js SAN for special moves", (fen, moves, notation) => {
    expect(formatPrincipalVariation(fen, [...moves]).notation).toBe(notation);
  });

  test("preserves a valid SAN prefix when later output is malformed", () => {
    expect(
      formatPrincipalVariation(STARTING_FEN, ["e2e4", "truncated"]),
    ).toEqual({
      notation: "1. e4",
      complete: false,
      usesRawNotation: false,
    });
  });

  test("returns a marked raw fallback when the first move cannot be converted", () => {
    expect(formatPrincipalVariation(STARTING_FEN, ["e2e5", "e7e5"])).toEqual({
      notation: "e2e5 e7e5",
      complete: false,
      usesRawNotation: true,
    });
  });
});

describe("getPositionInsights", () => {
  test("describes the starting position", () => {
    const insights = getPositionInsights(STARTING_FEN);

    expect(insights.sideToMove).toBe("white");
    expect(insights.inCheck).toBe(false);
    expect(insights.material).toEqual({
      white: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 },
      black: { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 },
      whitePoints: 39,
      blackPoints: 39,
      whiteMinusBlack: 0,
    });
    expect(insights.attackedAndUndefended).toEqual([]);
  });

  test("reads Black to move from the FEN", () => {
    expect(
      getPositionInsights("4k3/8/8/8/8/8/8/4K3 b - - 0 1").sideToMove,
    ).toBe("black");
  });

  test("reports check without listing the king as a loose piece", () => {
    const insights = getPositionInsights("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");

    expect(insights.inCheck).toBe(true);
    expect(
      insights.attackedAndUndefended.some(
        (finding) => finding.piece.type === "king",
      ),
    ).toBe(false);
  });

  test.each([
    ["white", "4k3/8/8/8/8/8/8/Q3K3 w - - 0 1", 9],
    ["black", "q3k3/8/8/8/8/8/8/4K3 w - - 0 1", -9],
  ] as const)("reports a %s material advantage", (_color, fen, balance) => {
    expect(getPositionInsights(fen).material.whiteMinusBlack).toBe(balance);
  });

  test("counts promoted material instead of assuming a standard inventory", () => {
    const material = getPositionInsights(
      "4k3/8/8/8/8/8/8/Q2QK3 w - - 0 1",
    ).material;

    expect(material.white.queen).toBe(2);
    expect(material.whitePoints).toBe(18);
  });

  test("reports an attacked and undefended target and its attacker", () => {
    const finding = getPositionInsights(
      "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1",
    ).attackedAndUndefended.find(({ piece }) => piece.square === "d4");

    expect(finding).toEqual({
      piece: { color: "white", type: "queen", square: "d4" },
      attackers: [{ color: "black", type: "rook", square: "a4" }],
    });
  });

  test("does not report a target whose square has a friendly defender", () => {
    const findings = getPositionInsights(
      "4k3/8/8/8/r2Q4/2B5/8/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings.some(({ piece }) => piece.square === "d4")).toBe(false);
  });

  test("includes an attacked and undefended pawn", () => {
    const findings = getPositionInsights(
      "4k3/1b6/8/8/4P3/8/8/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings).toContainEqual({
      piece: { color: "white", type: "pawn", square: "e4" },
      attackers: [{ color: "black", type: "bishop", square: "b7" }],
    });
  });

  test("inspects pieces of both colours", () => {
    const findings = getPositionInsights(
      "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings.map(({ piece }) => [piece.color, piece.square])).toEqual([
      ["white", "d4"],
      ["black", "a4"],
    ]);
  });

  test("counts a pinned piece as an attacker", () => {
    const findings = getPositionInsights(
      "4k3/4n3/2B5/8/8/8/4R3/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings).toContainEqual({
      piece: { color: "white", type: "bishop", square: "c6" },
      attackers: [{ color: "black", type: "knight", square: "e7" }],
    });
  });

  test("counts a pinned piece as a defender", () => {
    const findings = getPositionInsights(
      "4r1k1/8/8/8/8/1b6/2N1R3/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings.some(({ piece }) => piece.square === "c2")).toBe(false);
  });

  test("orders findings by colour then square and attackers by square", () => {
    const findings = getPositionInsights(
      "4k3/8/8/8/r2Q3r/8/2B5/4K3 w - - 0 1",
    ).attackedAndUndefended;

    expect(findings.map(({ piece }) => piece.square)).toEqual([
      "d4",
      "a4",
      "h4",
    ]);
    expect(
      findings
        .find(({ piece }) => piece.square === "d4")
        ?.attackers.map(({ square }) => square),
    ).toEqual(["a4", "h4"]);
  });
});
