"use client";

// Selector de BM de partida/llegada para nivelación.
//
// Por qué existe: en nivelación, una cota de partida errónea desplaza TODAS
// las cotas calculadas del proceso por igual (es una traslación constante).
// El error de cierre compara el desnivel acumulado contra la cota de llegada
// conocida, y ese desnivel no cambia si la cota de partida se desplaza — así
// que el control de cierre sigue dando exacto aunque la cota de arranque esté
// mal transcrita. Es el único dato de entrada que ninguna validación
// posterior puede atrapar. Forzar la elección desde el catálogo de puntos de
// referencia del proyecto (en vez de digitarla a mano) elimina el error de
// transcripción en ese punto ciego.
//
// La selección del <select> (`selectedId`) NO es estado local: se deriva en
// cada render a partir de `value` y `points` (buscando el punto del catálogo
// cuyo código y cota coincidan). Antes era un `useState` que arrancaba vacío
// sin importar qué trajera `value` — así que al reabrir un proceso guardado
// con un BM del catálogo, el <select> mostraba el placeholder y, peor, los
// campos Código/Cota quedaban DESHABILITADOS (`disabled` exige
// `isFromCatalog || isOther`, y con `selectedId` vacío ninguno de los dos era
// cierto), bloqueando la edición de un proceso en borrador. Derivarlo en
// render —igual que el resto del proyecto deriva estado sin `useEffect`—
// elimina esa clase de bug de raíz: no hay estado que sincronizar, así que
// tampoco hay forma de que se desincronice al montar, desmontar o recibir un
// `value` inicial.

import { useState } from "react";
import { Input, Select } from "@/components/design-system";
import type { ReferencePoint } from "@/types/project";

const OTHER_VALUE = "__other__";

export interface BmValue {
  code: string;
  elevation: string;
}

export const EMPTY_BM_VALUE: BmValue = { code: "", elevation: "" };

interface BmSelectorProps {
  label: string;
  points: ReferencePoint[];
  value: BmValue;
  onChange: (value: BmValue) => void;
  disabled?: boolean;
}

/** El punto del catálogo cuyo código y cota coinciden con `value`, o `undefined`. */
function matchingPoint(
  points: ReferencePoint[],
  value: BmValue,
): ReferencePoint | undefined {
  if (value.code.trim() === "") return undefined;
  return points.find(
    (p) =>
      p.code === value.code &&
      (p.elevation != null ? String(p.elevation) : "") === value.elevation,
  );
}

/**
 * Select de BM del catálogo del proyecto + opción "Otro (entrada libre)".
 * Al elegir un BM, código y cota se rellenan y quedan de solo lectura. Al
 * elegir "Otro", quedan editables y vacíos.
 */
export function BmSelector({
  label,
  points,
  value,
  onChange,
  disabled,
}: BmSelectorProps) {
  // Selección del <select>: derivada de `value`, no estado propio — salvo
  // por `otherRequested`, que SÍ es estado local. Es necesario porque "Otro"
  // arranca en EMPTY_BM_VALUE, idéntico al estado inicial sin selección: sin
  // esta bandera, `hasValue` da false, `isOther` da false, y los campos
  // Código/Cota nunca se habilitan (bug detectado en la verificación final de
  // la Fase 4, hallazgo 4). La bandera se apaga sola en cuanto el catálogo
  // vuelve a coincidir con `value` — así que no puede quedar "pegada" y
  // esconder un BM real ya elegido.
  const [otherRequested, setOtherRequested] = useState(false);

  const catalogMatch = matchingPoint(points, value);
  const hasValue = value.code.trim() !== "" || value.elevation.trim() !== "";
  const isFromCatalog = catalogMatch != null;
  const isOther = (hasValue || otherRequested) && !isFromCatalog;
  const selectedId = isFromCatalog ? catalogMatch.id : isOther ? OTHER_VALUE : "";

  function handleSelect(id: string) {
    if (id === OTHER_VALUE) {
      setOtherRequested(true);
      onChange(EMPTY_BM_VALUE);
      return;
    }
    if (id === "") {
      setOtherRequested(false);
      onChange(EMPTY_BM_VALUE);
      return;
    }
    const point = points.find((p) => p.id === id);
    if (!point) return;
    setOtherRequested(false);
    onChange({
      code: point.code,
      elevation: point.elevation != null ? String(point.elevation) : "",
    });
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium text-neutral-800">
        {label}
      </legend>
      <Select
        label="BM"
        options={[
          ...points.map((p) => ({ value: p.id, label: p.code })),
          { value: OTHER_VALUE, label: "Otro (entrada libre)" },
        ]}
        placeholder="Selecciona un BM del catálogo…"
        value={selectedId}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Código"
          value={value.code}
          readOnly={isFromCatalog}
          disabled={disabled || (!isOther && !isFromCatalog)}
          onChange={(e) => onChange({ ...value, code: e.target.value })}
        />
        <Input
          label="Cota"
          type="number"
          step="any"
          value={value.elevation}
          readOnly={isFromCatalog}
          disabled={disabled || (!isOther && !isFromCatalog)}
          onChange={(e) => onChange({ ...value, elevation: e.target.value })}
        />
      </div>
    </fieldset>
  );
}
