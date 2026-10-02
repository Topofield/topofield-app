// Torre Alameda: la simulación del prototipo de asentamientos
// (docs/prototipos/Control de asentamientos, Torre Alameda.html). No hay
// cartera real de asentamientos; esta serie es la del prototipo del usuario.
//
// Una sola copia para el seed y el proyecto de ejemplo (Fase 21). Datos puros y
// deterministas: las libretas se generan HACIA ATRÁS desde la serie con
// `generateVisitBook`, así que las cotas compensadas son las de la serie.
//
// Ocho puntos de control y dos BMs de amarre que se alternan. La visita 9 cierra
// fuera de tolerancia para mostrar el aviso: se guarda y se cierra igual, sin
// compensar.

export interface AmarreAlameda {
  code: string;
  /** Tipo en el catálogo de puntos de referencia del proyecto. */
  type: "bm";
  elevation: number;
  description: string;
}

export interface PuntoAlameda {
  code: string;
  locationDescription: string;
  /** Cota inicial C0. */
  c0: number;
  /** Asentamiento final de la serie, en mm (negativo = baja). */
  finalMm: number;
}

export interface VisitaAlameda {
  date: string;
  /** Cota de cada punto en la visita, a 4 decimales. */
  targets: { code: string; elevation: number }[];
  /** Error de cierre de la libreta, en mm (múltiplos de 0.1). */
  closureMm: number;
  amarre: AmarreAlameda;
  /**
   * El otro BM, por el que también pasa la libreta para comprobar que los dos
   * nivelan (Fase 30): su código y la cota que la libreta debe darle, que es la
   * del catálogo salvo en la visita `ALAMEDA_BM_FUERA`.
   */
  bmControl: { code: string; elevation: number };
  operator: string;
}

export const ALAMEDA_AMARRES: [AmarreAlameda, AmarreAlameda] = [
  { code: "BM-1", type: "bm", elevation: 100.0, description: "BM de amarre de Torre Alameda (andén norte)" },
  { code: "BM-2", type: "bm", elevation: 100.845, description: "BM de amarre alterno de Torre Alameda (portería)" },
];

export const ALAMEDA_POINTS: PuntoAlameda[] = [
  { code: "TA-01", locationDescription: "Columna A1", c0: 100.612, finalMm: -18 },
  { code: "TA-02", locationDescription: "Columna A2", c0: 100.587, finalMm: -22 },
  { code: "TA-03", locationDescription: "Columna A3", c0: 100.534, finalMm: -27 },
  { code: "TA-04", locationDescription: "Columna A4", c0: 100.498, finalMm: -19 },
  { code: "TA-05", locationDescription: "Columna B1", c0: 100.455, finalMm: -15 },
  { code: "TA-06", locationDescription: "Columna B2", c0: 100.521, finalMm: -24 },
  { code: "TA-07", locationDescription: "Columna B3 (núcleo)", c0: 100.566, finalMm: -31 },
  { code: "TA-08", locationDescription: "Columna B4", c0: 100.603, finalMm: -20 },
];

/** Días desde la lectura base: quincenal al principio, luego mensual. */
const ALAMEDA_DAYS = [0, 14, 28, 42, 56, 84, 112, 140, 168, 196, 224, 252, 280, 308];
const ALAMEDA_BASE = "2025-01-07";
/** Visitas que cierran en BM-2. */
const ALAMEDA_BM2 = new Set([5, 11]);
/** La visita que cierra fuera de tolerancia. */
export const ALAMEDA_OUT_OF_TOLERANCE = 9;
/**
 * La visita en que BM-2 ya no nivela con BM-1 (Fase 30): la libreta lo da
 * 8 mm por encima de su cota de catálogo. Es la última, abierta, así que no
 * cambia nada cerrado; sus puntos de control salen de BM-1, que no se movió.
 */
export const ALAMEDA_BM_FUERA = 13;

/** La serie de Torre Alameda: consolidación que se acelera con la carga (como el prototipo). */
export function alamedaVisits(): VisitaAlameda[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  return ALAMEDA_DAYS.map((day, i) => {
    const date = new Date(`${ALAMEDA_BASE}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + day);
    const load = Math.min(1, day / 210);
    const targets = ALAMEDA_POINTS.map((p) => {
      const mm =
        i === 0 ? 0 : p.finalMm * (1 - Math.exp(-day / 115)) * (0.55 + 0.45 * load) + rnd() * 0.8;
      return { code: p.code, elevation: Number((p.c0 + mm / 1000).toFixed(4)) };
    });
    const closureMm =
      i === ALAMEDA_OUT_OF_TOLERANCE ? 9.8 : Number((rnd() * 6).toFixed(1));
    const otro = ALAMEDA_AMARRES[ALAMEDA_BM2.has(i) ? 0 : 1];
    const desplazamientoM = i === ALAMEDA_BM_FUERA ? 0.008 : 0;
    return {
      date: date.toISOString().slice(0, 10),
      targets,
      closureMm,
      amarre: ALAMEDA_AMARRES[ALAMEDA_BM2.has(i) ? 1 : 0],
      bmControl: { code: otro.code, elevation: Number((otro.elevation + desplazamientoM).toFixed(4)) },
      operator: i % 2 === 0 ? "J. Rodríguez" : "L. Cárdenas",
    };
  });
}
