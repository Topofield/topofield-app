"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  LevelFieldset,
  Modal,
  TotalStationFieldset,
} from "@/components/design-system";
import {
  createEquipmentAction,
  deleteEquipmentAction,
  updateEquipmentAction,
} from "@/app/(app)/equipos/actions";
import {
  equipmentInputFromLevel,
  equipmentInputFromTotalStation,
  equipmentLabel,
  equipmentPrecisionLabel,
  levelFieldsOf,
  totalStationFieldsOf,
} from "@/lib/equipment";
import { formatDateOnly } from "@/lib/utils/format";
import { calibrationOverdue, validateEquipmentItem } from "@/lib/validators/equipment";
import type { Equipment, EquipmentKind } from "@/types/equipment";
import {
  EMPTY_LEVEL,
  EMPTY_TOTAL_STATION,
  type LevelFields,
  type TotalStationFields,
} from "@/types/project";

type Dialog =
  | { mode: "create"; kind: EquipmentKind }
  | { mode: "edit"; equipment: Equipment }
  | { mode: "delete"; equipment: Equipment };

const SECTIONS: { kind: EquipmentKind; title: string; empty: string }[] = [
  {
    kind: "total_station",
    title: "Estaciones totales",
    empty: "Aún no hay estaciones totales. Agregue las que usa para elegirlas en cada poligonal.",
  },
  {
    kind: "level",
    title: "Niveles",
    empty:
      "Aún no hay niveles. Agregue los que usa para elegirlos en cada nivelación y en cada visita.",
  },
];

/**
 * La página del catálogo de equipos (Fase 25): estaciones totales y niveles,
 * con alta, edición y baja. Es una plantilla: lo que se cambia aquí no toca
 * ningún proceso, que guarda su propia copia del equipo.
 */
export function EquipmentCatalog({
  equipment,
  today,
}: {
  equipment: Equipment[];
  /** Hoy en Bogotá, `YYYY-MM-DD`: para el aviso de calibración. */
  today: string;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [station, setStation] = useState<TotalStationFields>(EMPTY_TOTAL_STATION);
  const [level, setLevel] = useState<LevelFields>(EMPTY_LEVEL);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function open(next: Dialog) {
    setErrors([]);
    if (next.mode === "edit") {
      if (next.equipment.kind === "total_station") setStation(totalStationFieldsOf(next.equipment));
      else setLevel(levelFieldsOf(next.equipment));
    } else if (next.mode === "create") {
      setStation(EMPTY_TOTAL_STATION);
      setLevel(EMPTY_LEVEL);
    }
    setDialog(next);
  }

  const kindOf = (d: Dialog) => (d.mode === "create" ? d.kind : d.equipment.kind);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || dialog.mode === "delete") return;
    const input =
      kindOf(dialog) === "total_station"
        ? equipmentInputFromTotalStation(station)
        : equipmentInputFromLevel(level);
    const found = Object.values(validateEquipmentItem(input, today));
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    startTransition(async () => {
      const response =
        dialog.mode === "edit"
          ? await updateEquipmentAction(dialog.equipment.id, input)
          : await createEquipmentAction(input);
      if (response.ok) setDialog(null);
      else setErrors([response.error ?? "No se pudo guardar el equipo."]);
    });
  }

  function confirmDelete(item: Equipment) {
    startTransition(async () => {
      const response = await deleteEquipmentAction(item.id);
      if (response.ok) setDialog(null);
      else setErrors([response.error ?? "No se pudo eliminar el equipo."]);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => {
        const items = equipment.filter((e) => e.kind === section.kind);
        return (
          <Card
            key={section.kind}
            title={section.title}
            actions={
              <Button size="sm" onClick={() => open({ mode: "create", kind: section.kind })}>
                Agregar
              </Button>
            }
          >
            {items.length === 0 ? (
              <p className="text-sm text-ink-2">{section.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs text-ink-2">
                      <th className="py-2 pr-3 font-medium">Equipo</th>
                      <th className="py-2 pr-3 font-medium">Calibración</th>
                      <th className="py-2 pr-3 font-medium">Precisión</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-rule last:border-0">
                        <td className="py-2 pr-3 font-medium text-ink">{equipmentLabel(item)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-ink-2">
                          {item.calibration_date ? formatDateOnly(item.calibration_date) : "—"}
                          {calibrationOverdue(item.calibration_date, today) && (
                            <Badge tone="warning" className="ml-2">
                              Más de un año
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-ink-2">
                          {equipmentPrecisionLabel(item)}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => open({ mode: "edit", equipment: item })}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => open({ mode: "delete", equipment: item })}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {dialog && dialog.mode !== "delete" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title={dialog.mode === "edit" ? "Editar equipo" : "Nuevo equipo"}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errors.length > 0 && <Alert variant="error">{errors.join(" ")}</Alert>}
            {kindOf(dialog) === "total_station" ? (
              <TotalStationFieldset value={station} onChange={setStation} disabled={isPending} />
            ) : (
              <LevelFieldset value={level} onChange={setLevel} disabled={isPending} />
            )}
            {dialog.mode === "edit" && (
              <p className="text-sm text-ink-2">
                Los procesos que ya usaron este equipo conservan sus datos: corregirlo aquí
                no los cambia.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.mode === "delete" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title="Eliminar equipo"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={isPending}
                onClick={() => confirmDelete(dialog.equipment)}
              >
                {isPending ? "Eliminando…" : "Eliminar"}
              </Button>
            </>
          }
        >
          {errors.length > 0 && <Alert variant="error">{errors.join(" ")}</Alert>}
          <p className="text-sm text-ink">
            ¿Eliminar <strong>{equipmentLabel(dialog.equipment)}</strong> del catálogo? Los
            procesos que lo usaron conservan su copia del equipo.
          </p>
        </Modal>
      )}
    </div>
  );
}
