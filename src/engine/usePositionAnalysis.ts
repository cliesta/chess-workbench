import { useCallback, useEffect, useRef, useState } from "react";
import { createStockfishAnalysisClient } from "./stockfishAnalysisClient";
import {
  ANALYSIS_MOVE_TIME_MS,
  type AnalysisUpdate,
  type PositionAnalysisEngine,
} from "./types";

export type AnalysisStatus = "loading" | "ready" | "analysing" | "error";

export type PositionAnalysisState = {
  status: AnalysisStatus;
  depth: number | null;
  evaluation: AnalysisUpdate["evaluation"];
  principalVariation: string | null;
  principalVariationUsesRawNotation: boolean;
  errorMessage: string | null;
};

export type PositionAnalysisEngineFactory = () => PositionAnalysisEngine;

type StoredPositionAnalysisState = PositionAnalysisState & {
  positionFen: string | null;
};

const EMPTY_ANALYSIS: PositionAnalysisState = {
  status: "loading",
  depth: null,
  evaluation: null,
  principalVariation: null,
  principalVariationUsesRawNotation: false,
  errorMessage: null,
};

export function usePositionAnalysis(
  fen: string,
  createEngine: PositionAnalysisEngineFactory = createStockfishAnalysisClient,
): PositionAnalysisState {
  const [storedState, setStoredState] = useState<StoredPositionAnalysisState>({
    ...EMPTY_ANALYSIS,
    positionFen: null,
  });
  const engineRef = useRef<PositionAnalysisEngine | null>(null);
  const engineReadyRef = useRef(false);
  const desiredFenRef = useRef(fen);
  const currentRequestRef = useRef<{ requestId: number; fen: string } | null>(
    null,
  );
  const nextRequestIdRef = useRef(0);

  const startAnalysis = useCallback(
    (engine: PositionAnalysisEngine, positionFen: string) => {
      const requestId = ++nextRequestIdRef.current;
      currentRequestRef.current = { requestId, fen: positionFen };
      setStoredState({
        ...EMPTY_ANALYSIS,
        status: "analysing",
        positionFen,
      });

      void engine
        .analyse(
          {
            requestId,
            fen: positionFen,
            moveTimeMs: ANALYSIS_MOVE_TIME_MS,
          },
          (update) => {
            const current = currentRequestRef.current;
            if (
              current?.requestId !== update.requestId ||
              current.fen !== update.fen
            ) {
              return;
            }

            setStoredState({
              status: "analysing",
              depth: update.depth,
              evaluation: update.evaluation,
              principalVariation: update.principalVariation,
              principalVariationUsesRawNotation:
                update.principalVariationUsesRawNotation,
              errorMessage: null,
              positionFen: update.fen,
            });
          },
        )
        .then((completion) => {
          const current = currentRequestRef.current;
          if (
            completion !== "complete" ||
            current?.requestId !== requestId ||
            current.fen !== positionFen
          ) {
            return;
          }

          setStoredState((currentState) => ({
            ...currentState,
            status: "ready",
          }));
        })
        .catch((error: unknown) => {
          const current = currentRequestRef.current;
          if (current?.requestId !== requestId || current.fen !== positionFen) {
            return;
          }

          setStoredState({
            ...EMPTY_ANALYSIS,
            status: "error",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Stockfish analysis failed.",
            positionFen,
          });
        });
    },
    [],
  );

  useEffect(() => {
    desiredFenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    const engine = createEngine();
    engineRef.current = engine;
    engineReadyRef.current = false;

    void engine
      .initialize()
      .then(() => {
        if (engineRef.current !== engine) {
          return;
        }

        engineReadyRef.current = true;
        startAnalysis(engine, desiredFenRef.current);
      })
      .catch((error: unknown) => {
        if (engineRef.current !== engine) {
          return;
        }

        setStoredState({
          ...EMPTY_ANALYSIS,
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Stockfish could not be started.",
          positionFen: null,
        });
      });

    return () => {
      currentRequestRef.current = null;
      engineReadyRef.current = false;
      engineRef.current = null;
      engine.dispose();
    };
  }, [createEngine, startAnalysis]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && engineReadyRef.current) {
      startAnalysis(engine, fen);
    }

    return () => {
      const current = currentRequestRef.current;
      if (current?.fen === fen) {
        currentRequestRef.current = null;
        engineRef.current?.stop(current.requestId);
      }
    };
  }, [fen, startAnalysis]);

  const { positionFen: storedFen, ...state } = storedState;
  if (
    storedFen !== fen &&
    state.status !== "loading" &&
    state.status !== "error"
  ) {
    return { ...EMPTY_ANALYSIS, status: "analysing" };
  }

  return state;
}
