import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEVEL_CLASSES,
  SEMAPHORE_SHAPES,
  type StatusIndicatorProps,
} from "./status-indicator";
import { ALERT_LEVELS } from "@/types/settlement";

describe("SEMAPHORE_SHAPES", () => {
  it("da una forma distinta a cada uno de los 4 niveles", () => {
    const formas = Object.values(SEMAPHORE_SHAPES);
    expect(formas).toHaveLength(4);
    expect(new Set(formas).size).toBe(4);
  });

  it("cubre exactamente los 4 niveles de alerta", () => {
    expect(Object.keys(SEMAPHORE_SHAPES).sort()).toEqual([
      "alarm",
      "alert",
      "caution",
      "normal",
    ]);
  });

  it("solo el nivel «normal» es un círculo (rounded-full)", () => {
    // Si dos niveles fueran círculos, el canal de forma no los distinguiría:
    // esta es la propiedad que de verdad motiva la tarea, no solo que las
    // cuatro cadenas sean distintas entre sí.
    for (const nivel of ALERT_LEVELS) {
      const esCirculo = SEMAPHORE_SHAPES[nivel].includes("rounded-full");
      expect(esCirculo).toBe(nivel === "normal");
    }
  });

  it("el rombo («alert») rota 45° y el cuadrado («caution») no", () => {
    expect(SEMAPHORE_SHAPES.alert).toContain("rotate-45");
    expect(SEMAPHORE_SHAPES.caution).not.toContain("rotate-45");
  });

  it("la alarma usa el recorte de triángulo", () => {
    expect(SEMAPHORE_SHAPES.alarm).toContain("clip-triangle");
  });
});

describe("LEVEL_CLASSES", () => {
  it("cubre los 4 niveles con un token semaphore-* distinto cada uno", () => {
    expect(Object.keys(LEVEL_CLASSES).sort()).toEqual([
      "alarm",
      "alert",
      "caution",
      "normal",
    ]);
    const tokens = Object.values(LEVEL_CLASSES);
    expect(tokens.every((t) => t.includes("semaphore-"))).toBe(true);
    expect(new Set(tokens).size).toBe(4);
  });
});

describe(".clip-triangle en globals.css", () => {
  it("está declarada dentro de un @layer utilities, no suelta", () => {
    // Regla del sistema de diseño: una regla CSS global fuera de @layer gana
    // sobre las utilidades de Tailwind y las anula en silencio. Esta prueba
    // no valida CSS de verdad (para eso haría falta un parser), pero sí
    // atrapa el error más probable: mover o pegar la regla fuera del bloque
    // @layer utilities en un cambio futuro.
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf-8",
    );
    const inicioUtilities = css.indexOf("@layer utilities");
    const finUtilities = css.indexOf("}", css.indexOf("{", inicioUtilities));
    const inicioTriangulo = css.indexOf(".clip-triangle");

    expect(inicioUtilities).toBeGreaterThan(-1);
    expect(inicioTriangulo).toBeGreaterThan(inicioUtilities);
    expect(inicioTriangulo).toBeLessThan(finUtilities);
  });
});

describe("contrato de props: status o level, nunca ninguno ni ambos", () => {
  it("es una unión discriminada deliberada", () => {
    // Ancla para que este test falle si alguien afloja el contrato: un
    // indicador sin status ni level caería en verde «normal» en silencio
    // (ver LEVEL_CLASSES.normal / DOT_CLASSES.ok), que es justo el fallo
    // silencioso que esta unión existe para impedir.
    //
    // La garantía real la da `npm run typecheck` sobre el tipo, no esta
    // aserción: TypeScript no permite "probar" en runtime que un tipo NO
    // compila sin evaluar código inválido, así que el chequeo vive como
    // comentario tipado más abajo — si `StatusIndicatorProps` volviera a
    // aceptar props sueltas, este bloque dejaría de dar error de tipos y
    // `npm run typecheck` fallaría.
    type CasoInvalidoSinNinguno = { label: string };
    type CasoInvalidoConAmbos = {
      label: string;
      status: "ok";
      level: "normal";
    };

    // @ts-expect-error — sin status ni level no debe ser asignable.
    const _sinNinguno: StatusIndicatorProps = {} as CasoInvalidoSinNinguno;
    // @ts-expect-error — status y level a la vez no debe ser asignable.
    const _conAmbos: StatusIndicatorProps = {} as CasoInvalidoConAmbos;
    void _sinNinguno;
    void _conAmbos;

    expect(true).toBe(true);
  });
});
