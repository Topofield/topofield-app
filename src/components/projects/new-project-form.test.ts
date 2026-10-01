import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewProjectForm } from "./new-project-form";

// Fase 27 (PU11): el alta de proyecto es un solo formulario. El asistente de
// dos pasos enviaba el formulario al pulsar «Siguiente», porque el mismo
// botón pasaba de `type="button"` a `type="submit"` al avanzar.

describe("NewProjectForm", () => {
  const html = renderToStaticMarkup(createElement(NewProjectForm));

  it("tiene un solo botón, el de envío", () => {
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('type="submit"');
    expect(html).toContain("Crear proyecto");
    expect(html).not.toContain("Siguiente");
  });

  it("lleva los datos básicos y el sistema de referencia juntos", () => {
    for (const name of ["name", "client", "location", "datum", "projection"]) {
      expect(html).toContain(`name="${name}"`);
    }
  });
});
