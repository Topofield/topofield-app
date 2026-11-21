// La poligonal del hero de la página de presentación (Fase 45).
//
// No son cifras escritas a mano: es la cartera TT4 del proyecto de ejemplo,
// pasada por el motor como la pasa la aplicación. Si cambia una regla del
// cálculo, la página cambia con ella.

import {
  computePolygonalDetected,
  polygonalTraces,
} from "@/lib/calculations/polygonal";
import { PROCESOS_DEMO } from "@/lib/demo/fixtures";
import { entradaDe } from "@/lib/demo/insertar-poligonal";
import type { PrecisionOrder } from "@/types/project";

export interface LadoEjemplo {
  desde: string;
  hasta: string;
  /** Azimut ya corregido angularmente, en grados decimales. */
  azimut: number;
  distancia: number;
}

export interface VerticeEjemplo {
  code: string;
  north: number;
  east: number;
}

export interface PoligonalEjemplo {
  lados: LadoEjemplo[];
  /** La ajustada, en orden; el último vértice repite el arranque. */
  vertices: VerticeEjemplo[];
  /** Segundos de arco. */
  errorAngular: number;
  /** Metros. */
  errorLineal: number;
  perimetro: number;
  /** El X de 1:X. */
  precision: number;
  orden: PrecisionOrder | null;
}

/** La poligonal V10 de la cartera TT4, calculada. `null` si el motor no cierra. */
export function poligonalEjemplo(): PoligonalEjemplo | null {
  const proceso = PROCESOS_DEMO[0];
  if (!proceso) return null;

  const entrada = entradaDe(proceso);
  const { result, order, angleType } = computePolygonalDetected(entrada);
  const trazas = polygonalTraces(
    { ...entrada, angleType, order: order ?? "ordinario" },
    result,
  );
  if (
    !trazas ||
    result.angularError == null ||
    result.linearError == null ||
    result.relativePrecision == null
  ) {
    return null;
  }

  const lados: LadoEjemplo[] = [];
  result.stations.forEach((estacion, i) => {
    const distancia = entrada.stations[i]?.distance;
    const siguiente = result.stations[i + 1];
    if (distancia == null || estacion.azimuth == null || !siguiente) return;
    lados.push({
      desde: estacion.pointCode,
      hasta: siguiente.pointCode,
      azimut: estacion.azimuth,
      distancia,
    });
  });

  return {
    lados,
    vertices: trazas.map((t) => ({ code: t.code, ...t.adjusted })),
    errorAngular: result.angularError,
    errorLineal: result.linearError,
    perimetro: result.perimeter,
    precision: result.relativePrecision,
    orden: order,
  };
}
