import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportCover } from "@/components/reports/sections/report-cover";
import { coverOf } from "./cover";

// Fase 23: la portada de un informe emitido sale de `reports.cover`, la foto
// del proyecto al emitir; no del proyecto de hoy.

describe("coverOf", () => {
  it("toma del proyecto solo lo que muestra la portada", () => {
    const proyecto = {
      id: "p1",
      name: "Lote catastral",
      client: "Cliente Demo",
      location: "Bogotá",
      datum: "MAGNA-SIRGAS",
      projection: "Origen Bogotá",
      description: "No va a la portada",
    };
    expect(coverOf(proyecto)).toEqual({
      name: "Lote catastral",
      client: "Cliente Demo",
      location: "Bogotá",
      datum: "MAGNA-SIRGAS",
      projection: "Origen Bogotá",
    });
  });
});

describe("ReportCover", () => {
  it("muestra los datos del proyecto, y el datum sin proyección no lleva separador", () => {
    const html = renderToStaticMarkup(
      createElement(ReportCover, {
        title: "Informe de cierre",
        cover: {
          name: "Edificio en monitoreo",
          client: "Constructora Andina",
          location: "Bogotá",
          datum: "MAGNA-SIRGAS",
          projection: null,
        },
        date: "2026-09-30T15:00:00Z",
      }),
    );
    expect(html).toContain("Edificio en monitoreo");
    expect(html).toContain("Constructora Andina");
    expect(html).toContain("MAGNA-SIRGAS");
    expect(html).not.toContain(" · ");
  });
});
