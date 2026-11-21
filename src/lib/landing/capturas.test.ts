import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APARTADOS } from "./contenido";

describe("las capturas de la página de presentación", () => {
  const capturas = JSON.parse(
    readFileSync(join(process.cwd(), "docs", "manual", "capturas.json"), "utf8"),
  ) as Record<string, [number, number]>;

  it.each(APARTADOS.map((a) => [a.titulo, a.captura]))(
    "%s enseña una captura del manual que existe",
    (_titulo, captura) => {
      expect(capturas[captura]).toBeDefined();
    },
  );
});
