// Test de la derivación server-side del status de cierre (deuda de
// revalidación en el servidor, ver
// /home/kris/topofield-app/.superpowers/deuda-revalidacion-servidor.md).
//
// `deriveLevelingCloseStatus` es la pieza que impide que un cliente que
// invoque `closeLevelingProcessAction` saltándose el diálogo (`asRejected:
// false` a mano) pueda cerrar como `closed` un proceso fuera de tolerancia.
// La verificación end-to-end contra un dev server real vive en el informe;
// este test cubre la lógica pura de derivación, incluyendo el caso límite de
// `type === "open"` (que nunca tiene `meets_tolerance` no nulo por diseño).

import { describe, expect, it } from "vitest";
import { deriveLevelingCloseStatus } from "./close-status";

describe("deriveLevelingCloseStatus", () => {
  it("cierra como closed un proceso calculado dentro de tolerancia", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "closed", has_return_run: false, meets_tolerance: true },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("el ataque queda bloqueado: asRejected=false no cierra un proceso fuera de tolerancia", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "closed", has_return_run: false, meets_tolerance: false },
      false, // el cliente pide "closed" sobre un proceso que no cumple
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("respeta un rechazo voluntario del cliente sobre un proceso que sí cumple (más estricto, permitido)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "closed", has_return_run: false, meets_tolerance: true },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("rechaza el cierre si meets_tolerance es null (nunca se calculó)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "link", has_return_run: false, meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso in_progress (no calculado)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "in_progress", type: "closed", has_return_run: false, meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso draft", () => {
    const result = deriveLevelingCloseStatus(
      { status: "draft", type: "closed", has_return_run: false, meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("tipo 'open' cierra como closed aunque meets_tolerance sea null (no tiene cota de cierre conocida por diseño)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", has_return_run: false, meets_tolerance: null },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  // Fase 23: una abierta CON vuelta se juzga por su discrepancia, guardada en
  // meets_tolerance; ya no cierra como conforme por no tener cota de cierre.
  it("abierta con vuelta fuera de tolerancia: rechazada aunque el cliente pida closed", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", has_return_run: true, meets_tolerance: false },
      false,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("abierta con vuelta que cumple: closed", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", has_return_run: true, meets_tolerance: true },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("abierta con vuelta sin veredicto (faltan distancias): no se cierra", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", has_return_run: true, meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("tipo 'open' respeta un rechazo voluntario del cliente", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", has_return_run: false, meets_tolerance: null },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });
});
