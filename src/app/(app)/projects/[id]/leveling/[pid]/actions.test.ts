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
      { status: "calculated", type: "closed", meets_tolerance: true },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("el ataque queda bloqueado: asRejected=false no cierra un proceso fuera de tolerancia", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "closed", meets_tolerance: false },
      false, // el cliente pide "closed" sobre un proceso que no cumple
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("respeta un rechazo voluntario del cliente sobre un proceso que sí cumple (más estricto, permitido)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "closed", meets_tolerance: true },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });

  it("rechaza el cierre si meets_tolerance es null (nunca se calculó)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "link", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso in_progress (no calculado)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "in_progress", type: "closed", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza el cierre de un proceso draft", () => {
    const result = deriveLevelingCloseStatus(
      { status: "draft", type: "closed", meets_tolerance: null },
      false,
    );
    expect(result.ok).toBe(false);
  });

  it("tipo 'open' cierra como closed aunque meets_tolerance sea null (no tiene cota de cierre conocida por diseño)", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", meets_tolerance: null },
      false,
    );
    expect(result).toEqual({ ok: true, status: "closed" });
  });

  it("tipo 'open' respeta un rechazo voluntario del cliente", () => {
    const result = deriveLevelingCloseStatus(
      { status: "calculated", type: "open", meets_tolerance: null },
      true,
    );
    expect(result).toEqual({ ok: true, status: "rejected" });
  });
});
