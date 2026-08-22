import { describe, expect, test } from "vitest";
import { parseGame } from "./game";

describe("parseGame", () => {
  test("precomputes the same factual comparison for an imported capture", () => {
    const result = parseGame(`
[SetUp "1"]
[FEN "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 7"]

7. exd5 *
    `);

    expect(result).toMatchObject({
      kind: "valid",
      game: {
        positions: [
          {},
          {
            changes: {
              move: { san: "exd5" },
              material: {
                countChanges: [
                  {
                    color: "black",
                    type: "pawn",
                    before: 1,
                    after: 0,
                    pointDelta: -1,
                  },
                ],
                whiteMinusBlackBefore: 0,
                whiteMinusBlackAfter: 1,
              },
            },
          },
        ],
      },
    });
    if (result.kind === "valid") {
      expect(result.game.positions[0]).not.toHaveProperty("changes");
    }
  });

  test("passes through a parser error without creating a game", () => {
    expect(parseGame("")).toEqual({
      kind: "invalid",
      message: "Enter a PGN game to load.",
    });
  });
});
