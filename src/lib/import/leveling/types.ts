// Forma intermedia de la importación de libretas de nivelación (Fase 16).
// Todos los lectores desembocan aquí, y de aquí a la libreta hay un solo
// camino (`to-libreta.ts`). Añadir un instrumento es escribir un lector.

import type { PointType } from "@/types/leveling";

/** Una visual, ya promediada si el instrumento la repitió. */
export interface Sight {
  point: string;
  /** Lectura de mira, en metros, a la resolución de su columna (0.1 mm). */
  reading: number;
  /** Distancia a la mira, en metros (1 mm), o null si el archivo no la trae. */
  distance: number | null;
}

/**
 * Una armada: la visual atrás y las visuales adelante, en el orden medido.
 * La última adelante es la del punto de cambio; las anteriores, radiaciones.
 */
export interface Setup {
  back: Sight;
  fores: Sight[];
}

export type ImportFormat = "leica-l" | "topofield-csv";

export interface ImportedLevelingFile {
  format: ImportFormat;
  /** Punto y cota de partida, si el archivo los declara. */
  startPoint: { code: string; elevation: number | null } | null;
  setups: Setup[];
  /** Visuales leídas antes de promediar repeticiones. */
  rawSights: number;
  quality: {
    /** Mayor diferencia entre repeticiones de una misma visual, en mm. */
    maxRepeatSpreadMm: number | null;
    /** Mayor desviación típica que declara el instrumento, en mm. */
    maxSigmaMm: number | null;
  };
  /** Resumen que calcula el propio instrumento, solo para mostrar. */
  instrumentSummary: { heightDifference: number; distance: number } | null;
  /**
   * La plantilla CSV trae la división ida/vuelta y los tipos de punto: la
   * armada donde empieza la vuelta (1-based) y los tipos por fila de cada
   * recorrido. El `.L` no trae ninguno de los dos.
   */
  declared: {
    turnSetup: number | null;
    forwardTypes: (PointType | null)[];
    returnTypes: (PointType | null)[];
  } | null;
  warnings: string[];
}

export type ReadResult =
  | { ok: true; file: ImportedLevelingFile }
  | { ok: false; error: string };

/** Una fila de libreta, lista para el editor. */
export interface LibretaRow {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  backDistanceM: number | null;
  foreDistanceM: number | null;
}
