import { describe, expect, it } from "vitest";
import {
  isEligible,
  selectableProcesses,
  type EligibleCandidate,
} from "./eligibility";

function poligonal(
  over: Partial<EligibleCandidate> = {},
): EligibleCandidate {
  return {
    kind: "polygonal",
    id: "pol-1",
    name: "Cuadrado oficial",
    status: "calculated",
    ...over,
  };
}

function nivelacion(over: Partial<EligibleCandidate> = {}): EligibleCandidate {
  return { kind: "leveling", id: "niv-1", name: "Línea BM", status: "calculated", ...over };
}

describe("isEligible", () => {
  // Fase 35: la poligonal no se cierra. Entra calculada, cumpla o no un
  // orden: su informe lo alerta.
  it("acepta una poligonal calculada", () => {
    expect(isEligible(poligonal())).toBe(true);
  });

  it("una poligonal en borrador o a medias no entra", () => {
    for (const status of ["draft", "in_progress"]) {
      expect(isEligible(poligonal({ status }))).toBe(false);
    }
  });

  // Fase 36: la nivelación tampoco se cierra. Entra calculada; a medias, no.
  it("acepta una nivelación calculada", () => {
    expect(isEligible(nivelacion())).toBe(true);
  });

  it("una nivelación en borrador o a medias no entra", () => {
    for (const status of ["draft", "in_progress"]) {
      expect(isEligible(nivelacion({ status }))).toBe(false);
    }
  });

  // Fase 37: el lugar no se cierra. Entra con alguna visita calculada; su
  // `status` de candidato lo deriva la consulta de sus visitas.
  it("acepta un lugar con alguna visita calculada", () => {
    expect(isEligible({ kind: "site", id: "s1", name: "Torre", status: "calculated" })).toBe(true);
  });

  it("un lugar sin visitas calculadas no entra", () => {
    for (const status of ["draft", "in_progress", "active", "closed"]) {
      expect(isEligible({ kind: "site", id: "s1", name: "Torre", status })).toBe(false);
    }
  });

  // El § 4.6 lo dice explícitamente: un proceso rechazado «queda como
  // referencia pero no se puede incluir en informes».
  it("RECHAZA un proceso rechazado", () => {
    expect(isEligible(nivelacion({ status: "rejected" }))).toBe(false);
  });
});

describe("selectableProcesses", () => {
  it("devuelve solo los elegibles, conservando el orden recibido", () => {
    const out = selectableProcesses([
      poligonal({ id: "a" }),
      nivelacion({ id: "b", status: "rejected" }),
      poligonal({ id: "c", status: "draft" }),
      { kind: "site", id: "d", name: "Torre", status: "calculated" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "d"]);
  });

  it("devuelve una lista vacía si nada es elegible", () => {
    expect(
      selectableProcesses([nivelacion({ status: "in_progress" })]),
    ).toEqual([]);
  });

  it("tolera una lista vacía", () => {
    expect(selectableProcesses([])).toEqual([]);
  });
});
