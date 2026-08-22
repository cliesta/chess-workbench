import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportedGame } from "../chess/game";
import { createStockfishAnalysisClient } from "./stockfishAnalysisClient";
import {
  CURRENT_POSITION_MOVE_TIME_MS,
  GAME_POSITION_MOVE_TIME_MS,
  type AnalysisUpdate,
  type CompletedPositionAnalysis,
  type GameAnalysisState,
  type PositionAnalysisEngine,
  type PositionAnalysisState,
} from "./types";

export type PositionAnalysisEngineFactory = () => PositionAnalysisEngine;

type WorkbenchAnalysisOptions = {
  fen: string;
  game: ImportedGame | null;
  positionIndex: number | null;
  createEngine?: PositionAnalysisEngineFactory;
};

type WorkbenchAnalysis = {
  positionAnalysis: PositionAnalysisState;
  gameAnalysis: GameAnalysisState;
  canAnalyseGame: boolean;
  startGameAnalysis: () => void;
  cancelGameAnalysis: () => void;
};

type StoredPositionAnalysisState = PositionAnalysisState & {
  positionFen: string | null;
};

type ActiveRequest = {
  kind: "position" | "game";
  requestId: number;
  fen: string;
  positionIndex?: number;
  generation?: number;
};

type GameRun = {
  generation: number;
  game: ImportedGame;
  cancelled: boolean;
};

const EMPTY_POSITION_ANALYSIS: PositionAnalysisState = {
  status: "loading",
  depth: null,
  evaluation: null,
  principalVariation: null,
  principalVariationUsesRawNotation: false,
  errorMessage: null,
};

