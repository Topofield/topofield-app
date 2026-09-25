// Contenido del proyecto de ejemplo que recibe cada usuario nuevo al confirmar
// su cuenta.
//
// Desde la Fase 21 son las CARTERAS DE CAMPO REALES con las que se validó el
// motor (`docs/carteras/`), no datos sintéticos: la TT4 con su fila de cierre,
// la Vivero ajustada por mínimos cuadrados y en sistema local para
// georreferenciar, El Verjón con ida y vuelta por los mismos puntos y el crudo
// de un nivel digital Leica. El control de asentamientos no tiene cartera real:
// usa la simulación del prototipo del usuario, Torre Alameda.
//
// Puro: sin Supabase. Los resultados que se persisten los calcula el motor en
// `crear-proyecto-demo.ts` y los `insertar-*.ts`, nunca se escriben aquí. Los
// datos de campo se leen de `carteras.ts`, `crudo-tramo2.ts` y
// `torre-alameda.ts`, la misma copia que usan el seed y los tests.

import { azimuthFromCoordinates, decimalToDms } from "@/lib/calculations/angles";
import { readLevelingFile, toLibreta } from "@/lib/import/leveling";
import type {
  AngleType,
  CorrectionMethod,
  PolygonalType,
} from "@/types/polygonal";
import type { LevelingType, PointType } from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";
import {
  CARTERA_TT4,
  CARTERA_VERJON,
  CARTERA_VIVERO,
  type Cartera,
  type LecturaCartera,
} from "./carteras";
import { CRUDO_TRAMO2 } from "./crudo-tramo2";
import {
  ALAMEDA_AMARRES,
  ALAMEDA_POINTS,
  alamedaVisits,
  type PuntoAlameda,
  type VisitaAlameda,
} from "./torre-alameda";

// ---------------------------------------------------------------------------
// Proyecto y catálogo
// ---------------------------------------------------------------------------

export const PROYECTO_DEMO = {
  name: "Proyecto de ejemplo",
  client: "Carteras de campo reales",
  location: "Bogotá",
  description:
    "Proyecto de muestra con carteras de campo reales: las poligonales TT4 y Sede Vivero, la nivelación de El Verjón y el crudo de un nivel digital Leica; el control de asentamientos es la simulación de Torre Alameda. Puede modificarlo o eliminarlo cuando quiera.",
  datum: "MAGNA-SIRGAS",
  projection: "Origen Bogotá",
} as const;

/** Un punto del catálogo de referencia del proyecto. */
export interface ReferenciaDemo {
  code: string;
  type: "bm" | "control";
  north?: number;
  east?: number;
  elevation?: number;
  description: string;
}

/**
 * Solo los puntos que la demo usa. Las carteras reales vienen de lugares
 * distintos y repiten códigos —la Vivero tiene D1 a D4 y El Verjón usa D1, D3
 * y D4 como BMs—, así que los BMs de El Verjón no entran: su nivelación arranca
 * en un BM de entrada libre. D1 y D3 son los vértices de la Vivero con los que
 * se georreferencia su versión en sistema local (Fase 15).
 */
export const REFERENCIAS_DEMO: ReferenciaDemo[] = [
  {
    code: CARTERA_TT4.referencePointCode,
    type: "control",
    north: CARTERA_TT4.referenceNorth,
    east: CARTERA_TT4.referenceEast,
    description: "Amarre de la poligonal V10 (cartera TT4)",
  },
  {
    code: CARTERA_VIVERO.referencePointCode,
    type: "control",
    north: CARTERA_VIVERO.referenceNorth,
    east: CARTERA_VIVERO.referenceEast,
    description: "Amarre de la poligonal Famarena (Sede Vivero)",
  },
  {
    code: "D1",
    type: "control",
    north: 100117.462,
    east: 101515.6333,
    description: "Vértice D1 de la Sede Vivero, para georreferenciar la versión en sistema local",
  },
  {
    code: "D3",
    type: "control",
    north: 100182.239,
    east: 101581.7814,
    description: "Vértice D3 de la Sede Vivero, para georreferenciar la versión en sistema local",
  },
  {
    code: "C10",
    type: "bm",
    elevation: 2541.7545,
    description: "BM de arranque y cierre del tramo 2 (crudo del nivel digital Leica)",
  },
  ...ALAMEDA_AMARRES.map((a) => ({
    code: a.code,
    type: a.type,
    north: a.north,
    east: a.east,
    elevation: a.elevation,
    description: a.description,
  })),
];

