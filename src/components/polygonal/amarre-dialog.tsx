"use client";

import { useState, useTransition } from "react";
import { Alert, Button, EMPTY_DMS, Input, Modal, NumberInput, Select, type DmsValue } from "@/components/design-system";
import { ensureCatalogPointAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { azimuthFromCoordinates } from "@/lib/calculations/angles";
import { formatCoordinate } from "@/lib/utils/format";
import { parseNumber } from "@/lib/utils/parse";
import { readingDmsError } from "@/lib/validators/polygonal";
import { cn } from "@/lib/utils/cn";
import type { ReferencePoint } from "@/types/project";
import type { AngleInputFormat } from "@/types/polygonal";
import { AngleInput } from "./angle-input";
import { dmsFromFields, fieldsOf, formatAngle } from "./angle-format";
import { azimuthToReference, type AmarreEdit, type Dms3, type PolygonalDraft } from "./polygonal-save";

import { callAction } from "@/lib/errors/action-call";
/** Cómo se pone el 0 atrás. */
type ReferenceMode = "point" | "azimuth" | "none";

const REFERENCE_MODES: { value: ReferenceMode; label: string }[] = [
  { value: "point", label: "Punto con coordenadas" },
  { value: "azimuth", label: "Solo el azimut" },
  { value: "none", label: "Sin 0 atrás" },
];

interface PointFields {
  code: string;
  north: string;
  east: string;
}

const text = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "" : String(v));

interface AmarreDialogProps {
  projectId: string;
  draft: PolygonalDraft;
  referencePoints: ReferencePoint[];
  angleFormat: AngleInputFormat;
  onSave: (next: PolygonalDraft) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

/** Un punto con su «Tomar del catálogo»: los del proyecto con coordenadas. */
function PointInputs({
  legend,
  value,
  onChange,
  catalog,
}: {
  legend: string;
  value: PointFields;
  onChange: (v: PointFields) => void;
  catalog: ReferencePoint[];
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-rule p-3">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {catalog.length > 0 && (
        <Select
          label="Tomar del catálogo"
          placeholder="Elegir un punto…"
          value=""
          options={catalog.map((p) => ({
            value: p.id,
            label: `${p.code} · N ${formatCoordinate(p.north)} · E ${formatCoordinate(p.east)}`,
          }))}
          onChange={(e) => {
            const p = catalog.find((c) => c.id === e.target.value);
            if (p) onChange({ code: p.code, north: text(Number(p.north)), east: text(Number(p.east)) });
          }}
        />
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input label="Nombre" value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value })} />
        <NumberInput label="Norte" value={value.north} onChange={(e) => onChange({ ...value, north: e.target.value })} />
        <NumberInput label="Este" value={value.east} onChange={(e) => onChange({ ...value, east: e.target.value })} />
      </div>
    </fieldset>
  );
}

function readPoint(p: PointFields, what: string): { code: string; north: number; east: number } | string {
  const code = p.code.trim();
  if (code === "") return `${what}: falta el nombre.`;
  const north = parseNumber(p.north);
  const east = parseNumber(p.east);
  if (north === null || east === null) return `${what}: el Norte y el Este son obligatorios.`;
  return { code, north, east };
}

function readAzimuth(v: DmsValue, what: string): Dms3 | string {
  const dms = dmsFromFields(v);
  if (dms === null) return `${what}: falta el azimut.`;
  const problem = readingDmsError(dms);
  return problem ? `${what}: ${problem}` : dms;
}

/**
 * Los puntos de amarre (Fase 35, maqueta «Datos A»): la estación de partida y la
 * referencia del 0 atrás, cada una con «Tomar del catálogo»; la referencia
 * admite solo el azimut. En la abierta con control, la llegada. Al guardar, los
 * puntos con coordenadas van al catálogo del proyecto (decisión 9).
 */
