"use client";

import type { ReactNode } from "react";
import { Alert, Card } from "@/components/design-system";
import {
  emptyReading,
  ReadingsTable,
  type ReadingDraftState,
} from "@/components/leveling/readings-table";
import { samePointCode } from "@/lib/calculations/leveling";
import type { TemplateRow } from "@/lib/calculations/settlement-book";
import type { LibretaRow } from "@/lib/import/leveling";
import { formatBookClosure } from "@/lib/utils/format";
import { parseNumber } from "@/lib/utils/parse";
import { benchmarkCheckMessage, bookIssueMessage } from "@/lib/validators/settlement-book";
import { turningPointBlocker, type ReadingCaptureIssues } from "@/lib/validators/leveling";
import type { LevelingResult } from "@/types/leveling";
import type { LevelType } from "@/types/project";
import type { BenchmarkCheck, BookIssue, BookRowPayload } from "@/types/settlement";

// --- Conversiones entre el borrador (texto) y la libreta (números) ----------

function str(value: number | null, decimals?: number): string {
  if (value == null) return "";
  return decimals == null ? String(value) : value.toFixed(decimals);
}

/** Una fila guardada como fila del borrador. */
export function payloadToDraft(r: BookRowPayload): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: r.pointCode,
    pointType: r.pointType,
    backsight: str(r.backsight),
    foresight: str(r.foresight),
    backUpperM: str(r.backUpperM),
    backLowerM: str(r.backLowerM),
    foreUpperM: str(r.foreUpperM),
    foreLowerM: str(r.foreLowerM),
    backDistanceM: str(r.backDistanceM),
    foreDistanceM: str(r.foreDistanceM),
  };
}

/** La plantilla (códigos y tipos, sin lecturas) como borrador. */
export function templateToDrafts(rows: TemplateRow[]): ReadingDraftState[] {
  return rows.map((r) => ({
    ...emptyReading(),
    pointCode: r.pointCode,
    pointType: r.pointType,
  }));
}

/** Una fila importada (Fase 16) como fila del borrador: sin hilos. */
export function importedToDraft(r: LibretaRow): ReadingDraftState {
  return {
    ...emptyReading(),
    pointCode: r.pointCode,
    pointType: r.pointType,
    backsight: str(r.backsight, 4),
    foresight: str(r.foresight, 4),
    backDistanceM: str(r.backDistanceM, 3),
    foreDistanceM: str(r.foreDistanceM, 3),
  };
}

export function draftToPayload(d: ReadingDraftState): BookRowPayload {
  return {
    pointCode: d.pointCode,
    pointType: d.pointType,
    backsight: parseNumber(d.backsight),
    foresight: parseNumber(d.foresight),
    backUpperM: parseNumber(d.backUpperM),
    backLowerM: parseNumber(d.backLowerM),
    foreUpperM: parseNumber(d.foreUpperM),
    foreLowerM: parseNumber(d.foreLowerM),
    backDistanceM: parseNumber(d.backDistanceM),
    foreDistanceM: parseNumber(d.foreDistanceM),
  };
}

// --- La sección -------------------------------------------------------------

interface VisitBookEditorProps {
  rows: ReadingDraftState[];
  onChange: (rows: ReadingDraftState[]) => void;
  /** La libreta calculada, o null si falta el amarre o no hay filas. */
  result: LevelingResult | null;
  rowIssues: ReadingCaptureIssues[];
  /** Errores de la libreta entera (el amarre). */
  errors: string[];
  /** Lo que encontró la derivación de cotas. */
  derivationIssues: BookIssue[];
  /** Los BM de control por los que pasa la libreta (Fase 30). */
  benchmarkChecks: BenchmarkCheck[];
  levelType: LevelType | null;
  disabled: boolean;
  /** Códigos del catálogo del lugar, para sugerir y para marcar las filas. */
  pointCodes: string[];
  amarreCode: string;
  /** El botón de importar (lo monta el editor, que recibe el resultado). */
  importButton: ReactNode;
}