export function useWorkbenchAnalysis({
  fen,
  game,
  positionIndex,
  createEngine = createStockfishAnalysisClient,
}: WorkbenchAnalysisOptions): WorkbenchAnalysis {
  const [engineStatus, setEngineStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [storedPositionAnalysis, setStoredPositionAnalysis] =
    useState<StoredPositionAnalysisState>({
      ...EMPTY_POSITION_ANALYSIS,
      positionFen: null,
    });
  const [gameAnalysis, setGameAnalysis] = useState<GameAnalysisState>(() =>
    emptyGameAnalysis(game),
  );
  const engineRef = useRef<PositionAnalysisEngine | null>(null);
  const engineReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const desiredRef = useRef({ fen, game, positionIndex });
  const trackedGameRef = useRef<ImportedGame | null>(game);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const gameRunRef = useRef<GameRun | null>(null);
  const nextRequestIdRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    desiredRef.current = { fen, game, positionIndex };
  }, [fen, game, positionIndex]);

  const startPositionAnalysis = useCallback(
    (engine: PositionAnalysisEngine, positionFen: string) => {
      if (!engineReadyRef.current || gameRunRef.current) {
        return;
      }

      const requestId = ++nextRequestIdRef.current;
      activeRequestRef.current = {
        kind: "position",
        requestId,
        fen: positionFen,
      };
      setStoredPositionAnalysis({
        ...EMPTY_POSITION_ANALYSIS,
        status: "analysing-position",
        positionFen,
      });

      void engine
        .analyse(
          {
            requestId,
            fen: positionFen,
            moveTimeMs: CURRENT_POSITION_MOVE_TIME_MS,
          },
          (update) => {
            const active = activeRequestRef.current;
            if (
              active?.kind !== "position" ||
              active.requestId !== update.requestId ||
              active.fen !== update.fen
            ) {
              return;
            }

            setStoredPositionAnalysis({
              ...toPositionAnalysis(update, "analysing-position"),
              positionFen: update.fen,
            });
          },
        )
        .then((completion) => {
          const active = activeRequestRef.current;
          if (
            completion !== "complete" ||
            active?.kind !== "position" ||
            active.requestId !== requestId ||
            active.fen !== positionFen
          ) {
            return;
          }

          activeRequestRef.current = null;
          setStoredPositionAnalysis((current) => ({
            ...current,
            status: "ready",
          }));
        })
        .catch((error: unknown) => {
          const active = activeRequestRef.current;
          if (
            active?.kind !== "position" ||
            active.requestId !== requestId ||
            active.fen !== positionFen
          ) {
            return;
          }

          activeRequestRef.current = null;
          engineReadyRef.current = false;
          setEngineStatus("error");
          setStoredPositionAnalysis({
            ...EMPTY_POSITION_ANALYSIS,
            status: "error",
            errorMessage: errorMessage(error, "Stockfish analysis failed."),
            positionFen,
          });
        });
    },
    [],
  );

  const finishGameRun = useCallback(
    (
      run: GameRun,
      status: "cancelled" | "complete",
      results: Array<CompletedPositionAnalysis | null>,
      completedCount: number,
    ) => {
      if (gameRunRef.current !== run || !mountedRef.current) {
        return;
      }

      gameRunRef.current = null;
      activeRequestRef.current = null;
      setGameAnalysis({
        status,
        results,
        completedCount,
        totalCount: results.length,
        activePositionIndex: null,
        activeResult: null,
        errorMessage: null,
      });

      const engine = engineRef.current;
      if (engine && engineReadyRef.current) {
        startPositionAnalysis(engine, desiredRef.current.fen);
      }
    },
    [startPositionAnalysis],
  );

  const runGameAnalysis = useCallback(
    async (engine: PositionAnalysisEngine, run: GameRun) => {
      const positions = run.game.positions;
      const results: Array<CompletedPositionAnalysis | null> = positions.map(
        () => null,
      );
      let completedCount = 0;

      try {
        for (const [index, position] of positions.entries()) {
          if (run.cancelled || gameRunRef.current !== run) {
            return;
          }

          const requestId = ++nextRequestIdRef.current;
          let latest: CompletedPositionAnalysis = emptyCompletedAnalysis(
            position.fen,
          );
          activeRequestRef.current = {
            kind: "game",
            requestId,
            fen: position.fen,
            positionIndex: index,
            generation: run.generation,
          };
          setGameAnalysis((current) => ({
            ...current,
            activePositionIndex: index,
            activeResult: null,
          }));

          const completion = await engine.analyse(
            {
              requestId,
              fen: position.fen,
              moveTimeMs: GAME_POSITION_MOVE_TIME_MS,
            },
            (update) => {
              if (!acceptsGameUpdate(run, index, update)) {
                return;
              }

              latest = toCompletedAnalysis(update);
              setGameAnalysis((current) => ({
                ...current,
                activePositionIndex: index,
                activeResult: latest,
              }));
            },
          );

          if (gameRunRef.current !== run) {
            return;
          }
          if (run.cancelled || completion === "interrupted") {
            finishGameRun(run, "cancelled", results, completedCount);
            return;
          }
          if (completion !== "complete") {
            return;
          }

          results[index] = latest;
          completedCount += 1;
          setGameAnalysis({
            status: "running",
            results: [...results],
            completedCount,
            totalCount: positions.length,
            activePositionIndex:
              index + 1 < positions.length ? index + 1 : null,
            activeResult: null,
            errorMessage: null,
          });
        }

        finishGameRun(run, "complete", results, completedCount);
      } catch (error) {
        if (gameRunRef.current !== run || !mountedRef.current) {
          return;
        }

        gameRunRef.current = null;
        activeRequestRef.current = null;
        engineReadyRef.current = false;
        setEngineStatus("error");
        const message = errorMessage(error, "Game analysis failed.");
        setGameAnalysis({
          status: "error",
          results,
          completedCount,
          totalCount: positions.length,
          activePositionIndex: null,
          activeResult: null,
          errorMessage: message,
        });
        setStoredPositionAnalysis({
          ...EMPTY_POSITION_ANALYSIS,
          status: "error",
          errorMessage: message,
          positionFen: desiredRef.current.fen,
        });
      }
    },
    [finishGameRun],
  );

  const startGameAnalysis = useCallback(() => {
    const engine = engineRef.current;
    const currentGame = desiredRef.current.game;
    if (!engine || !engineReadyRef.current || !currentGame) {
      return;
    }

    const run: GameRun = {
      generation: ++generationRef.current,
      game: currentGame,
      cancelled: false,
    };
    gameRunRef.current = run;
    setGameAnalysis({
      status: "running",
      results: currentGame.positions.map(() => null),
      completedCount: 0,
      totalCount: currentGame.positions.length,
      activePositionIndex: 0,
      activeResult: null,
      errorMessage: null,
    });
    void runGameAnalysis(engine, run);
  }, [runGameAnalysis]);

  const cancelGameAnalysis = useCallback(() => {
    const run = gameRunRef.current;
    const active = activeRequestRef.current;
    if (!run || active?.kind !== "game") {
      return;
    }

    run.cancelled = true;
    engineRef.current?.stop(active.requestId);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const engine = createEngine();
    engineRef.current = engine;
    engineReadyRef.current = false;

    void engine
      .initialize()
      .then(() => {
        if (engineRef.current !== engine || !mountedRef.current) {
          return;
        }

        engineReadyRef.current = true;
        setEngineStatus("ready");
        startPositionAnalysis(engine, desiredRef.current.fen);
      })
      .catch((error: unknown) => {
        if (engineRef.current !== engine || !mountedRef.current) {
          return;
        }

        engineReadyRef.current = false;
        setEngineStatus("error");
        setStoredPositionAnalysis({
          ...EMPTY_POSITION_ANALYSIS,
          status: "error",
          errorMessage: errorMessage(error, "Stockfish could not be started."),
          positionFen: null,
        });
      });

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      gameRunRef.current = null;
      activeRequestRef.current = null;
      engineReadyRef.current = false;
      engineRef.current = null;
      engine.dispose();
    };
  }, [createEngine, startPositionAnalysis]);

  useEffect(() => {
    const gameChanged = trackedGameRef.current !== game;
    if (gameChanged) {
      trackedGameRef.current = game;
      generationRef.current += 1;
      const run = gameRunRef.current;
      const active = activeRequestRef.current;
      if (run) {
        run.cancelled = true;
      }
      gameRunRef.current = null;
      if (active?.kind === "game") {
        engineRef.current?.stop(active.requestId);
      }
      activeRequestRef.current = null;
      setGameAnalysis(emptyGameAnalysis(game));
    }

    const engine = engineRef.current;
    if (engine && engineReadyRef.current && !gameRunRef.current) {
      startPositionAnalysis(engine, fen);
    }
  }, [fen, game, startPositionAnalysis]);

  return {
    positionAnalysis: derivePositionAnalysis(
      fen,
      game,
      positionIndex,
      storedPositionAnalysis,
      gameAnalysis,
    ),
    gameAnalysis,
    canAnalyseGame:
      game !== null &&
      engineStatus === "ready" &&
      gameAnalysis.status !== "running",
    startGameAnalysis,
    cancelGameAnalysis,
  };

  function acceptsGameUpdate(
    run: GameRun,
    index: number,
    update: AnalysisUpdate,
  ) {
    const active = activeRequestRef.current;
    return (
      mountedRef.current &&
      gameRunRef.current === run &&
      !run.cancelled &&
      desiredRef.current.game === run.game &&
      active?.kind === "game" &&
      active.generation === run.generation &&
      active.positionIndex === index &&
      active.requestId === update.requestId &&
      active.fen === update.fen &&
      run.game.positions[index]?.fen === update.fen
    );
  }
}

