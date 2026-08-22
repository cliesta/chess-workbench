import { describe, expect, test } from "vitest";
import type { ImportedGame } from "../chess/game";
import type { AppliedMove } from "../chess/position";
import type { CompletedPositionAnalysis, Evaluation } from "../engine/types";
import { MIN_REVIEW_LOSS_CENTIPAWNS, findReviewMoments } from "./reviewMoments";

describe("centipawn review moments", () => {
  test.each([
    ["white", cp(40), cp(-80), 120],
    ["black", cp(40), cp(130), 90],
  ] as const)(
    "measures a %s loss from the mover's perspective",
    (color, before, after, expectedLoss) => {
      const { game, results } = oneMoveAnalysis(color, before, after);

      expect(findReviewMoments(game, results)).toMatchObject([
        {
          kind: "centipawn-loss",
          positionIndex: 1,
          move: { color },
          lossCentipawns: expectedLoss,
        },
      ]);
    },
  );

  test.each([
    ["white", cp(0), cp(100)],
    ["black", cp(0), cp(-100)],
  ] as const)("excludes a %s improvement", (color, before, after) => {
    const { game, results } = oneMoveAnalysis(color, before, after);

    expect(findReviewMoments(game, results)).toEqual([]);
  });

  test("uses an inclusive 75-centipawn boundary", () => {
    expect(MIN_REVIEW_LOSS_CENTIPAWNS).toBe(75);

    const below = oneMoveAnalysis("white", cp(0), cp(-74));
    const atBoundary = oneMoveAnalysis("white", cp(0), cp(-75));

    expect(findReviewMoments(below.game, below.results)).toEqual([]);
    expect(
      findReviewMoments(atBoundary.game, atBoundary.results),
    ).toMatchObject([{ lossCentipawns: 75 }]);
  });
});

describe("forced-mate review moments", () => {
  test.each([
    ["white", cp(20), mate(-4), "allowed-mate"],
    ["black", cp(-20), mate(4), "allowed-mate"],
    ["white", mate(3), cp(80), "lost-mate"],
    ["black", mate(-3), cp(-80), "lost-mate"],
    ["white", mate(3), mate(-2), "mate-reversal"],
    ["black", mate(-3), mate(2), "mate-reversal"],
  ] as const)(
    "classifies a %s transition as %s",
    (color, before, after, expectedKind) => {
      const { game, results } = oneMoveAnalysis(color, before, after);

      expect(findReviewMoments(game, results)).toMatchObject([
        { kind: expectedKind },
      ]);
    },
  );

  test.each([
    ["escaping opponent mate", "white", mate(-3), cp(-300)],
    ["finding own mate", "black", cp(300), mate(-4)],
    ["winning mate distance changes", "white", mate(3), mate(7)],
    ["losing mate distance changes", "black", mate(3), mate(8)],
    ["mate zero before", "white", mate(0), mate(-2)],
    ["mate zero after", "black", mate(-2), mate(0)],
  ] as const)("excludes %s", (_label, color, before, after) => {
    const { game, results } = oneMoveAnalysis(color, before, after);

    expect(findReviewMoments(game, results)).toEqual([]);
  });
});

test("requires matching adjacent results and move metadata", () => {
  const base = oneMoveAnalysis("white", cp(100), cp(0));

  expect(findReviewMoments(base.game, [null, base.results[1]])).toEqual([]);
  expect(findReviewMoments(base.game, [base.results[0], null])).toEqual([]);
  expect(
    findReviewMoments(base.game, [result("wrong", cp(100)), base.results[1]]),
  ).toEqual([]);
  expect(
    findReviewMoments(
      {
        ...base.game,
        positions: [base.game.positions[0], { fen: "after" }],
      },
      base.results,
    ),
  ).toEqual([]);
});

test("ranks mate transitions, then centipawn losses, and caps the list at three", () => {
  const game = gameWithMoves(["white", "black", "white", "black", "white"]);
  const results = [
    result("fen-0", cp(0)),
    result("fen-1", cp(-200)),
    result("fen-2", mate(2)),
    result("fen-3", mate(-2)),
    result("fen-4", cp(0)),
    result("fen-5", cp(-300)),
  ];

  expect(
    findReviewMoments(game, results).map(({ kind, positionIndex }) => ({
      kind,
      positionIndex,
    })),
  ).toEqual([
    { kind: "mate-reversal", positionIndex: 3 },
    { kind: "allowed-mate", positionIndex: 2 },
    { kind: "lost-mate", positionIndex: 4 },
  ]);
});