export function AmarreDialog({ projectId, draft, referencePoints, angleFormat, onSave, onClose }: AmarreDialogProps) {
  const a = draft.amarre;
  const controlled = draft.details.type === "open_controlled";
  const catalog = referencePoints.filter((p) => p.north !== null && p.east !== null);
  const currentRef = referencePoints.find((p) => p.id === a.referencePointId) ?? null;

  const [start, setStart] = useState<PointFields>({
    code: a.startCode,
    north: a.startCode ? text(a.startNorth) : "",
    east: a.startCode ? text(a.startEast) : "",
  });
  const [mode, setMode] = useState<ReferenceMode>(
    a.referencePointId !== null ? "point" : a.referenceCode !== null ? "azimuth" : a.startCode ? "none" : "point",
  );
  const [reference, setReference] = useState<PointFields>({
    code: currentRef?.code ?? a.referenceCode ?? "",
    north: text(currentRef?.north == null ? null : Number(currentRef.north)),
    east: text(currentRef?.east == null ? null : Number(currentRef.east)),
  });
  const [azimuth, setAzimuth] = useState<DmsValue>(a.startAzimuth ? fieldsOf(a.startAzimuth) : { ...EMPTY_DMS });
  const [end, setEnd] = useState<PointFields>({
    code: a.endCode ?? "",
    north: text(a.endNorth),
    east: text(a.endEast),
  });
  const [endAzimuth, setEndAzimuth] = useState<DmsValue>(a.endAzimuth ? fieldsOf(a.endAzimuth) : { ...EMPTY_DMS });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El azimut calculado, de la estación de partida a la referencia.
  const s = readPoint(start, "");
  const r = readPoint(reference, "");
  const computed =
    mode === "point" && typeof s !== "string" && typeof r !== "string" && (s.north !== r.north || s.east !== r.east)
      ? azimuthFromCoordinates(s.north, s.east, r.north, r.east)
      : null;
  const measured = draft.stations.some((st) => st.readings.length > 0 || st.distance !== null);

  function submit() {
    setError(null);
    const startPoint = readPoint(start, "Estación de partida");
    if (typeof startPoint === "string") return setError(startPoint);

    let refPoint: { code: string; north: number; east: number } | null = null;
    let refCode: string | null = null;
    let startAzimuth: Dms3;
    if (mode === "point") {
      const p = readPoint(reference, "Referencia");
      if (typeof p === "string") return setError(p);
      if (p.north === startPoint.north && p.east === startPoint.east) {
        return setError("La referencia no puede estar en el mismo sitio que la estación de partida.");
      }
      refPoint = p;
      startAzimuth = azimuthToReference({ startNorth: startPoint.north, startEast: startPoint.east }, p);
    } else {
      const az = readAzimuth(azimuth, mode === "azimuth" ? "Azimut a la referencia" : "Azimut del primer lado");
      if (typeof az === "string") return setError(az);
      startAzimuth = az;
      if (mode === "azimuth") {
        refCode = reference.code.trim();
        if (refCode === "") return setError("Referencia: falta el nombre.");
      }
    }

    let endPoint: { code: string; north: number; east: number } | null = null;
    let endAz: Dms3 | null = null;
    if (controlled) {
      const p = readPoint(end, "Llegada");
      if (typeof p === "string") return setError(p);
      endPoint = p;
      if ([endAzimuth.deg, endAzimuth.min, endAzimuth.sec].some((v) => v.trim() !== "")) {
        const az = readAzimuth(endAzimuth, "Azimut de llegada");
        if (typeof az === "string") return setError(az);
        endAz = az;
      }
    }

    startTransition(async () => {
      // Sin 0 atrás la partida puede ser local: solo el amarre va al catálogo.
      if (mode !== "none") {
        const saved = await callAction(() => ensureCatalogPointAction(projectId, startPoint));
        if (!saved.ok) return setError(saved.error);
      }
      let referencePointId: string | null = null;
      if (refPoint) {
        const saved = await callAction(() => ensureCatalogPointAction(projectId, refPoint!));
        if (!saved.ok) return setError(saved.error);
        referencePointId = saved.id;
      }
      if (endPoint) {
        const saved = await callAction(() => ensureCatalogPointAction(projectId, endPoint!));
        if (!saved.ok) return setError(saved.error);
      }
      const amarre: AmarreEdit = {
        startCode: startPoint.code,
        startNorth: startPoint.north,
        startEast: startPoint.east,
        referencePointId,
        referenceCode: refCode,
        startAzimuth,
        endCode: endPoint?.code ?? null,
        endNorth: endPoint?.north ?? null,
        endEast: endPoint?.east ?? null,
        endAzimuth: endAz,
        hasClosingRow: mode !== "none" && a.hasClosingRow,
      };
      // La estación de partida se renombra con el amarre; y la de vuelta, si ya cerró.
      const stations = draft.stations.map((st, i) =>
        st.pointCode === a.startCode && (i === 0 || i === draft.stations.length - 1)
          ? { ...st, pointCode: startPoint.code }
          : st,
      );
      const response = await onSave({ ...draft, amarre, stations });
      if (response.ok) onClose();
      else setError(response.error ?? "No se pudo guardar el amarre.");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Puntos de amarre"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar el amarre"}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        <PointInputs legend="Estación de partida" value={start} onChange={setStart} catalog={catalog} />

        <fieldset className="flex flex-col gap-3 rounded-md border border-rule p-3">
          <legend className="px-1 text-sm font-semibold">Referencia · 0° atrás</legend>
          <div role="radiogroup" aria-label="Cómo se da la referencia" className="grid grid-cols-3 overflow-hidden rounded-md border border-rule-strong">
            {REFERENCE_MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center border-r border-rule px-2 text-center text-sm font-medium last:border-r-0",
                  mode === m.value ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                )}
              >
                <input
                  type="radio"
                  name="modo-referencia"
                  className="sr-only"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                {m.label}
              </label>
            ))}
          </div>
          {mode === "point" && (
            <>
              <PointInputs legend="Punto de referencia" value={reference} onChange={setReference} catalog={catalog} />
              <p className="text-sm text-ink-2">
                Azimut {start.code.trim() || "partida"} → {reference.code.trim() || "referencia"}:{" "}
                <span className="font-semibold text-ink">{formatAngle(computed, angleFormat)}</span>
              </p>
            </>
          )}
          {mode === "azimuth" && (
            <>
              <p className="text-sm text-ink-2">No tengo sus coordenadas: doy el azimut de la estación de partida a la referencia.</p>
              <Input
                label="Nombre de la referencia"
                value={reference.code}
                onChange={(e) => setReference({ ...reference, code: e.target.value })}
              />
              <AngleInput label="Azimut a la referencia" value={azimuth} onChange={setAzimuth} format={angleFormat} />
            </>
          )}
          {mode === "none" && (
            <>
              <p className="text-sm text-ink-2">
                Sin referencia, la primera medición no lleva ángulo: el primer lado sale con este azimut.
              </p>
              <AngleInput label="Azimut del primer lado" value={azimuth} onChange={setAzimuth} format={angleFormat} />
            </>
          )}
        </fieldset>

        {controlled && (
          <fieldset className="flex flex-col gap-3 rounded-md border border-rule p-3">
            <legend className="px-1 text-sm font-semibold">Llegada</legend>
            <PointInputs legend="Punto de llegada" value={end} onChange={setEnd} catalog={catalog} />
            <AngleInput label="Azimut de llegada (opcional)" value={endAzimuth} onChange={setEndAzimuth} format={angleFormat} />
            <p className="text-sm text-ink-2">Con el azimut de llegada se comprueba también el cierre angular.</p>
          </fieldset>
        )}

        {measured && (
          <Alert variant="warning">Ya hay mediciones: cambiar el amarre recalcula la poligonal con ellas.</Alert>
        )}
      </form>
    </Modal>
  );
}