function derivePositionAnalysis(
  fen: string,
  game: ImportedGame | null,
  positionIndex: number | null,
  stored: StoredPositionAnalysisState,
  gameAnalysis: GameAnalysisState,
): PositionAnalysisState {
  if (game && positionIndex !== null && gameAnalysis.status === "running") {
    const result = gameAnalysis.results[positionIndex];
    if (result?.fen === fen) {
      return {
        ...result,
        status: "ready",
        errorMessage: null,
      };
    }
    if (gameAnalysis.activePositionIndex === positionIndex) {
      if (gameAnalysis.activeResult?.fen === fen) {
        return {
          ...gameAnalysis.activeResult,
          status: "analysing-game",
          errorMessage: null,
        };
      }
      return {
        ...EMPTY_POSITION_ANALYSIS,
        status: "analysing-game",
      };
    }
    return { ...EMPTY_POSITION_ANALYSIS, status: "waiting-for-game" };
  }

  const { positionFen, ...positionState } = stored;
  if (
    positionFen !== fen &&
    positionState.status !== "loading" &&
    positionState.status !== "error"
  ) {
    return { ...EMPTY_POSITION_ANALYSIS, status: "analysing-position" };
  }
  return positionState;
}

function emptyGameAnalysis(game: ImportedGame | null): GameAnalysisState {
  const totalCount = game?.positions.length ?? 0;
  return {
    status: "idle",
    results: Array.from({ length: totalCount }, () => null),
    completedCount: 0,
    totalCount,
    activePositionIndex: null,
    activeResult: null,
    errorMessage: null,
  };
}

function emptyCompletedAnalysis(fen: string): CompletedPositionAnalysis {
  return {
    fen,
    depth: null,
    evaluation: null,
    principalVariation: null,
    principalVariationUsesRawNotation: false,
  };
}

function toCompletedAnalysis(
  update: AnalysisUpdate,
): CompletedPositionAnalysis {
  return {
    fen: update.fen,
    depth: update.depth,
    evaluation: update.evaluation,
    principalVariation: update.principalVariation,
    principalVariationUsesRawNotation: update.principalVariationUsesRawNotation,
  };
}

function toPositionAnalysis(
  update: AnalysisUpdate,
  status: PositionAnalysisState["status"],
): PositionAnalysisState {
  return {
    status,
    depth: update.depth,
    evaluation: update.evaluation,
    principalVariation: update.principalVariation,
    principalVariationUsesRawNotation: update.principalVariationUsesRawNotation,
    errorMessage: null,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
