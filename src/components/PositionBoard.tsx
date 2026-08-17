import { Chessboard } from "react-chessboard";

type PositionBoardProps = {
  position: string;
  allowDragging: boolean;
  onMove: (from: string, to: string) => boolean;
};

export function PositionBoard({
  position,
  allowDragging,
  onMove,
}: PositionBoardProps) {
  return (
    <section className="board" aria-label="Chess board">
      <Chessboard
        options={{
          id: "workbench-board",
          position,
          boardOrientation: "white",
          allowDragging,
          allowDrawingArrows: false,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare === null ? false : onMove(sourceSquare, targetSquare),
        }}
      />
    </section>
  );
}
