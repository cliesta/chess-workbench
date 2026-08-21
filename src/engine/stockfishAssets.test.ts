import { describe, expect, test } from "vitest";
import { STOCKFISH_SOURCE_URL, STOCKFISH_WORKER_URL } from "./stockfishAssets";

describe("Stockfish production asset URLs", () => {
  test("use the exact package version for cache-safe engine distribution", () => {
    expect(STOCKFISH_WORKER_URL).toBe(
      "/stockfish/18.0.8/stockfish-18-lite-single.js",
    );
    expect(STOCKFISH_SOURCE_URL).toBe("/stockfish/18.0.8/SOURCE.txt");
  });
});
