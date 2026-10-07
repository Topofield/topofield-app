import { describe, expect, it } from "vitest";
import { reopenBlocker, reopenPatch, reportsNotice } from "./reopen";

describe("reopenPatch", () => {
  it("una visita vuelve a calculada, sin registro de cierre", () => {
    expect(reopenPatch("visit")).toEqual({ status: "calculated", closed_at: null, closed_by: null });
  });

  it("un lugar vuelve a activo", () => {
    expect(reopenPatch("site")).toEqual({ status: "active", closed_at: null, closed_by: null });
  });
});

describe("reopenBlocker", () => {
  it("una visita cerrada de un lugar activo se reabre", () => {
    expect(reopenBlocker("visit", "closed", "active")).toBeNull();
  });

  it("una visita de un lugar cerrado espera a que se reabra el lugar", () => {
    expect(reopenBlocker("visit", "closed", "closed")).toBe("El lugar está cerrado: reábrelo primero.");
  });

  it("una visita abierta no se reabre", () => {
    expect(reopenBlocker("visit", "calculated", "active")).toBe("La visita no está cerrada.");
  });

  it("un lugar cerrado se reabre; uno activo no", () => {
    expect(reopenBlocker("site", "closed")).toBeNull();
    expect(reopenBlocker("site", "active")).toBe("El lugar no está cerrado.");
  });
});

describe("reportsNotice", () => {
  it("sin informes no hay aviso", () => {
    expect(reportsNotice([])).toBeNull();
  });

  it("nombra el informe", () => {
    expect(reportsNotice(["Entrega 1"])).toBe(
      "Está en el informe consolidado «Entrega 1». Lo mostrará con los datos nuevos, sin fecha de cierre mientras siga abierto.",
    );
  });

  it("cuenta y nombra varios", () => {
    expect(reportsNotice(["A", "B"])).toBe(
      "Está en 2 informes consolidados: «A», «B». Lo mostrarán con los datos nuevos, sin fecha de cierre mientras siga abierto.",
    );
  });
});