// ---------------------------------------------------------------------------
// Poligonales
// ---------------------------------------------------------------------------

/** Una estación del levantamiento. El ángulo va en grados, minutos y segundos. */
export interface EstacionDemo {
  code: string;
  angle?: [number, number, number];
  /** Solo en poligonales por deflexión. */
  dir?: "left" | "right";
  /** Distancia al punto siguiente. `null`/ausente en la última o en la fila de cierre. */
  distance?: number | null;
}

export interface ProcesoDemo {
  name: string;
  type: PolygonalType;
  angleType: AngleType;
  startPointCode: string;
  startNorth: number;
  startEast: number;
  startAz: [number, number, number];
  endPointCode?: string;
  endNorth?: number;
  endEast?: number;
  correctionMethod?: CorrectionMethod;
  /**
   * Amarre: con código hay orientación —la primera estación lleva el ángulo
   * de orientación—, como en la aplicación. `referenceFromCatalog` enlaza el
   * proceso con el punto del catálogo de ese código.
   */
  referencePointCode?: string;
  referenceFromCatalog?: boolean;
  /** La cartera cierra contra el amarre con una fila de cierre (TT4). */
  hasClosingRow?: boolean;
  /** Pesos del ajuste por mínimos cuadrados (Fase 14). */
  leastSquares?: {
    sigmaAngleSeconds: number;
    sigmaDistanceM: number;
    distanceMeasurements: number;
  };
  /** `closed` obliga al cierre diferido: ver `insertar-poligonal.ts`. */
  status: "calculated" | "closed";
  stations: EstacionDemo[];
  notes: string;
  // Orden de precisión y equipo (Fase 8): los declara cada proceso.
  precisionOrder: PrecisionOrder;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  angularPrecisionSeconds: number;
  distancePrecisionMm: number;
  distancePrecisionPpm: number;
}

// Las carteras no declaran su estación total. Se usa la misma que el seed para
// ellas: una Leica FlexLine TS06plus, coherente con tercer orden (5″ ≤ K=15″);
// 5″ es una de sus clases de catálogo y 1.5 mm + 2 ppm su EDM con prisma.
const EQUIPO_POLIGONAL = {
  precisionOrder: "tercer_orden",
  equipmentBrand: "Leica",
  equipmentModel: "TS06 Plus",
  equipmentSerial: "DEMO-0001",
  equipmentCalibrationDate: "2026-02-10",
  angularPrecisionSeconds: 5,
  distancePrecisionMm: 1.5,
  distancePrecisionPpm: 2,
} as const;

function dmsTuple(decimal: number): [number, number, number] {
  const { deg, min, sec } = decimalToDms(decimal);
  return [deg, min, sec];
}

/** Una cartera real como proceso: amarre y azimut desde sus coordenadas. */
function desdeCartera(cartera: Cartera): Omit<ProcesoDemo, "name" | "status" | "notes"> {
  return {
    type: "closed",
    angleType: cartera.angleType,
    startPointCode: cartera.startPointCode,
    startNorth: cartera.startNorth,
    startEast: cartera.startEast,
    startAz: dmsTuple(
      azimuthFromCoordinates(
        cartera.startNorth,
        cartera.startEast,
        cartera.referenceNorth,
        cartera.referenceEast,
      ),
    ),
    referencePointCode: cartera.referencePointCode,
    referenceFromCatalog: true,
    hasClosingRow: cartera.hasClosingRow,
    correctionMethod: "bowditch",
    stations: cartera.stations.map((st) => ({
      code: st.pointCode,
      angle: st.readings[0],
      distance: st.distance,
    })),
    ...EQUIPO_POLIGONAL,
  };
}

