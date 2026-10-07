// Importar BM al lugar (Fase 37, decisión 12): de las cotas ajustadas de una
// nivelación del proyecto o de un CSV. Funciones puras: sin React ni Supabase.

import { samePointCode } from "@/lib/calculations/leveling";

/** Un BM por importar al lugar, con su origen. */
export interface ImportedBenchmark {
  code: string;
  elevation: number;
  description: string | null;
  source: string | null;
}

/** Los puntos de una nivelación, como BM: código y cota ajustada, con su origen. */
export function benchmarksFromLeveling(
  adjusted: readonly { pointCode: string; elevation: number }[],
  source: string,
): ImportedBenchmark[] {
  return adjusted.map((a) => ({
    code: a.pointCode.trim(),
    elevation: Number(a.elevation.toFixed(4)),
    description: null,
    source,
  }));
}

/** Un número con coma o punto decimal; null si no lo es. */
function decimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || !/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Lee un CSV de BM: la cabecera `codigo,cota,descripcion` (la descripción es
 * opcional), separado por coma o punto y coma —con punto y coma, la cota
 * admite coma decimal—. Las filas vacías se saltan; una cota que no es número
 * o un código repetido es error con su línea.
 */
export function parseBenchmarkCsv(
  text: string,
): { items: { code: string; elevation: number; description: string | null }[] } | { error: string } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const header = lines[0] ?? "";
  const separator = header.includes(";") ? ";" : ",";
  const items: { code: string; elevation: number; description: string | null }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const [rawCode = "", rawElevation = "", ...rest] = line.split(separator);
    const code = rawCode.trim();
    if (code === "") return { error: `Línea ${i + 1}: falta el código del BM.` };
    const elevation = decimal(rawElevation);
    if (elevation === null) return { error: `Línea ${i + 1}: la cota de ${code} no es un número.` };
    if (items.some((it) => samePointCode(it.code, code))) {
      return { error: `Línea ${i + 1}: ${items.find((it) => samePointCode(it.code, code))!.code} está repetido.` };
    }
    const description = rest.join(separator).trim();
    items.push({ code, elevation: Number(elevation.toFixed(4)), description: description === "" ? null : description });
  }
  if (items.length === 0) return { error: "El archivo no tiene BM: revisa que tenga la cabecera y una fila por BM." };
  return { items };
}
