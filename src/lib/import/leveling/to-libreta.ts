// De la forma intermedia a filas de libreta (Fase 16). Un solo camino para
// todos los formatos. Puro.

import type { LevelingType, PointType } from "@/types/leveling";
import type { ImportedLevelingFile, LibretaRow, Setup } from "./types";

/**
 * Cómo se lee el recorrido: uno solo, o ida y vuelta partiendo en la armada
 * `turnSetup` (1-based: la primera armada de la vuelta). El archivo no lo
 * dice; lo elige el usuario (PRD de la Fase 16, decisión 2).
 */
export type ImportMode = { kind: "single" } | { kind: "split"; turnSetup: number };

/**
 * La armada donde el recorrido empieza a volver sobre sus puntos: su visual
 * adelante es el punto desde el que se miró atrás en la armada anterior. En
 * el crudo, la 9 (C18 → C17 después de C17 → C18). `null` si no vuelve.
 */
export function detectTurnSetup(file: ImportedLevelingFile): number | null {
  if (file.declared?.turnSetup != null) return file.declared.turnSetup;
  const s = file.setups;
  for (let k = 1; k < s.length; k++) {
    const fore = s[k]!.fores.at(-1)!.point;
    if (fore === s[k - 1]!.back.point) return k + 1;
  }
  return null;
}

/**
 * Filas de un recorrido. La V− del punto de cambio y la V+ de la armada
 * siguiente van en la misma fila, como en la cartera. Tipos deducidos: la
 * primera y la última fila son BM; con V+ y V−, punto de cambio; solo con V−,
 * radiación. Los declarados por el archivo (la plantilla CSV) mandan.
 */
function runRows(setups: Setup[], declared: (PointType | null)[] | undefined): LibretaRow[] {
  const rows: LibretaRow[] = [];
  setups.forEach((s, i) => {
    const prev = rows.at(-1);
    if (i > 0 && prev && prev.pointCode === s.back.point && prev.backsight == null) {
      prev.backsight = s.back.reading;
      prev.backDistanceM = s.back.distance;
    } else {
      rows.push({
        pointCode: s.back.point,
        pointType: "pc",
        backsight: s.back.reading,
        foresight: null,
        backDistanceM: s.back.distance,
        foreDistanceM: null,
      });
    }
    for (const f of s.fores) {
      rows.push({
        pointCode: f.point,
        pointType: "pc",
        backsight: null,
        foresight: f.reading,
        backDistanceM: null,
        foreDistanceM: f.distance,
      });
    }
  });
  const last = rows.length - 1;
  return rows.map((r, i) => ({
    ...r,
    pointType:
      declared?.[i] ??
      (i === 0 || i === last
        ? "bm"
        : r.backsight != null
          ? "pc"
          : "intermediate"),
  }));
}

export function toLibreta(
  file: ImportedLevelingFile,
  mode: ImportMode,
): { forward: LibretaRow[]; return: LibretaRow[] | null } {
  if (mode.kind === "single") {
    // Un solo recorrido: los tipos declarados por la plantilla solo valen si
    // el archivo no traía vuelta.
    const declared =
      file.declared && file.declared.returnTypes.length === 0 ? file.declared.forwardTypes : undefined;
    return { forward: runRows(file.setups, declared), return: null };
  }
  const cut = Math.min(Math.max(mode.turnSetup - 1, 1), file.setups.length - 1);
  const sameSplit = file.declared?.turnSetup === mode.turnSetup;
  return {
    forward: runRows(file.setups.slice(0, cut), sameSplit ? file.declared!.forwardTypes : undefined),
    return: runRows(file.setups.slice(cut), sameSplit ? file.declared!.returnTypes : undefined),
  };
}

/**
 * Tipo de proceso que se propone: un recorrido que vuelve a su punto de
 * partida es `closed`; ida y vuelta es `open` con vuelta —como `closed`, el
 * motor cerraría la ida contra la cota de partida y fallaría por el desnivel
 * entero—, o `link` si ya lo era (la ida llega a un BM conocido). Un
 * recorrido que termina en otro punto conserva `link`, y si no, `open`.
 */
export function proposedLevelingType(
  rows: { forward: LibretaRow[]; return: LibretaRow[] | null },
  current: LevelingType,
): LevelingType {
  if (rows.return) return current === "link" ? "link" : "open";
  const first = rows.forward[0]?.pointCode;
  const last = rows.forward.at(-1)?.pointCode;
  if (first != null && first === last) return "closed";
  return current === "link" ? "link" : "open";
}
