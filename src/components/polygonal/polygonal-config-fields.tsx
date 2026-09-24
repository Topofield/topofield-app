import {
  EMPTY_DMS,
  Input,
  PrecisionOrderSelect,
  Select,
  TotalStationFieldset,
  type DmsValue,
} from "@/components/design-system";
import {
  azimuthFromCoordinates,
  decimalToDms,
} from "@/lib/calculations/angles";
import {
  CLOSED_ANGLE_TYPE_OPTIONS,
  POLYGONAL_TYPE_OPTIONS,
  type AngleType,
  type PolygonalType,
} from "@/types/polygonal";
import {
  EMPTY_TOTAL_STATION,
  type PrecisionOrder,
  type ReferencePoint,
  type TotalStationFields,
} from "@/types/project";
import { AngleInput } from "./angle-input";
import type { AngleInputFormat } from "@/types/polygonal";

/** Estado de UI de la configuración de un proceso poligonal (todo texto). */
export interface PolygonalConfigState {
  name: string;
  type: PolygonalType;
  /** "" mientras el usuario no elige: el selector no preselecciona. */
  angleType: AngleType | "";
  /** Punto de amarre del catálogo. "" = amarre manual o sin amarre. */
  referencePointId: string;
  /** Código del amarre cuando no está en el catálogo. */
  referencePointCode: string;
  /** La cartera cierra contra el amarre: última fila sin distancia. */
  hasClosingRow: boolean;
  angleReadingsMin: string;
  startPointCode: string;
  startNorth: string;
  startEast: string;
  startAzimuth: DmsValue;
  endPointCode: string;
  endNorth: string;
  endEast: string;
  endAzimuth: DmsValue;
  /** Orden de precisión del proceso (ISO 17123-3 y -4 para el equipo). */
  precisionOrder: PrecisionOrder;
  totalStation: TotalStationFields;
}

export const EMPTY_POLYGONAL_CONFIG: PolygonalConfigState = {
  name: "",
  type: "closed",
  angleType: "",
  referencePointId: "",
  referencePointCode: "",
  hasClosingRow: false,
  angleReadingsMin: "3",
  startPointCode: "",
  startNorth: "1000",
  startEast: "1000",
  startAzimuth: EMPTY_DMS,
  endPointCode: "",
  endNorth: "",
  endEast: "",
  endAzimuth: EMPTY_DMS,
  // Mismo valor por defecto que la columna en la base (§ Task 2).
  precisionOrder: "tercer_orden",
  totalStation: EMPTY_TOTAL_STATION,
};

interface PolygonalConfigFieldsProps {
  value: PolygonalConfigState;
  onChange: (value: PolygonalConfigState) => void;
  /** Catálogo del proyecto, para elegir el punto de amarre. */
  referencePoints?: ReferencePoint[];
  disabled?: boolean;
  /** Formato de captura de los ángulos (Fase 13, P1). */
  angleFormat: AngleInputFormat;
}

/**
 * Azimut calculado del arranque hacia el punto de amarre elegido, o `null` si
 * no hay amarre del catálogo o faltan coordenadas.
 *
 * El amarre es un punto de coordenadas conocidas, así que su azimut es un
 * derivado, no un dato de campo que haya que teclear.
 */
function derivedAzimuth(
  value: PolygonalConfigState,
  referencePoints: ReferencePoint[],
): DmsValue | null {
  const point = referencePoints.find((p) => p.id === value.referencePointId);
  if (point?.north == null || point?.east == null) return null;

  const north = Number(value.startNorth);
  const east = Number(value.startEast);
  if (!Number.isFinite(north) || !Number.isFinite(east)) return null;

  const dms = decimalToDms(
    azimuthFromCoordinates(north, east, Number(point.north), Number(point.east)),
  );
  return { deg: String(dms.deg), min: String(dms.min), sec: String(dms.sec) };
}

