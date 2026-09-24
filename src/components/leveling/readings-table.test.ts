import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyReading, ReadingsTable } from "./readings-table";

// La libreta de la visita (Fase 18) comparte esta tabla con nivelación y le
// añade tres props opcionales. Sin ellas, nivelación no debe cambiar.

function render(extra: Record<string, unknown> = {}) {
  const readings = [
    { ...emptyReading(), id: "a", pointCode: "BM-1", pointType: "bm" as const },
    { ...emptyReading(), id: "b", pointCode: "PC-01", pointType: "intermediate" as const },
  ];
  return renderToStaticMarkup(
    createElement(ReadingsTable, {
      readings,
      onChange: () => {},
      computed: [],
      issues: [],
      levelType: "digital",
      ...extra,
    }),
  );
}

describe("ReadingsTable — props de la libreta de la visita", () => {
  it("sin las props nuevas no hay botón de insertar, ni sugerencias, ni notas", () => {
    const html = render();
    expect(html).not.toContain(">Insertar<");
    expect(html).not.toContain("<datalist");
    expect(html).not.toContain(" list=");
  });

  it("con ellas ofrece insertar, sugiere códigos y pinta la nota de la fila", () => {
    const html = render({
      allowInsert: true,
      codeSuggestions: ["BM-1", "PC-01"],
      rowNotes: [null, "Punto de control"],
    });
    expect(html.match(/>Insertar</g)).toHaveLength(2);
    expect(html).toContain("<datalist");
    expect(html).toContain('<option value="PC-01">');
    expect(html).toContain("Punto de control");
  });
});