test("orders equal centipawn losses chronologically", () => {
  const game = gameWithMoves(["white", "black", "white", "black"]);
  const results = [
    result("fen-0", cp(0)),
    result("fen-1", cp(-100)),
    result("fen-2", cp(0)),
    result("fen-3", cp(-100)),
    result("fen-4", cp(0)),
  ];

  expect(
    findReviewMoments(game, results).map(({ positionIndex }) => positionIndex),
  ).toEqual([1, 2, 3]);
});

test("orders centipawn candidates by descending mover loss", () => {
  const game = gameWithMoves(["white", "black", "white"]);
  const results = [
    result("fen-0", cp(0)),
    result("fen-1", cp(-100)),
    result("fen-2", cp(100)),
    result("fen-3", cp(0)),
  ];

  expect(
    findReviewMoments(game, results).map(
      ({ positionIndex, lossCentipawns }) => ({
        positionIndex,
        lossCentipawns,
      }),
    ),
  ).toEqual([
    { positionIndex: 2, lossCentipawns: 200 },
    { positionIndex: 1, lossCentipawns: 100 },
    { positionIndex: 3, lossCentipawns: 100 },
  ]);
});

test("uses move color for a custom game beginning with Black", () => {
  const { game, results } = oneMoveAnalysis("black", cp(20), cp(120));
  game.positions[1].moveNumber = 17;

  expect(findReviewMoments(game, results)).toMatchObject([
    {
      positionIndex: 1,
      moveNumber: 17,
      move: { color: "black" },
      lossCentipawns: 100,
    },
  ]);
});

test("retains a SAN engine line and suppresses raw coordinate notation", () => {
  const san = oneMoveAnalysis("white", cp(100), cp(0));
  san.results[0] = result("before", cp(100), "1. Nf3 d5");
  const raw = oneMoveAnalysis("white", cp(100), cp(0));
  raw.results[0] = result("before", cp(100), "g1f3 d7d5", true);

  expect(findReviewMoments(san.game, san.results)[0]).toMatchObject({
    engineLineBeforeMove: "1. Nf3 d5",
    engineLineBeforeMoveUsesRawNotation: false,
  });
  expect(findReviewMoments(raw.game, raw.results)[0]).toMatchObject({
    engineLineBeforeMove: null,
    engineLineBeforeMoveUsesRawNotation: true,
  });
});

test("does not mutate the game or result arrays", () => {
  const { game, results } = oneMoveAnalysis("white", cp(100), cp(0));
  const gameSnapshot = structuredClone(game);
  const resultsSnapshot = structuredClone(results);

  findReviewMoments(game, results);

  expect(game).toEqual(gameSnapshot);
  expect(results).toEqual(resultsSnapshot);
});

function oneMoveAnalysis(
  color: AppliedMove["color"],
  before: Evaluation,
  after: Evaluation,
) {
  return {
    game: gameWithMoves([color]),
    results: [result("before", before), result("after", after)],
  };
}

function gameWithMoves(colors: AppliedMove["color"][]): ImportedGame {
  return {
    headers: {},
    positions: [
      { fen: colors.length === 1 ? "before" : "fen-0" },
      ...colors.map((color, index) => ({
        fen: colors.length === 1 ? "after" : `fen-${index + 1}`,
        moveNumber: Math.floor(index / 2) + 1,
        move: move(color, `Move${index + 1}`),
      })),
    ],
  };
}

function move(color: AppliedMove["color"], san: string): AppliedMove {
  return {
    color,
    piece: "pawn",
    from: "a2",
    to: "a3",
    san,
  };
}

function result(
  fen: string,
  evaluation: Evaluation,
  principalVariation: string | null = null,
  principalVariationUsesRawNotation = false,
): CompletedPositionAnalysis {
  return {
    fen,
    depth: 10,
    evaluation,
    principalVariation,
    principalVariationUsesRawNotation,
  };
}

function cp(whiteCentipawns: number): Evaluation {
  return { kind: "centipawns", whiteCentipawns };
}

function mate(whiteMateIn: number): Evaluation {
  return { kind: "mate", whiteMateIn };
}
