// Contenido del proyecto de ejemplo que recibe cada usuario nuevo al confirmar
// su cuenta.
//
// Datos puros: sin Supabase, sin cálculo. Los resultados que se persisten los
// deriva `crear-proyecto-demo.ts` del motor real (`computePolygonal`), nunca se
// escriben a mano.
//
// Adaptados de los fixtures de `scripts/seed.mjs`, que están verificados a
// mano, pero con nombres presentables: los del seed son de depuración
// («Cuadrado con error 0.4 m (fixture clave)») y aquí los ve un usuario real.
//
// Cubre los tres módulos: poligonal (`PROCESOS_DEMO`), nivelación
// (`NIVELACION_DEMO`) y control de asentamientos (`ASENTAMIENTO_DEMO`). Uno de
// cada queda cerrado para alimentar los tres informes del proyecto de ejemplo.

import type {
  AngleType,
  CorrectionMethod,
  PolygonalType,
} from "@/types/polygonal";
import type { LevelingType, PointType } from "@/types/leveling";

/** Una estación del levantamiento. El ángulo va en grados, minutos y segundos. */
export interface EstacionDemo {
  code: string;
  angle?: [number, number, number];
  /** Solo en poligonales por deflexión. */
  dir?: "left" | "right";
  /** Distancia al punto siguiente. La última estación no la lleva. */
  distance?: number;
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
  /** `closed` obliga al cierre diferido: ver `crear-proyecto-demo.ts`. */
  status: "calculated" | "closed";
  stations: EstacionDemo[];
  notes: string;
}

export const PROYECTO_DEMO = {
  name: "Proyecto de ejemplo",
  client: "Cliente de ejemplo",
  location: "Bogotá",
  description:
    "Proyecto de muestra creado automáticamente para que pueda explorar TopoField. Puede modificarlo o eliminarlo cuando quiera.",
  // Tercer orden (1:5.000) es el caso didáctico habitual: exige lo suficiente
  // para que se vea la diferencia entre un cierre conforme y uno que no lo es.
  precisionOrder: "tercer_orden",
  datum: "MAGNA-SIRGAS",
  projection: "Origen Bogotá",
  // El proyecto exige los datos del equipo: son obligatorios en el esquema
  // porque un levantamiento sin instrumento identificado no es trazable.
  equipmentBrand: "Leica",
  equipmentModel: "TS06 Plus",
  equipmentSerial: "DEMO-0001",
  angularPrecisionSeconds: 5,
  linearPrecision: "3+2ppm",
  equipmentCalibrationDate: "2026-02-10",
} as const;

/**
 * Cuatro procesos, no los siete del seed: el objetivo es entender la
 * aplicación, no cubrir la matriz completa de métodos de corrección.
 *
 * Entre los cuatro se ve lo que distingue a TopoField: un cierre conforme, uno
 * que no alcanza la tolerancia, la verificación contra un punto conocido y el
 * caso sin verificación posible.
 */
export const PROCESOS_DEMO: ProcesoDemo[] = [
  {
    name: "Lote rectangular — cierre conforme",
    type: "closed",
    angleType: "internal",
    startPointCode: "A",
    startNorth: 1000,
    startEast: 1000,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    // Cerrada a propósito: es el trabajo que alimenta el informe de poligonal
    // del proyecto de ejemplo, y de paso le muestra al usuario nuevo cómo se ve
    // un proceso ya cerrado (inmutable, en solo lectura).
    status: "closed",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes:
      "Cuadrado de 100 m de lado que cierra exacto. El veredicto sale en verde: cumple la tolerancia de tercer orden.",
  },
  {
    name: "Lote rectangular — error de cierre",
    type: "closed",
    angleType: "internal",
    startPointCode: "A",
    startNorth: 1000,
    startEast: 1000,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100.4 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes:
      "El mismo lote, pero el primer lado se midió 40 cm más largo. El error de cierre da una precisión de 1:1001, que no alcanza el 1:5.000 exigido: el veredicto sale en rojo. Es el caso que conviene saber leer.",
  },
  {
    name: "Enlace entre puntos de control",
    type: "open_controlled",
    angleType: "deflection",
    startPointCode: "P1",
    startNorth: 1000,
    startEast: 1000,
    startAz: [90, 0, 0],
    endPointCode: "P3",
    endNorth: 950,
    // 1000 + 100·sen(90°) + 100·sen(120°) = 1186.6025403…, irracional. Se
    // guarda a 3 decimales, que es la precisión de coordenadas del proyecto:
    // el error residual (≈0.4 mm) es el de un dato de campo real, no un fallo.
    endEast: 1186.603,
    correctionMethod: "bowditch",
    status: "calculated",
    stations: [
      { code: "P1", distance: 100 },
      { code: "P2", angle: [30, 0, 0], dir: "right", distance: 100 },
      { code: "P3" },
    ],
    notes:
      "Arranca en un punto conocido apuntando al este, gira 30° a la derecha en P2 y llega a otro punto conocido. Al haber punto de llegada, el cierre se verifica contra sus coordenadas.",
  },
  {
    name: "Levantamiento de reconocimiento",
    type: "open_uncontrolled",
    angleType: "internal",
    startPointCode: "E1",
    startNorth: 1000,
    startEast: 1000,
    startAz: [150, 0, 0],
    status: "calculated",
    stations: [
      { code: "E1", distance: 45.8 },
      { code: "E2", angle: [175, 30, 0], distance: 62.3 },
      { code: "E3", angle: [192, 15, 0], distance: 38.5 },
      { code: "E4" },
    ],
    notes:
      "No regresa al punto de partida ni llega a uno conocido, así que no hay contra qué contrastar el resultado. La aplicación calcula las coordenadas pero avisa: «sin verificación de cierre».",
  },
];