/** Campos de configuración del proceso, compartidos por /new y el editor. */
export function PolygonalConfigFields({
  value,
  onChange,
  referencePoints = [],
  disabled,
  angleFormat,
}: PolygonalConfigFieldsProps) {
  // Solo sirven de amarre los puntos que tienen las dos coordenadas.
  const amarreOptions = [
    { value: "", label: "Sin amarre / manual" },
    ...referencePoints
      .filter((p) => p.north != null && p.east != null)
      .map((p) => ({ value: p.id, label: `${p.code} (${p.north}, ${p.east})` })),
  ];
  const azimutCalculado = derivedAzimuth(value, referencePoints);
  function set<K extends keyof PolygonalConfigState>(
    key: K,
    fieldValue: PolygonalConfigState[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre del proceso"
          value={value.name}
          disabled={disabled}
          onChange={(e) => set("name", e.target.value)}
        />
        <Select
          label="Tipo de poligonal"
          options={POLYGONAL_TYPE_OPTIONS}
          value={value.type}
          disabled={disabled}
          onChange={(e) => set("type", e.target.value as PolygonalType)}
        />
      </div>

      <PrecisionOrderSelect
        kind="angular"
        value={value.precisionOrder}
        disabled={disabled}
        onChange={(v) => set("precisionOrder", v)}
      />
      <TotalStationFieldset
        value={value.totalStation}
        onChange={(v) => set("totalStation", v)}
        order={value.precisionOrder}
        disabled={disabled}
      />

      {value.type === "closed" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tipo de ángulo"
            options={[
              { value: "", label: "Elegir…" },
              ...CLOSED_ANGLE_TYPE_OPTIONS,
            ]}
            value={value.angleType}
            disabled={disabled}
            onChange={(e) =>
              set("angleType", e.target.value as AngleType | "")
            }
          />
          <Input
            label="Lecturas mínimas por ángulo"
            type="number"
            min="1"
            step="1"
            value={value.angleReadingsMin}
            disabled={disabled}
            onChange={(e) => set("angleReadingsMin", e.target.value)}
          />
        </div>
      )}

      <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-800">
          Punto de partida
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Código"
            value={value.startPointCode}
            disabled={disabled}
            onChange={(e) => set("startPointCode", e.target.value)}
          />
          <Input
            label="Norte"
            type="number"
            step="any"
            value={value.startNorth}
            disabled={disabled}
            onChange={(e) => set("startNorth", e.target.value)}
          />
          <Input
            label="Este"
            type="number"
            step="any"
            value={value.startEast}
            disabled={disabled}
            onChange={(e) => set("startEast", e.target.value)}
          />
        </div>
        <Select
          label="Punto de amarre"
          options={amarreOptions}
          value={value.referencePointId}
          disabled={disabled}
          onChange={(e) => set("referencePointId", e.target.value)}
        />

        <AngleInput
          format={angleFormat}
          label={
            azimutCalculado
              ? "Azimut hacia el amarre (calculado)"
              : "Azimut de partida"
          }
          value={azimutCalculado ?? value.startAzimuth}
          disabled={disabled || azimutCalculado != null}
          onChange={(v) => set("startAzimuth", v)}
        />

        {azimutCalculado != null && (
          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={value.hasClosingRow}
              disabled={disabled}
              onChange={(e) => set("hasClosingRow", e.target.checked)}
            />
            <span>
              La cartera cierra contra el punto de amarre
              <span className="block text-neutral-500">
                La última fila es el ángulo del último lado de vuelta al amarre
                y no lleva distancia.
              </span>
            </span>
          </label>
        )}
      </fieldset>

      {value.type === "open_controlled" && (
        <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-medium text-neutral-800">
            Punto de llegada conocido
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Código"
              value={value.endPointCode}
              disabled={disabled}
              onChange={(e) => set("endPointCode", e.target.value)}
            />
            <Input
              label="Norte"
              type="number"
              step="any"
              value={value.endNorth}
              disabled={disabled}
              onChange={(e) => set("endNorth", e.target.value)}
            />
            <Input
              label="Este"
              type="number"
              step="any"
              value={value.endEast}
              disabled={disabled}
              onChange={(e) => set("endEast", e.target.value)}
            />
          </div>
          <AngleInput
            format={angleFormat}
            label="Azimut de llegada"
            value={value.endAzimuth}
            disabled={disabled}
            onChange={(v) => set("endAzimuth", v)}
          />
        </fieldset>
      )}
    </div>
  );
}
