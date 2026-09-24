"use client";

import { useMemo, useState } from "react";
import {
  AngleInput,
  Button,
  Input,
  Modal,
  type AngleFormat,
  type DmsValue,
} from "@/components/design-system";
import {
  azimuthFromCoordinates,
  decimalToDms,
} from "@/lib/calculations/angles";

interface ReassignCoordinatesDialogProps {
  startNorth: string;
  startEast: string;
  startAzimuth: DmsValue;
  /** Coordenadas actuales del amarre, si el proceso está amarrado. */
  referenceNorth?: string;
  referenceEast?: string;
  /** Código del amarre, solo para rotular. */
  referencePointCode?: string | null;
  onApply: (
    north: string,
    east: string,
    azimuth: DmsValue,
    referenceNorth?: string,
    referenceEast?: string,
  ) => void;
  disabled?: boolean;
  /** Formato de captura de los ángulos (Fase 13, P1). */
  angleFormat: AngleFormat;
}

/**
 * Reasigna las coordenadas reales del punto de partida y, si el proceso está
 * amarrado, también las del punto de amarre. Al aplicar, el editor actualiza la
 * configuración y el cálculo en vivo recoordena todas las estaciones
 * manteniendo ángulos y distancias.
 *
 * Con amarre, el azimut NO se teclea: se calcula desde las dos coordenadas. Un
 * levantamiento suele arrancar en sistema local arbitrario (1000, 1000) y
 * recibir coordenadas reales después; reemplazarlas es una rotación más una
 * traslación, que deja invariantes el error angular, el error lineal y la
 * precisión relativa. Solo cambian el origen y la orientación.
 */
export function ReassignCoordinatesDialog({
  startNorth,
  startEast,
  startAzimuth,
  referenceNorth,
  referenceEast,
  referencePointCode,
  onApply,
  disabled,
  angleFormat,
}: ReassignCoordinatesDialogProps) {
  const [open, setOpen] = useState(false);
  const [north, setNorth] = useState(startNorth);
  const [east, setEast] = useState(startEast);
  const [azimuth, setAzimuth] = useState<DmsValue>(startAzimuth);
  const [refNorth, setRefNorth] = useState(referenceNorth ?? "");
  const [refEast, setRefEast] = useState(referenceEast ?? "");

  const amarrado = referenceNorth != null && referenceEast != null;

  const azimutCalculado = useMemo(() => {
    if (!amarrado) return null;
    const values = [north, east, refNorth, refEast].map(Number);
    if (!values.every(Number.isFinite)) return null;
    const [n, e, rn, re] = values as [number, number, number, number];
    const dms = decimalToDms(azimuthFromCoordinates(n, e, rn, re));
    return { deg: String(dms.deg), min: String(dms.min), sec: String(dms.sec) };
  }, [amarrado, north, east, refNorth, refEast]);

  function openDialog() {
    setNorth(startNorth);
    setEast(startEast);
    setAzimuth(startAzimuth);
    setRefNorth(referenceNorth ?? "");
    setRefEast(referenceEast ?? "");
    setOpen(true);
  }

  function apply() {
    onApply(
      north,
      east,
      azimutCalculado ?? azimuth,
      amarrado ? refNorth : undefined,
      amarrado ? refEast : undefined,
    );
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={openDialog}
        disabled={disabled}
      >
        Asignar coordenadas reales
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Asignar coordenadas reales"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={apply}>Aplicar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">
            Las coordenadas de todas las estaciones se recalculan manteniendo
            los ángulos y las distancias.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Norte de partida"
              type="number"
              step="any"
              value={north}
              onChange={(e) => setNorth(e.target.value)}
            />
            <Input
              label="Este de partida"
              type="number"
              step="any"
              value={east}
              onChange={(e) => setEast(e.target.value)}
            />
          </div>
          {amarrado && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={`Norte de ${referencePointCode ?? "amarre"}`}
                type="number"
                step="any"
                value={refNorth}
                onChange={(e) => setRefNorth(e.target.value)}
              />
              <Input
                label={`Este de ${referencePointCode ?? "amarre"}`}
                type="number"
                step="any"
                value={refEast}
                onChange={(e) => setRefEast(e.target.value)}
              />
            </div>
          )}
          <AngleInput
            format={angleFormat}
            label={
              azimutCalculado
                ? "Azimut hacia el amarre (calculado)"
                : "Azimut de partida"
            }
            value={azimutCalculado ?? azimuth}
            disabled={azimutCalculado != null}
            onChange={setAzimuth}
          />
          {azimutCalculado != null && (
            <p className="text-sm text-neutral-500">
              El error angular, el error lineal y la precisión relativa no
              cambian: girar y trasladar la poligonal no altera nada de lo que
              el cierre certifica.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
