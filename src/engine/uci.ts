import type { Evaluation } from "./types";

export type RawUciScore =
  { kind: "centipawns"; value: number } | { kind: "mate"; value: number };

export type UciMessage =
  | { type: "uciok" }
  | { type: "readyok" }
  | { type: "bestmove" }
  | {
      type: "info";
      depth: number | null;
      score: RawUciScore | null;
      scoreIsBound: boolean;
      multipv: number;
      principalVariation: string[];
    }
  | { type: "other" };

export function parseUciMessage(line: string): UciMessage {
  const trimmedLine = line.trim();

  if (trimmedLine === "uciok") {
    return { type: "uciok" };
  }

  if (trimmedLine === "readyok") {
    return { type: "readyok" };
  }

  if (trimmedLine.startsWith("bestmove ") || trimmedLine === "bestmove") {
    return { type: "bestmove" };
  }

  const tokens = trimmedLine.split(/\s+/);
  if (tokens[0] !== "info" || tokens[1] === "string") {
    return { type: "other" };
  }

  return {
    type: "info",
    depth: readIntegerAfter(tokens, "depth"),
    score: readScore(tokens),
    scoreIsBound:
      tokens.includes("lowerbound") || tokens.includes("upperbound"),
    multipv: readIntegerAfter(tokens, "multipv") ?? 1,
    principalVariation: readPrincipalVariation(tokens),
  };
}

export function normalizeEvaluation(
  score: RawUciScore,
  fen: string,
): Evaluation | null {
  const activeColour = fen.trim().split(/\s+/)[1];
  if (activeColour !== "w" && activeColour !== "b") {
    return null;
  }

  const whiteValue = activeColour === "w" ? score.value : -score.value;

  return score.kind === "centipawns"
    ? { kind: "centipawns", whiteCentipawns: whiteValue }
    : { kind: "mate", whiteMateIn: whiteValue };
}

function readIntegerAfter(tokens: string[], field: string): number | null {
  const index = tokens.indexOf(field);
  if (index === -1) {
    return null;
  }

  const value = Number(tokens[index + 1]);
  return Number.isInteger(value) ? value : null;
}

function readScore(tokens: string[]): RawUciScore | null {
  const index = tokens.indexOf("score");
  const kind = tokens[index + 1];
  const value = Number(tokens[index + 2]);

  if (index === -1 || !Number.isInteger(value)) {
    return null;
  }

  if (kind === "cp") {
    return { kind: "centipawns", value };
  }

  if (kind === "mate") {
    return { kind: "mate", value };
  }

  return null;
}

function readPrincipalVariation(tokens: string[]): string[] {
  const index = tokens.indexOf("pv");
  return index === -1 ? [] : tokens.slice(index + 1);
}
