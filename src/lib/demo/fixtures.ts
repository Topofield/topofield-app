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
// Al implementar nivelación (fase 4) y asentamientos (fase 5), sus ejemplos se
// añaden aquí con la misma forma.

import type {
  AngleType,
  CorrectionMethod,
  PolygonalType,
} from "@/types/polygonal";

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
    status: "calculated",
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