/**
 * Tres procesos con las dos carteras de poligonal. La TT4 nace cerrada: cumple
 * (12″ de error angular, 1:7045) y alimenta el informe de poligonal.
 */
export const PROCESOS_DEMO: ProcesoDemo[] = [
  {
    ...desdeCartera(CARTERA_TT4),
    name: "Poligonal V10 — cartera TT4",
    status: "closed",
    notes:
      "Cartera de campo real (docs/carteras/poligonales.xlsx). Seis vértices amarrados a TT4, con la fila de cierre de vuelta al amarre. Compensada por Bowditch.",
  },
  {
    ...desdeCartera(CARTERA_VIVERO),
    name: "Poligonal Famarena — Sede Vivero",
    correctionMethod: "least_squares",
    // Los pesos de la hoja de la universidad: 2″, 0.011 m, 2 mediciones.
    leastSquares: { sigmaAngleSeconds: 2, sigmaDistanceM: 0.011, distanceMeasurements: 2 },
    status: "calculated",
    notes:
      "Cartera de campo real de la Universidad Distrital, Sede Vivero (2021-11-04). Cierra contra el primer lado. Ajustada por mínimos cuadrados con los pesos de la hoja.",
  },
  {
    ...desdeCartera(CARTERA_VIVERO),
    name: "Poligonal Famarena — Sede Vivero — sistema local",
    // La misma cartera medida en un sistema local: arranque en (1000, 2000) y
    // azimut supuesto 0°. Conserva el código del amarre sin enlazarlo al
    // catálogo, como en el seed: el punto del catálogo está en coordenadas
    // reales y este proceso todavía no.
    startNorth: 1000,
    startEast: 2000,
    startAz: [0, 0, 0],
    referenceFromCatalog: false,
    status: "calculated",
    notes:
      "La cartera Vivero en sistema local, para georreferenciar con los vértices D1 y D3 del catálogo (Georreferenciar, en el editor).",
  },
];

// ---------------------------------------------------------------------------
// Nivelación
// ---------------------------------------------------------------------------

/** Una lectura de la libreta de nivelación. */
export interface LecturaNivelacionDemo {
  code: string;
  type: PointType;
  /** Vista más (V+): el hilo medio. */
  back?: number | null;
  /** Vista menos (V−): el hilo medio; en una radiación, su vista intermedia. */
  fore?: number | null;
  backUpperM?: number | null;
  backLowerM?: number | null;
  foreUpperM?: number | null;
  foreLowerM?: number | null;
  /** Distancia por visual, en metros. */
  backDistanceM?: number | null;
  foreDistanceM?: number | null;
}

export interface NivelacionDemo {
  name: string;
  type: LevelingType;
  startBmCode: string;
  startElevation: number;
  endBmCode?: string;
  endElevation?: number;
  status: "calculated" | "closed";
  precisionOrder: PrecisionOrder;
  /** Las carteras no siempre declaran su equipo: lo que no dicen va vacío. */
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  equipmentCalibrationDate: string | null;
  levelType: "automatico" | "digital";
  /** Desviación típica en mm por km de doble nivelación (ISO 17123-2). */
  kmPrecisionMm: number | null;
  forward: LecturaNivelacionDemo[];
  return?: LecturaNivelacionDemo[];
  notes: string;
}

const deCartera = (r: LecturaCartera): LecturaNivelacionDemo => ({
  code: r.code,
  type: r.type,
  back: r.backsight,
  fore: r.foresight,
  backDistanceM: r.backDistanceM,
  foreDistanceM: r.foreDistanceM,
});

/**
 * El Verjón: abierta de D1 a D4, con ida y vuelta por los mismos puntos. Queda
 * calculada: una abierta no cierra contra nada, y lo que enseña es la
 * discrepancia de la sección, los puntos homólogos y los avisos de equilibrado.
 * La hoja no declara el nivel; los tres hilos dicen que es automático.
 */