/**
 * La libreta de nivelación de la visita (Fase 18): la tabla de captura de
 * nivelación —compartida, no copiada— y el resumen del cierre. Las cotas de
 * los puntos de control salen de aquí; el editor las muestra debajo.
 */
export function VisitBookEditor({
  rows,
  onChange,
  result,
  rowIssues,
  errors,
  derivationIssues,
  benchmarkChecks,
  levelType,
  disabled,
  pointCodes,
  amarreCode,
  importButton,
}: VisitBookEditorProps) {
  const amarre = amarreCode.trim();
  const suggestions = [...(amarre ? [amarre] : []), ...pointCodes];
  const rowNotes = rows.map((r, i) => {
    if (r.pointCode.trim() === "") return null;
    if (amarre && samePointCode(r.pointCode, amarre)) {
      return i === 0 || i === rows.length - 1 ? "BM de amarre" : null;
    }
    return pointCodes.some((c) => samePointCode(c, r.pointCode))
      ? "Punto de control"
      : null;
  });

  // Un punto de cambio incompleto dice qué fila corregir (Fase 24).
  const turningPoint = result ? turningPointBlocker(result) : null;
  const closure = result
    ? formatBookClosure(result.closureErrorMm, result.toleranceMm, result.meetsTolerance)
    : null;

  return (
    <Card
      title="Libreta de nivelación"
      description="Circuito cerrado sobre el BM de amarre. Las cotas de los puntos de control salen de sus vistas menos."
      actions={importButton}
    >
      <div className="flex flex-col gap-4">
        {errors.map((e) => (
          <Alert key={e} variant="error">
            {e}
          </Alert>
        ))}
        <ReadingsTable
          readings={rows}
          onChange={onChange}
          computed={result?.forward.readings ?? []}
          issues={rowIssues}
          disabled={disabled}
          levelType={levelType}
          codeSuggestions={suggestions}
          allowInsert
          rowNotes={rowNotes}
        />

        {result && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-2">Σ vistas más</dt>
              <dd className="font-mono tabular-nums">{result.sumBacksights.toFixed(4)}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Σ vistas menos</dt>
              <dd className="font-mono tabular-nums">{result.sumForesights.toFixed(4)}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Error de cierre</dt>
              <dd className="font-mono tabular-nums">{closure?.value}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Tolerancia</dt>
              <dd>{closure?.detail}</dd>
            </div>
          </dl>
        )}

        {result && (turningPoint || !result.arithmeticCheckOk) && (
          <Alert variant="error">
            {turningPoint ??
              "La comprobación aritmética no cuadra: ΣV+ − ΣV− no coincide con el desnivel. La visita no podrá cerrarse así."}
          </Alert>
        )}
        {closure?.status === "out" && (
          <Alert variant="warning">
            El cierre supera la tolerancia: las cotas no se compensan. Conviene
            revisar la libreta o repetir la nivelación.
          </Alert>
        )}
        {result && result.closureErrorMm != null && result.toleranceMm == null && (
          <Alert variant="warning">
            Sin distancias por visual no se evalúa la tolerancia ni se compensa
            el cierre.
          </Alert>
        )}
        {benchmarkChecks
          .filter((check) => check.meetsTolerance === false)
          .map((check) => (
            <Alert key={`bm-${check.rowIndex}`} variant="warning">
              {benchmarkCheckMessage(check, amarreCode)}
            </Alert>
          ))}
        {benchmarkChecks.some((check) => check.meetsTolerance !== false) && (
          <ul className="flex flex-col gap-1 text-sm text-ink-2">
            {benchmarkChecks
              .filter((check) => check.meetsTolerance !== false)
              .map((check) => (
                <li key={`bm-${check.rowIndex}`}>{benchmarkCheckMessage(check, amarreCode)}</li>
              ))}
          </ul>
        )}
        {derivationIssues.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {derivationIssues.map((issue) => (
              <li
                key={`${issue.kind}-${issue.pointId}`}
                className={issue.level === "error" ? "text-danger" : "text-warning"}
              >
                {bookIssueMessage(issue)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
