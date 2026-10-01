import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportStateMark } from "@/components/process/report-state-mark";
import { processReportState } from "./state";

// Fase 24: el informe de un proceso rechazado llevaba la marca de borrador,
// aunque el proceso ya estaba cerrado para siempre.

describe("processReportState", () => {
  it("cerrado, rechazado y todo lo demás como borrador", () => {
    expect(processReportState("closed")).toBe("closed");
    expect(processReportState("rejected")).toBe("rejected");
    for (const status of ["draft", "in_progress", "calculated", "active"]) {
      expect(processReportState(status)).toBe("draft");
    }
  });
});

describe("ReportStateMark", () => {
  const html = (state: Parameters<typeof ReportStateMark>[0]["state"]) =>
    renderToStaticMarkup(createElement(ReportStateMark, { state }));

  it("borrador mientras se edita", () => {
    expect(html("draft")).toContain("Borrador — el informe se emite al cerrar el proceso");
  });

  it("un rechazado no dice borrador", () => {
    const marca = html("rejected");
    expect(marca).toContain("Rechazado");
    expect(marca).toContain("no entra en informes consolidados");
    expect(marca).not.toContain("Borrador");
  });

  it("cerrado conforme, sin marca", () => {
    expect(html("closed")).toBe("");
  });
});
