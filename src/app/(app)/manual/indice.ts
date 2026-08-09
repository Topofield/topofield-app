import type { SeccionManual } from "./manual-data";

export interface EntradaIndice {
  /** Ancla a la que navega el chip del índice. */
  href: string;
  label: string;
}

/**
 * Índice de anclas a partir de las secciones declaradas.
 *
 * Es función pura para poder probar lo único que aquí puede fallar en silencio:
 * dos secciones con el mismo `id` producen dos anclas iguales, que es HTML
 * válido pero navega siempre a la primera. No hay error, solo un enlace que
 * lleva al sitio equivocado.
 */
export function construirIndice(secciones: SeccionManual[]): EntradaIndice[] {
  return secciones.map((seccion) => ({
    href: `#${seccion.id}`,
    label: seccion.titulo,
  }));
}

/** Los `id` repetidos de una lista de secciones. Vacío si todos son únicos. */
export function idsDuplicados(secciones: SeccionManual[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const { id } of secciones) {
    if (vistos.has(id)) repetidos.add(id);
    vistos.add(id);
  }
  return [...repetidos];
}
