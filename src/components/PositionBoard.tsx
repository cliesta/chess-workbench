import { Chessboard } from "react-chessboard";

type PositionBoardProps = {
  position: string;
  allowDragging: boolean;
  onMove: (from: string, to: string) => boolean;
  highlightedTargetSquare?: string;
  highlightedAttackerSquares?: string[];
};

export function PositionBoard({
  position,
  allowDragging,
  onMove,
  highlightedTargetSquare,
  highlightedAttackerSquares = [],
}: PositionBoardProps) {
  const squareStyles = Object.fromEntries([
    ...highlightedAttackerSquares.map((square) => [
      square,
      { boxShadow: "inset 0 0 0 0.16rem rgb(119 183 223 / 48%)" },
    ]),
    ...(highlightedTargetSquare
      ? [
          [
            highlightedTargetSquare,
            { boxShadow: "inset 0 0 0 0.22rem rgb(214 164 83 / 68%)" },
          ],
        ]
      : []),
  ]);

  return (
    <section className="board" aria-label="Chess board">
      <Chessboard
        options={{
          id: "workbench-board",
          position,
          boardOrientation: "white",
          allowDragging,
          allowDrawingArrows: false,
          boardStyle: {
            borderRadius: "0.55rem",
            boxShadow: "0 1.5rem 4rem rgb(0 0 0 / 35%)",
          },
          lightSquareStyle: { backgroundColor: "#a9a391" },
          darkSquareStyle: { backgroundColor: "#465968" },
          lightSquareNotationStyle: { color: "#465968" },
          darkSquareNotationStyle: { color: "#c9c3b1" },
          squareStyles,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare === null ? false : onMove(sourceSquare, targetSquare),
        }}
      />
    </section>
  );
}
