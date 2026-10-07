// Leer todas las filas de una consulta (revisión final de la Fase 37).
//
// PostgREST corta cada respuesta en `max_rows` (1000 en Supabase) sin avisar.
// Las libretas y las lecturas de un lugar lo superan pronto —60 visitas de 17
// filas—, y guardar una libreta mocha borraba sus filas de la base. Toda
// lectura de un lugar o un proyecto entero va por aquí.

import type { PostgrestError } from "@supabase/supabase-js";

export const PAGE_SIZE = 1000;

/**
 * Todas las filas, página a página. `page` arma la consulta —con un orden
 * estable— y le aplica `.range(from, to)`. Avanza por lo que llega, no por el
 * tamaño de la página: un `max_rows` menor no salta filas.
 */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const out: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: out, error };
    const rows = data ?? [];
    if (rows.length === 0) return { data: out, error: null };
    out.push(...rows);
    from += rows.length;
  }
}
