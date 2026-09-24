"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  buttonClasses,
  Card,
  Input,
  LevelFieldset,
  PrecisionOrderSelect,
  Select,
  Textarea,
} from "@/components/design-system";
import { BmSelector, type BmValue } from "@/components/leveling/bm-selector";
import type { ReadingDraftState } from "@/components/leveling/readings-table";
import { CloseVisitDialog } from "@/components/settlement/close-visit-dialog";
import { ReadingsTable } from "@/components/settlement/readings-table";
import {
  draftToPayload,
  importedToDraft,
  payloadToDraft,
  templateToDrafts,
  VisitBookEditor,
} from "@/components/settlement/visit-book-editor";
import {
  VisitImportDialog,
  type VisitImport,
} from "@/components/settlement/visit-import-dialog";
import {
  computeHistory,
  detectTrendDeviations,
  isPointActiveOn,
  pointInputOf,
} from "@/lib/calculations/settlement";
import {
  bookRowInputOf,
  buildBookTemplate,
  computeVisitBook,
  deriveControlElevations,
  type TemplateRow,
} from "@/lib/calculations/settlement-book";
import { samePointCode } from "@/lib/calculations/leveling";
import { formatDateOnly, formatTrendDeviation } from "@/lib/utils/format";
import { parseNumber } from "@/lib/utils/parse";
import { validateVisitBook } from "@/lib/validators/settlement-book";
import {
  closeVisitAction,
  saveVisitAction,
  type VisitPayload,
} from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import {
  CAPTURE_MODE_LABELS,
  CAPTURE_MODES,
  type BookRowPayload,
  type CaptureMode,
  type PointInput,
  type SettlementPoint,
  type SettlementVisit,
  type Thresholds,
  type VisitInput,
} from "@/types/settlement";
import type {
  LevelFields,
  PrecisionOrder,
  ReferencePoint,
} from "@/types/project";

interface VisitEditorProps {
  projectId: string;
  siteId: string;
  visit: SettlementVisit;
  /** Cotas ya guardadas de esta visita (modo directo), para precargar. */
  initialElevations: Record<string, number>;
  /** Libreta ya guardada de esta visita (Fase 18). */
  initialBook: BookRowPayload[];
  /** Secuencia de la libreta de la visita anterior, para la plantilla. */
  previousBook: TemplateRow[] | null;
  /** Catálogo de puntos de referencia del proyecto, para el BM de amarre. */
  referencePoints: ReferencePoint[];
  points: SettlementPoint[];
  /** Resto de visitas del lugar (con sus lecturas), para el histórico. */
  otherVisits: VisitInput[];
  /**
   * Orden de precisión de cada una de las otras visitas, por id. El aviso de
   * lectura fuera de tendencia (Fase 12) saca de él su margen; el de esta
   * visita es el que el usuario tiene seleccionado en la cabecera.
   */
  otherVisitOrders: Record<string, PrecisionOrder>;
  thresholds: Thresholds;
  /** Solo lectura si el lugar o la visita están cerrados. */
  disabled: boolean;
  /** El lugar está cerrado (además, o en vez de, la visita misma). */
  siteClosed: boolean;
  /** La vista de la visita, adonde se vuelve tras cerrarla. */
  viewHref: string;
  /** Abrir la importación al llegar: la visita se creó para importar. */
  openImport?: boolean;
}

interface HeaderState {
  date: string;
  operator: string;
  weatherConditions: string;
  /** Solo en modo directo: en libreta lo calcula la libreta. */
  closureErrorMm: string;
  notes: string;
  /** Orden de precisión declarado de la visita (ISO 17123-2 para el equipo). */
  precisionOrder: PrecisionOrder;
  level: LevelFields;
  captureMode: CaptureMode;
  /** BM de amarre: código y cota, como texto mientras se teclea. */
  amarre: BmValue;
}

function headerOf(visit: SettlementVisit): HeaderState {
  return {
    date: visit.date,
    operator: visit.operator ?? "",
    weatherConditions: visit.weather_conditions ?? "",
    closureErrorMm:
      visit.closure_error_mm === null ? "" : String(visit.closure_error_mm),
    notes: visit.notes ?? "",
    precisionOrder: visit.precision_order,
    level: {
      equipmentBrand: visit.equipment_brand ?? "",
      equipmentModel: visit.equipment_model ?? "",
      equipmentSerial: visit.equipment_serial ?? "",
      equipmentCalibrationDate: visit.equipment_calibration_date ?? "",
      levelType: visit.level_type ?? "",
      kmPrecisionMm:
        visit.km_precision_mm != null ? String(visit.km_precision_mm) : "",
    },
    captureMode: visit.capture_mode,
    amarre: {
      code: visit.reference_bm_code ?? "",
      elevation:
        visit.reference_bm_elevation == null
          ? ""
          : Number(visit.reference_bm_elevation).toFixed(4),
    },
  };
}