// ---------------------------------------------------------------------------
// Nivelación
// ---------------------------------------------------------------------------

/** Una fila de la libreta de nivelación. */
export interface LecturaNivelacionDemo {
  code: string;
  type: PointType;
  /** Lectura atrás (L.At): abre la armada siguiente. */
  back?: number;
  /** Lectura adelante (L.Ad): cierra la armada vigente. */
  fore?: number;
  distanceM?: number;
  /** Distancia acumulada desde el origen, en km. */
  distanceAccumKm?: number;
}

export interface NivelacionDemo {
  name: string;
  type: LevelingType;
  startBmCode: string;
  startElevation: number;
  endBmCode?: string;
  endElevation?: number;
  /** Distancia del recorrido en un solo sentido, en km. */
  totalDistanceKm: number;
  forward: LecturaNivelacionDemo[];
  /** Recorrido de vuelta; el demo no lo usa. */
  return?: LecturaNivelacionDemo[];
  notes: string;
}

/**
 * Un solo circuito, cerrado a propósito para que alimente el informe de
 * nivelación del proyecto de ejemplo. Sale y vuelve al BM-1: error de cierre
 * −8.0 mm contra 11.4 mm de tolerancia (K=12·√0.9 km), así que es conforme.
 * Números verificados a mano; son los mismos de `scripts/seed.mjs`.
 */
export const NIVELACION_DEMO: NivelacionDemo = {
  name: "Nivelación de control — circuito cerrado",
  type: "closed",
  startBmCode: "BM-1",
  startElevation: 100.0,
  totalDistanceKm: 0.9,
  forward: [
    { code: "BM-1", type: "bm", back: 1.5, distanceAccumKm: 0.0 },
    { code: "PC-1", type: "pc", fore: 1.2, back: 2.0, distanceAccumKm: 0.3 },
    { code: "PC-2", type: "pc", fore: 2.5, back: 1.0, distanceAccumKm: 0.6 },
    { code: "BM-1", type: "bm", fore: 0.808, distanceAccumKm: 0.9 },
  ],
  notes:
    "Circuito cerrado que sale y regresa al BM-1. El error de cierre (−8 mm) queda dentro de la tolerancia de tercer orden: el resultado es conforme.",
};

// ---------------------------------------------------------------------------
// Control de asentamientos
// ---------------------------------------------------------------------------

export interface PuntoAsentamientoDemo {
  code: string;
  locationDescription: string;
  northing: number;
  easting: number;
  initialElevation: number;
}

export interface AsentamientoDemo {
  name: string;
  description: string;
  operator: string;
  equipment: string;
  points: PuntoAsentamientoDemo[];
  /** Fechas de las visitas (ISO). La 0 es la línea base. */
  visitDates: string[];
  /**
   * Asentamiento parcial mensual, en mm, por código de punto (visita 0 = 0).
   * Las cotas de cada visita se derivan restando el acumulado a la cota
   * inicial; nunca se escriben a mano. Igual estrategia que `scripts/seed.mjs`:
   * los parciales, acumulados, velocidad y nivel de alerta los calcula
   * `computeHistory`, no el fixture.
   */
  partialsMm: Record<string, number[]>;
  notes: string;
}

/**
 * Serie de consolidación sobre arcilla blanda: asentamiento rápido que
 * desacelera hasta converger. P-06 (esquina más cargada) llega a alarma y su
 * acumulado cruza a alerta; P-05 pasa por alerta; el resto queda en
 * precaución/normal — así el semáforo no sale todo verde. Los mismos números
 * verificados del seed.
 */
export const ASENTAMIENTO_DEMO: AsentamientoDemo = {
  name: "Edificio de ejemplo",
  description:
    "Edificio de 6 niveles sobre arcilla blanda, con 6 puntos de control en grilla.",
  operator: "Equipo de monitoreo",
  equipment: "Nivel automático Leica NA2",
  points: [
    { code: "P-01", locationDescription: "Esquina NW", northing: 2000.0, easting: 1000.0, initialElevation: 100.0 },
    { code: "P-02", locationDescription: "Esquina NE", northing: 2000.0, easting: 1030.0, initialElevation: 100.0 },
    { code: "P-03", locationDescription: "Centro", northing: 1985.0, easting: 1015.0, initialElevation: 100.0 },
    { code: "P-04", locationDescription: "Esquina SW", northing: 1970.0, easting: 1000.0, initialElevation: 100.0 },
    { code: "P-05", locationDescription: "Borde sur, intermedio", northing: 1970.0, easting: 1015.0, initialElevation: 100.0 },
    { code: "P-06", locationDescription: "Esquina SE (mayor carga)", northing: 1970.0, easting: 1030.0, initialElevation: 100.0 },
  ],
  visitDates: [
    "2025-01-15",
    "2025-02-15",
    "2025-03-15",
    "2025-04-15",
    "2025-05-15",
    "2025-06-15",
  ],
  partialsMm: {
    "P-01": [0, -3.5, -2.2, -1.4, -0.9, -0.5],
    "P-02": [0, -4.2, -2.6, -1.6, -1.0, -0.6],
    "P-03": [0, -3.8, -2.3, -1.3, -0.8, -0.5],
    "P-04": [0, -4.5, -2.8, -1.7, -1.1, -0.7],
    "P-05": [0, -9.0, -5.0, -3.0, -1.8, -1.0],
    "P-06": [0, -24.0, -13.0, -7.0, -4.0, -2.5],
  },
  notes:
    "Lugar cerrado tras seis visitas mensuales: su informe de asentamientos ya es reproducible.",
};
