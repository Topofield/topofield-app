// Test de la derivación server-side del status de cierre (deuda de
// revalidación en el servidor, ver
// /home/kris/topofield-app/.superpowers/deuda-revalidacion-servidor.md).
//
// `derivePolygonalCloseStatus` es la pieza que impide que un cliente que
// invoque `closePolygonalProcessAction` saltándose el diálogo (`asRejected:
// false` a mano) pueda cerrar como `closed` un proceso fuera de tolerancia.
// Poligonal ya está en producción con datos reales: este módulo es el más
// sensible de los dos. La verificación end-to-end contra un dev server real
// vive en el informe; este test cubre la lógica pura de derivación,
// incluyendo el caso límite de `type === "open_uncontrolled"` (que nunca
// tiene `meets_tolerance` no nulo por diseño).

import { describe, expect, it } from "vitest";
import { derivePolygonalCloseStatus } from "./close-status";

describe("derivePolygonalCloseStatus", () => {
  it("cierra como closed un proceso calculado dentro de tolerancia", () => {
    const result = derivePolygonalCloseStatus(
      { status: "calculated", type: "closed", meets_tolerance: true },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("el ataque queda bloqueado: asRejected=false no cierra un proceso fuera de tolerancia", () => {
    const result = derivePolygonalCloseStatus(
      { status: "calculated", type: "closed", meets_tolerance: false },
      false, // el cliente pide "closed" sobre un proceso que no cumple
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("respeta un rechazo voluntario del cliente sobre un proceso que sí cumple (más estricto, permitido)", () => {
    const result = derivePolygonalCloseStatus(
      { status: "calculated", type: "closed", meets_tolerance: true },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("rechaza el cierre si meets_tolerance es null (nunca se calculó)", () => {
    const result = derivePolygonalCloseStatus(
      { status: "calculated", type: "open_controlled", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso in_progress (no calculado)", () => {
    const result = derivePolygonalCloseStatus(
      { status: "in_progress", type: "closed", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso draft", () => {
    const result = derivePolygonalCloseStatus(
      { status: "draft", type: "closed", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("tipo 'open_uncontrolled' cierra como closed aunque meets_tolerance sea null (no hay tolerancia por diseño)", () => {
    const result = derivePolygonalCloseStatus(
      {
        status: "calculated",
        type: "open_uncontrolled",
        meets_tolerance: null,
      },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("tipo 'open_uncontrolled' respeta un rechazo voluntario del cliente", () => {
    const result = derivePolygonalCloseStatus(
      {
        status: "calculated",
        type: "open_uncontrolled",
        meets_tolerance: null,
      },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });
});
