import { describe, expect, test } from "vitest";
import {
  attemptMove,
  getPositionInsights,
  type PromotionPiece,
} from "./position";
import { comparePositionInsights } from "./positionChanges";

function changesAfter(
  fen: string,
  from: string,
  to: string,
  promotion?: PromotionPiece,
) {
  const result = attemptMove(fen, from, to, promotion);
  if (result.kind !== "moved") {
    throw new Error(`Expected ${from}-${to} to be legal`);
  }
  return comparePositionInsights(
    getPositionInsights(fen),
    getPositionInsights(result.fen),
    result.move,
  );
}

describe("comparePositionInsights", () => {
  test("retains SAN and reports no tracked change for a quiet move", () => {
    const changes = changesAfter(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "e2",
      "e4",
    );

    expect(changes.move.san).toBe("e4");
    expect(changes.material.countChanges).toEqual([]);
    expect(changes.check).toEqual({ entered: [], left: [] });
    expect(changes.becameAttackedAndUndefended).toEqual([]);
    expect(changes.stoppedBeingAttackedAndUndefended).toEqual([]);
  });

  test("reports a White capture with exact material and balance changes", () => {
    const changes = changesAfter(
      "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
      "e4",
      "d5",
    );

    expect(changes.material).toMatchObject({
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
    });
  });

  test("keeps the White-relative sign correct after a Black capture", () => {
    const changes = changesAfter(
      "4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1",
      "d5",
      "e4",
    );

    expect(changes.material.countChanges).toEqual([
      {
        color: "white",
        type: "pawn",
        before: 1,
        after: 0,
        pointDelta: -1,
      },
    ]);
    expect(changes.material.whiteMinusBlackAfter).toBe(-1);
  });

  test("reports promotion piece counts and the net material increase", () => {
    const changes = changesAfter(
      "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
      "a7",
      "a8",
      "n",
    );

    expect(changes.material.countChanges).toEqual([
      {
        color: "white",
        type: "knight",
        before: 0,
        after: 1,
        pointDelta: 3,
      },
      {
        color: "white",
        type: "pawn",
        before: 1,
        after: 0,
        pointDelta: -1,
      },
    ]);
    expect(
      changes.material.whitePointsAfter - changes.material.whitePointsBefore,
    ).toBe(2);
  });

  test("identifies the colour that enters check", () => {
    const changes = changesAfter("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1", "e2", "e7");

    expect(changes.check).toEqual({ entered: ["black"], left: [] });
  });

  test("identifies the colour that leaves check", () => {
    const changes = changesAfter("4r1k1/8/8/8/8/8/8/4K3 w - - 0 1", "e1", "f2");

    expect(changes.check).toEqual({ entered: [], left: ["white"] });
  });

  test("retains both transitions when a player answers check with check", () => {
    const changes = changesAfter("8/4k3/8/8/Qb6/8/8/4K3 w - - 0 1", "a4", "b4");

    expect(changes.check).toEqual({
      entered: ["black"],
      left: ["white"],
    });
  });

  test("reports a target that becomes loose when its defender moves", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q4/2B5/8/4K3 w - - 0 1",
      "c3",
      "d2",
    );

    expect(changes.becameAttackedAndUndefended).toContainEqual({
      piece: { color: "white", type: "queen", square: "d4" },
      attackers: [{ color: "black", type: "rook", square: "a4" }],
    });
  });

  test("reports a surviving target that gains a defender", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q4/8/8/2R1K3 w - - 0 1",
      "c1",
      "d1",
    );

    expect(changes.stoppedBeingAttackedAndUndefended).toContainEqual({
      piece: { color: "white", type: "queen", square: "d4" },
    });
  });

  test("follows a loose moving piece to safety", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1",
      "d4",
      "e3",
    );

    expect(changes.stoppedBeingAttackedAndUndefended).toContainEqual({
      piece: { color: "white", type: "queen", square: "e3" },
      previousSquare: "d4",
    });
    expect(changes.becameAttackedAndUndefended).not.toContainEqual(
      expect.objectContaining({
        piece: expect.objectContaining({ square: "e3" }),
      }),
    );
  });

  test("does not report a moving piece that remains loose as removed and added", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1",
      "d4",
      "e4",
    );

    expect(changes.becameAttackedAndUndefended).toEqual([]);
    expect(changes.stoppedBeingAttackedAndUndefended).toEqual([]);
  });

  test("does not describe a captured loose piece as resolved", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q4/8/8/4K3 w - - 0 1",
      "d4",
      "a4",
    );

    expect(changes.stoppedBeingAttackedAndUndefended).not.toContainEqual(
      expect.objectContaining({
        piece: expect.objectContaining({ color: "black", square: "a4" }),
      }),
    );
  });

  test("uses the actual en-passant capture square for loose-piece identity", () => {
    const changes = changesAfter(
      "4k3/8/8/3pP3/8/8/6B1/4K3 w - d6 0 1",
      "e5",
      "d6",
    );

    expect(changes.stoppedBeingAttackedAndUndefended).not.toContainEqual(
      expect.objectContaining({
        piece: expect.objectContaining({ color: "black", square: "d5" }),
      }),
    );
  });

  test("follows the rook when castling changes its loose status", () => {
    const changes = changesAfter("k6r/8/8/8/8/8/8/4K2R w K - 0 1", "e1", "g1");

    expect(changes.stoppedBeingAttackedAndUndefended).toContainEqual({
      piece: { color: "white", type: "rook", square: "f1" },
      previousSquare: "h1",
    });
  });

  test("preserves the static pinned-attacker semantics", () => {
    const changes = changesAfter(
      "4k3/4n3/2B5/8/8/8/4R3/4K3 w - - 0 1",
      "c6",
      "b5",
    );

    expect(changes.stoppedBeingAttackedAndUndefended).toContainEqual({
      piece: { color: "white", type: "bishop", square: "b5" },
      previousSquare: "c6",
    });
  });

  test("orders material and loose-piece changes deterministically", () => {
    const changes = changesAfter(
      "4k3/8/8/8/r2Q3r/2B5/8/4K3 w - - 0 1",
      "c3",
      "d2",
    );

    expect(
      changes.becameAttackedAndUndefended.map(({ piece }) => piece.square),
    ).toEqual(["d4"]);
    expect(
      changes.becameAttackedAndUndefended[0]?.attackers?.map(
        ({ square }) => square,
      ),
    ).toEqual(["a4", "h4"]);
  });
});
