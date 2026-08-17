import type { Evaluation } from "./types";

export function formatEvaluation(evaluation: Evaluation | null): string {
  if (!evaluation) {
    return "—";
  }

  if (evaluation.kind === "mate") {
    return formatSignedValue(evaluation.whiteMateIn, "M");
  }

  const pawns = evaluation.whiteCentipawns / 100;
  if (pawns === 0) {
    return "0.00";
  }

  return `${pawns > 0 ? "+" : "−"}${Math.abs(pawns).toFixed(2)}`;
}

function formatSignedValue(value: number, prefix: string): string {
  if (value === 0) {
    return `${prefix}0`;
  }

  return `${value > 0 ? "+" : "−"}${prefix}${Math.abs(value)}`;
}