export const NIVELACION_VERJON: NivelacionDemo = {
  name: CARTERA_VERJON.name,
  type: "open",
  startBmCode: CARTERA_VERJON.startCode,
  startElevation: CARTERA_VERJON.startElevation,
  status: "calculated",
  precisionOrder: "tercer_orden",
  equipmentBrand: null,
  equipmentModel: null,
  equipmentSerial: null,
  equipmentCalibrationDate: null,
  levelType: "automatico",
  kmPrecisionMm: null,
  forward: CARTERA_VERJON.ida.map(deCartera),
  return: CARTERA_VERJON.vuelta.map(deCartera),
  notes:
    "Cartera de campo real (docs/carteras/TRABAJO NIVELACION EL VERJON-corregido.xlsx): nivelación y contranivelación por los mismos puntos, con nivel automático de tres hilos.",
};

/**
 * El tramo 2, leído del crudo del nivel digital Leica con el importador de la
 * Fase 16, como un solo recorrido: sale de C10 y vuelve a C10. Cierra en
 * −0.4 mm sobre 1.397 km y nace cerrada, para el informe de nivelación. El
 * archivo no declara el modelo del nivel: solo que es un digital Leica.
 */
export function nivelacionTramo2(): NivelacionDemo {
  const leido = readLevelingFile(CRUDO_TRAMO2);
  if (!leido.ok) throw new Error(`El crudo del tramo 2 no se pudo leer: ${leido.error}`);
  const { file } = leido;
  const filas = toLibreta(file, { kind: "single" }).forward;
  const inicio = file.startPoint;
  if (!inicio || inicio.elevation == null) {
    throw new Error("El crudo del tramo 2 no trae el punto de arranque con su cota.");
  }
  return {
    name: "Tramo 2 — crudo del nivel digital Leica",
    type: "closed",
    startBmCode: inicio.code,
    startElevation: inicio.elevation,
    status: "closed",
    precisionOrder: "tercer_orden",
    equipmentBrand: "Leica",
    equipmentModel: null,
    equipmentSerial: null,
    equipmentCalibrationDate: null,
    levelType: "digital",
    kmPrecisionMm: null,
    forward: filas.map((r) => ({
      code: r.pointCode,
      type: r.pointType,
      back: r.backsight,
      fore: r.foresight,
      backDistanceM: r.backDistanceM,
      foreDistanceM: r.foreDistanceM,
    })),
    notes:
      "Crudo nativo de un nivel digital Leica (docs/carteras/CRDUDO-TRAMO2.L), importado como un solo recorrido. El instrumento mide dos veces cada visual; la libreta guarda el promedio.",
  };
}

// ---------------------------------------------------------------------------
// Control de asentamientos
// ---------------------------------------------------------------------------

export interface AsentamientoDemo {
  name: string;
  description: string;
  precisionOrder: PrecisionOrder;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  levelType: "automatico" | "digital";
  kmPrecisionMm: number;
  points: PuntoAlameda[];
  /** Cotas, BM de amarre y cierre de la libreta de cada visita. */
  visits: VisitaAlameda[];
  notes: string;
}

/**
 * Torre Alameda, la simulación del prototipo: ocho puntos, catorce visitas con
 * libreta, BM-1 y BM-2 alternados y la visita 9 fuera de tolerancia. El mismo
 * nivel digital que el seed le asigna. Queda cerrada para su informe.
 */
export const ASENTAMIENTO_DEMO: AsentamientoDemo = {
  name: "Torre Alameda",
  description:
    "Torre de 14 niveles sobre suelo aluvial, con 8 puntos de control en columnas. Cada visita lleva su libreta de nivelación. Simulación del prototipo de control de asentamientos.",
  precisionOrder: "tercer_orden",
  equipmentBrand: "Trimble",
  equipmentModel: "DiNi 12",
  equipmentSerial: "TDN-2025-014",
  equipmentCalibrationDate: "2024-12-20",
  levelType: "digital",
  kmPrecisionMm: 1.0,
  points: ALAMEDA_POINTS,
  visits: alamedaVisits(),
  notes:
    "Lugar cerrado tras catorce visitas: su informe de asentamientos ya es reproducible.",
};
