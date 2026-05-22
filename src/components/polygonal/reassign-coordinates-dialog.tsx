"use client";

import { useState } from "react";
import {
  Button,
  DmsInput,
  Input,
  Modal,
  type DmsValue,
} from "@/components/design-system";

interface ReassignCoordinatesDialogProps {
  startNorth: string;
  startEast: string;
  startAzimuth: DmsValue;
  onApply: (north: string, east: string, azimuth: DmsValue) => void;
  disabled?: boolean;
}

/**
 * Reasigna las coordenadas reales del punto de partida. Al aplicar, el editor
 * actualiza la configuración y el cálculo en vivo recoordena todas las
 * estaciones manteniendo ángulos y distancias.
 */
export function ReassignCoordinatesDialog({
  startNorth,
  startEast,
  startAzimuth,
  onApply,
  disabled,
}: ReassignCoordinatesDialogProps) {
  const [open, setOpen] = useState(false);
  const [north, setNorth] = useState(startNorth);
  const [east, setEast] = useState(startEast);
  const [azimuth, setAzimuth] = useState<DmsValue>(startAzimuth);

  function openDialog() {
    setNorth(startNorth);
    setEast(startEast);
    setAzimuth(startAzimuth);
    setOpen(true);
  }

  function apply() {
    onApply(north, east, azimuth);
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
          <DmsInput
            label="Azimut de partida"
            value={azimuth}
            onChange={setAzimuth}
          />
        </div>
      </Modal>
    </>
  );
}
