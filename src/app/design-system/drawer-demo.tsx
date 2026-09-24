"use client";

import { useState } from "react";
import { Button, Drawer } from "@/components/design-system";

const LECTURAS = [
  { punto: "BM-1", cota: "2 548.3120" },
  { punto: "P-01", cota: "2 548.1047" },
  { punto: "P-02", cota: "2 548.0981" },
  { punto: "P-03", cota: "2 547.9876" },
];

/** Demostración de `Drawer`, que necesita estado de apertura. */
export function DrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir panel
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Visita 7 · 14 mar 2026"
        description="Libreta de nivelación de la visita, amarrada al BM-1."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Guardar visita</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-800">
          El cuerpo desplaza por su cuenta; la cabecera y el pie quedan a la
          vista. A 390 px el panel ocupa todo el ancho.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th scope="col" className="py-2 font-semibold">
                Punto
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Cota (m)
              </th>
            </tr>
          </thead>
          <tbody>
            {LECTURAS.map((fila) => (
              <tr key={fila.punto} className="border-b border-neutral-100">
                <td className="py-2">{fila.punto}</td>
                <td className="py-2 text-right tabular-nums">{fila.cota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Drawer>
    </>
  );
}