function rawElevationsOf(
  points: SettlementPoint[],
  initialElevations: Record<string, number>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const point of points) {
    const value = initialElevations[point.id];
    result[point.id] = value === undefined ? "" : String(value);
  }
  return result;
}

const CAPTURE_MODE_OPTIONS = CAPTURE_MODES.map((value) => ({
  value,
  label: CAPTURE_MODE_LABELS[value],
}));

/**
 * Editor de una visita: cabecera, libreta de nivelación (o cotas directas) y
 * las cotas de los puntos de control con el cálculo en vivo (Fase 18).
 *
 * Todo lo calculado se deriva en render con `useMemo`, no se guarda en
 * estado: la libreta, las cotas que salen de ella y el histórico son
 * funciones puras de lo que el usuario tecleó. El servidor repite el mismo
 * cálculo al guardar y es el que persiste.
 */
export function VisitEditor({
  projectId,
  siteId,
  visit,
  initialElevations,
  initialBook,
  previousBook,
  referencePoints,
  points,
  otherVisits,
  otherVisitOrders,
  thresholds,
  disabled,
  siteClosed,
  viewHref,
  openImport = false,
}: VisitEditorProps) {
  const router = useRouter();
  const pointInputs: PointInput[] = useMemo(() => points.map(pointInputOf), [points]);
  const pointCodes = useMemo(() => points.map((p) => p.code), [points]);

  const [header, setHeader] = useState<HeaderState>(() => headerOf(visit));
  const [rawElevations, setRawElevations] = useState<Record<string, string>>(
    () => rawElevationsOf(points, initialElevations),
  );
  // La libreta. Si la visita aún no tiene, se propone la plantilla (decisión
  // 16): la secuencia de la anterior o una desde el catálogo. No cuenta como
  // cambio sin guardar: es una propuesta, no un dato.
  const [bookRows, setBookRows] = useState<ReadingDraftState[]>(() => {
    if (initialBook.length > 0) return initialBook.map(payloadToDraft);
    if (visit.capture_mode !== "book") return [];
    return templateToDrafts(
      buildBookTemplate(previousBook, pointInputs, visit.date, visit.reference_bm_code ?? ""),
    );
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Cambios sin guardar. Mismo patrón que `polygonal-editor.tsx`: se vuelve
  // `true` con cualquier edición y `false` solo tras un guardado exitoso. El
  // diálogo de cierre lo usa para no permitir confirmar mientras haya cambios
  // sin guardar — cerrar sellaría los valores VIEJOS de la base, de forma
  // irreversible.
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isClosing, startCloseTransition] = useTransition();

  const isBaseline = visit.visit_number === 0;
  const isBook = header.captureMode === "book";

  // Fecha con la que se decide la vigencia de los puntos (Fase 11). Mientras
  // la fecha se teclea y aún no es válida, manda la guardada.
  const vigenciaDate = /^\d{4}-\d{2}-\d{2}$/.test(header.date)
    ? header.date
    : visit.date;

  // --- Libreta (Fase 18) -----------------------------------------------------
  const amarreElevation = parseNumber(header.amarre.elevation);
  const bookInputs = useMemo(
    () => bookRows.map((d) => bookRowInputOf(draftToPayload(d))),
    [bookRows],
  );
  const bookCheck = useMemo(
    () =>
      validateVisitBook(
        bookInputs,
        { code: header.amarre.code, elevation: amarreElevation },
        header.precisionOrder,
      ),
    [bookInputs, header.amarre.code, amarreElevation, header.precisionOrder],
  );
  const bookResult = useMemo(
    () =>
      isBook && bookInputs.length > 0 && amarreElevation != null
        ? computeVisitBook(bookInputs, amarreElevation, header.precisionOrder)
        : null,
    [isBook, bookInputs, amarreElevation, header.precisionOrder],
  );
  const derivation = useMemo(
    () =>
      bookResult
        ? deriveControlElevations(bookResult, pointInputs, vigenciaDate)
        : { readings: [], issues: [] },
    [bookResult, pointInputs, vigenciaDate],
  );

  // Cotas de la visita: las derivadas de la libreta o las tecleadas.
  const typedReadings = useMemo(
    () =>
      points
        .map((p) => ({ pointId: p.id, elevation: parseNumber(rawElevations[p.id] ?? "") }))
        .filter((r): r is { pointId: string; elevation: number } => r.elevation != null),
    [points, rawElevations],
  );
  const readings = useMemo(
    () =>
      isBook
        ? derivation.readings.map(({ pointId, elevation }) => ({ pointId, elevation }))
        : typedReadings,
    [isBook, derivation, typedReadings],
  );
  const displayedElevations: Record<string, string> = useMemo(
    () =>
      isBook
        ? Object.fromEntries(readings.map((r) => [r.pointId, r.elevation.toFixed(4)]))
        : rawElevations,
    [isBook, readings, rawElevations],
  );

  // Filas de la tabla de cotas (Fase 11): los puntos vigentes en la fecha de
  // la visita, más uno con cota aunque haya dejado de estarlo —p. ej. al mover
  // la fecha—, para que el error tenga dónde verse.
  const rowPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          isPointActiveOn(pointInputOf(p), vigenciaDate) ||
          (displayedElevations[p.id] ?? "").trim() !== "",
      ),
    [points, vigenciaDate, displayedElevations],
  );
  const notMeasured = points.filter((p) => !rowPoints.includes(p));

  const history = useMemo(() => {
    const candidate: VisitInput = {
      id: visit.id,
      visitNumber: visit.visit_number,
      date: header.date,
      readings,
    };
    return computeHistory(pointInputs, [...otherVisits, candidate], thresholds);
  }, [readings, header.date, otherVisits, pointInputs, thresholds, visit.id, visit.visit_number]);

  const computedVisit = history.visits.find((v) => v.visitId === visit.id);
  const computedByPoint: Record<string, (typeof history.visits)[number]["readings"][number] | undefined> = {};
  if (computedVisit) {
    for (const reading of computedVisit.readings) {
      computedByPoint[reading.pointId] = reading;
    }
  }

  // Lecturas fuera de tendencia (Fase 12), en vivo.
  const trendDeviations = useMemo(() => {
    const orders = new Map<string, PrecisionOrder>(Object.entries(otherVisitOrders));
    orders.set(visit.id, header.precisionOrder);
    return detectTrendDeviations(history.visits, orders).get(visit.id) ?? new Map();
  }, [history, otherVisitOrders, visit.id, header.precisionOrder]);
  const trendWarnings: Record<string, string> = {};
  for (const [pointId, deviation] of trendDeviations) {
    trendWarnings[pointId] = formatTrendDeviation(deviation);
  }
  const trendDeviationCodes = points
    .filter((p) => trendDeviations.has(p.id))
    .map((p) => p.code);

  const pointsMeasured = computedVisit?.readings.length ?? 0;
  const worstAlert = computedVisit?.worstAlert ?? "normal";

  // --- Cambios ---------------------------------------------------------------

  function touch() {
    setSaved(false);
    setDirty(true);
  }

  function updateHeader<K extends keyof HeaderState>(key: K, fieldValue: HeaderState[K]) {
    touch();
    setHeader((prev) => ({ ...prev, [key]: fieldValue }));
  }

  function setField(key: "date" | "operator" | "weatherConditions" | "closureErrorMm" | "notes") {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateHeader(key, event.target.value);
    };
  }

  function handleElevationChange(pointId: string, value: string) {
    touch();
    setRawElevations((prev) => ({ ...prev, [pointId]: value }));
  }

  function handleBookChange(next: ReadingDraftState[]) {
    touch();
    setBookRows(next);
  }

  /**
   * Cambiar el amarre arrastra la primera y la última fila de la libreta si
   * todavía eran el amarre anterior (o estaban vacías): el circuito arranca y
   * cierra en él, y teclearlo dos veces más es la forma de equivocarse.
   */
  function handleAmarreChange(next: BmValue) {
    const previous = header.amarre.code.trim();
    updateHeader("amarre", next);
    if (bookRows.length === 0 || next.code.trim() === previous) return;
    const follows = (code: string) =>
      code.trim() === "" || (previous !== "" && samePointCode(code, previous));
    setBookRows((rows) =>
      rows.map((r, i) =>
        (i === 0 || i === rows.length - 1) && follows(r.pointCode)
          ? { ...r, pointCode: next.code.trim() }
          : r,
      ),
    );
  }

  function handleModeChange(mode: CaptureMode) {
    updateHeader("captureMode", mode);
    if (mode === "book" && bookRows.length === 0) {
      setBookRows(
        templateToDrafts(
          buildBookTemplate(previousBook, pointInputs, vigenciaDate, header.amarre.code),
        ),
      );
    }
  }

  function handleImport(imported: VisitImport) {
    touch();
    setBookRows(imported.rows.map(importedToDraft));
    setHeader((prev) => ({
      ...prev,
      captureMode: "book",
      amarre: {
        code: imported.amarre.code,
        elevation:
          imported.amarre.elevation == null ? "" : imported.amarre.elevation.toFixed(4),
      },
      // El archivo es de un nivel digital (Fase 16, decisión 9).
      level: { ...prev.level, levelType: "digital" },
    }));
  }

  function handleSave() {
    setServerError(null);
    setSaved(false);

    const closureErrorMm = parseNumber(header.closureErrorMm);
    if (!isBook && header.closureErrorMm.trim() !== "" && closureErrorMm === null) {
      setServerError("El error de cierre debe ser un número.");
      return;
    }
    if (header.amarre.elevation.trim() !== "" && amarreElevation === null) {
      setServerError("La cota del BM de amarre debe ser un número.");
      return;
    }

    const payload: VisitPayload = {
      siteId,
      visitId: visit.id,
      date: header.date,
      operator: header.operator.trim() === "" ? null : header.operator.trim(),
      weatherConditions:
        header.weatherConditions.trim() === "" ? null : header.weatherConditions.trim(),
      closureErrorMm: isBook ? null : closureErrorMm,
      notes: header.notes.trim() === "" ? null : header.notes.trim(),
      precisionOrder: header.precisionOrder,
      equipmentBrand: header.level.equipmentBrand.trim() || null,
      equipmentModel: header.level.equipmentModel.trim() || null,
      equipmentSerial: header.level.equipmentSerial.trim() || null,
      equipmentCalibrationDate: header.level.equipmentCalibrationDate.trim() || null,
      levelType: header.level.levelType === "" ? null : header.level.levelType,
      kmPrecisionMm: parseNumber(header.level.kmPrecisionMm),
      captureMode: header.captureMode,
      referenceBm: { code: header.amarre.code.trim(), elevation: amarreElevation },
      book: isBook ? bookRows.map(draftToPayload) : [],
      readings: isBook ? [] : typedReadings,
    };

    startTransition(async () => {
      const response = await saveVisitAction(projectId, payload);
      if (response.ok) {
        setSaved(true);
        setDirty(false);
      } else {
        setServerError(response.error ?? "Ocurrió un error al guardar.");
      }
    });
  }

  function handleConfirmClose() {
    setCloseError(null);
    startCloseTransition(async () => {
      const response = await closeVisitAction(projectId, siteId, visit.id);
      if (response.ok) {
        setCloseDialogOpen(false);
        router.push(viewHref);
      } else {
        // No se cierra el modal: el error (p. ej. lecturas incompletas) hay
        // que verlo junto al resumen que se estaba confirmando.
        setCloseError(response.error ?? "No se pudo cerrar la visita.");
      }
    });
  }

  // Avisos del cambio de modo: lo que el guardado va a descartar.
  const discardsBook = !isBook && initialBook.length > 0;
  const replacesTyped =
    isBook && visit.capture_mode === "direct" && Object.keys(initialElevations).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={isBaseline ? "Visita 0 — Línea base" : `Visita ${visit.visit_number}`}
        actions={
          <Link href={viewHref} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Ver la visita
          </Link>
        }
      >
        {serverError && (
          <Alert variant="error" className="mb-4">
            {serverError}
          </Alert>
        )}
        {saved && !serverError && (
          <Alert variant="success" className="mb-4">
            Visita guardada.
          </Alert>
        )}
        {isBaseline && (
          <Alert variant="info" className="mb-4">
            Esta es la línea base del lugar: no tiene visita anterior, así que
            no muestra asentamiento parcial ni velocidad.
          </Alert>
        )}
        {siteClosed && (
          <Alert variant="info" className="mb-4">
            El lugar está cerrado; esta visita quedó en solo lectura.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Fecha" type="date" value={header.date} onChange={setField("date")} disabled={disabled} />
          <Input label="Nivelador" value={header.operator} onChange={setField("operator")} disabled={disabled} />
          <Input
            label="Condiciones climáticas"
            value={header.weatherConditions}
            onChange={setField("weatherConditions")}
            disabled={disabled}
          />
          <Select
            label="Captura de las cotas"
            options={CAPTURE_MODE_OPTIONS}
            value={header.captureMode}
            onChange={(e) => handleModeChange(e.target.value as CaptureMode)}
            disabled={disabled}
          />
          {!isBook && (
            <Input
              label="Error de cierre (mm)"
              type="number"
              step="any"
              value={header.closureErrorMm}
              onChange={setField("closureErrorMm")}
              disabled={disabled}
            />
          )}
        </div>
        {discardsBook && (
          <Alert variant="warning" className="mt-4">
            Al guardar en cotas directas se descarta la libreta de esta visita.
          </Alert>
        )}
        {replacesTyped && (
          <Alert variant="warning" className="mt-4">
            Al guardar con libreta, las cotas tecleadas se reemplazan por las
            que salen de la libreta.
          </Alert>
        )}
        <div className="mt-4 max-w-xl">
          <BmSelector
            label="BM de amarre"
            points={referencePoints.filter((p) => p.elevation != null)}
            value={header.amarre}
            onChange={handleAmarreChange}
            disabled={disabled}
          />
        </div>
        <div className="mt-4">
          <PrecisionOrderSelect
            kind="leveling"
            value={header.precisionOrder}
            disabled={disabled}
            onChange={(v) => updateHeader("precisionOrder", v)}
          />
        </div>
        <div className="mt-4">
          <LevelFieldset
            value={header.level}
            onChange={(v) => updateHeader("level", v)}
            order={header.precisionOrder}
            disabled={disabled}
          />
        </div>
        <div className="mt-4">
          <Textarea label="Notas" value={header.notes} onChange={setField("notes")} disabled={disabled} />
        </div>
      </Card>

      {isBook && (
        <VisitBookEditor
          rows={bookRows}
          onChange={handleBookChange}
          result={bookResult}
          rowIssues={bookCheck.rowIssues}
          errors={bookCheck.errors}
          derivationIssues={derivation.issues}
          levelType={header.level.levelType === "" ? null : header.level.levelType}
          disabled={disabled}
          pointCodes={pointCodes}
          amarreCode={header.amarre.code}
          importButton={
            <VisitImportDialog
              pointCodes={pointCodes}
              amarre={{ code: header.amarre.code, elevation: amarreElevation }}
              hasRows={bookRows.some((r) => r.backsight.trim() !== "" || r.foresight.trim() !== "")}
              onAccept={handleImport}
              disabled={disabled}
              defaultOpen={openImport}
            />
          }
        />
      )}

      <Card
        title={isBook ? "Cotas de los puntos de control" : "Lecturas"}
        description={isBook ? "Salen de la libreta: se recalculan al guardar." : undefined}
      >
        <ReadingsTable
          points={rowPoints}
          rawElevations={displayedElevations}
          onElevationChange={handleElevationChange}
          computedByPoint={computedByPoint}
          isBaseline={isBaseline}
          disabled={disabled}
          trendWarnings={trendWarnings}
          derived={isBook}
        />
        {notMeasured.length > 0 && (
          <p className="mt-3 text-sm text-neutral-500">
            No se miden en esta visita:{" "}
            {notMeasured
              .map((p) =>
                p.retired_on !== null
                  ? `${p.code} (de baja desde el ${formatDateOnly(p.retired_on)})`
                  : `${p.code} (alta el ${formatDateOnly(p.active_from ?? "")})`,
              )
              .join(", ")}
            .
          </p>
        )}
      </Card>

      {!disabled && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCloseError(null);
              setCloseDialogOpen(true);
            }}
            disabled={isPending}
          >
            Cerrar visita
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar visita"}
          </Button>
        </div>
      )}

      <CloseVisitDialog
        open={closeDialogOpen}
        onClose={() => setCloseDialogOpen(false)}
        onConfirm={handleConfirmClose}
        isPending={isClosing}
        error={closeError}
        visitDate={header.date}
        pointsMeasured={pointsMeasured}
        worstAlert={worstAlert}
        dirty={dirty}
        trendDeviationCodes={trendDeviationCodes}
        book={
          isBook && bookResult
            ? {
                closureErrorMm: bookResult.closureErrorMm,
                toleranceMm: bookResult.toleranceMm,
                meetsTolerance: bookResult.meetsTolerance,
                arithmeticCheckOk: bookResult.arithmeticCheckOk,
              }
            : null
        }
      />
    </div>
  );
}
