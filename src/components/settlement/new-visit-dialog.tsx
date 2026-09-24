"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  Alert,
  Button,
  Input,
  LevelFieldset,
  Modal,
  PrecisionOrderSelect,
  Select,
} from "@/components/design-system";
import { BmSelector, type BmValue } from "@/components/leveling/bm-selector";
import { parseNumber } from "@/lib/utils/parse";
import { createVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import type { LevelFields, PrecisionOrder, ReferencePoint } from "@/types/project";
import type { SettlementVisit } from "@/types/settlement";

/** Cómo se va a capturar la visita: las dos formas de la libreta o las cotas. */
type Start = "type" | "import" | "direct";

const START_OPTIONS: { value: Start; label: string }[] = [
  { value: "type", label: "Digitar la libreta de nivelación" },
  { value: "import", label: "Importar la libreta desde un archivo" },
  { value: "direct", label: "Cotas directas (nivelación procesada fuera)" },
];

interface NewVisitDialogProps {
  projectId: string;
  siteId: string;
  referencePoints: ReferencePoint[];
  /**
   * La visita más reciente del lugar, de la que se toman el nivelador, el
   * amarre, el orden y el equipo (decisión 15). Null en la primera visita.
   */
  previous: SettlementVisit | null;
  disabled?: boolean;
}

function levelOf(v: SettlementVisit | null): LevelFields {
  return {
    equipmentBrand: v?.equipment_brand ?? "",
    equipmentModel: v?.equipment_model ?? "",
    equipmentSerial: v?.equipment_serial ?? "",
    equipmentCalibrationDate: v?.equipment_calibration_date ?? "",
    levelType: v?.level_type ?? "",
    kmPrecisionMm: v?.km_precision_mm != null ? String(v.km_precision_mm) : "",
  };
}

function amarreOf(v: SettlementVisit | null): BmValue {
  return {
    code: v?.reference_bm_code ?? "",
    elevation:
      v?.reference_bm_elevation == null ? "" : Number(v.reference_bm_elevation).toFixed(4),
  };
}

/**
 * «+ Nueva visita» (Fase 18, decisión 15): crea la visita con su cabecera y
 * lleva al editor. Hasta ahora solo pedía la fecha, y el equipo había que
 * volver a teclearlo en cada visita.
 */
export function NewVisitDialog({
  projectId,
  siteId,
  referencePoints,
  previous,
  disabled,
}: NewVisitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [operator, setOperator] = useState(previous?.operator ?? "");
  const [start, setStart] = useState<Start>("type");
  const [amarre, setAmarre] = useState<BmValue>(() => amarreOf(previous));
  const [order, setOrder] = useState<PrecisionOrder>(
    previous?.precision_order ?? "tercer_orden",
  );
  const [level, setLevel] = useState<LevelFields>(() => levelOf(previous));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (date.trim() === "") {
      setError("La fecha es obligatoria.");
      return;
    }
    const elevation = parseNumber(amarre.elevation);
    // Para digitar, el amarre es la primera fila de la libreta: sin él la
    // plantilla no tiene de dónde arrancar. Importando, lo trae el archivo.
    if (start === "type" && (amarre.code.trim() === "" || elevation === null)) {
      setError("Elige el BM de amarre de la visita, con su cota.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await createVisitAction(projectId, siteId, {
        date,
        operator: operator.trim() || null,
        captureMode: start === "direct" ? "direct" : "book",
        referenceBm:
          start === "direct" || amarre.code.trim() === ""
            ? null
            : { code: amarre.code.trim(), elevation },
        precisionOrder: order,
        equipmentBrand: level.equipmentBrand.trim() || null,
        equipmentModel: level.equipmentModel.trim() || null,
        equipmentSerial: level.equipmentSerial.trim() || null,
        equipmentCalibrationDate: level.equipmentCalibrationDate.trim() || null,
        levelType: level.levelType === "" ? null : level.levelType,
        kmPrecisionMm: parseNumber(level.kmPrecisionMm),
      });
      if (response.ok && response.visitId) {
        setOpen(false);
        router.push(
          `/projects/${projectId}/settlement/${siteId}/visits/${response.visitId}/editar${
            start === "import" ? "?importar=1" : ""
          }`,
        );
      } else {
        setError(response.error ?? "Ocurrió un error.");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        + Nueva visita
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva visita"
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="new-visit-form" disabled={isPending}>
              {isPending ? "Creando…" : "Crear y abrir"}
            </Button>
          </>
        }
      >
        <form id="new-visit-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Nivelador"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
          </div>
          <Select
            label="Captura"
            options={START_OPTIONS}
            value={start}
            onChange={(e) => setStart(e.target.value as Start)}
            helperText={
              start === "import"
                ? "Se abre el editor con la importación: .L de Leica o la plantilla CSV."
                : start === "direct"
                  ? "Para una nivelación calculada fuera de la app: se teclea la cota de cada punto."
                  : "El editor propone la secuencia de la visita anterior; solo hay que llenar las lecturas."
            }
          />
          {start !== "direct" && (
            <BmSelector
              label={start === "import" ? "BM de amarre (opcional: lo trae el archivo)" : "BM de amarre"}
              points={referencePoints.filter((p) => p.elevation != null)}
              value={amarre}
              onChange={setAmarre}
            />
          )}
          <PrecisionOrderSelect kind="leveling" value={order} onChange={setOrder} />
          <LevelFieldset value={level} onChange={setLevel} order={order} />
          {previous && (
            <p className="text-sm text-neutral-500">
              El nivelador, el amarre, el orden y el equipo vienen de la visita{" "}
              {previous.visit_number}. Cámbialos si no son los de esta.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
