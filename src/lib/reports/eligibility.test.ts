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
    status: "closed",
    ...over,
  };
}

describe("isEligible", () => {
  it("acepta una poligonal cerrada", () => {
    expect(isEligible(poligonal())).toBe(true);
  });

  it("acepta una nivelación cerrada", () => {
    expect(isEligible(poligonal({ kind: "leveling" }))).toBe(true);
  });

  it("acepta un lugar cerrado", () => {
    expect(isEligible(poligonal({ kind: "site" }))).toBe(true);
  });

  // El § 4.6 lo dice explícitamente: un proceso rechazado «queda como
  // referencia pero no se puede incluir en informes». Es una regla escrita
  // hace fases que se ejerce por primera vez aquí.
  it("RECHAZA un proceso rechazado, aunque esté cerrado en la práctica", () => {
    expect(isEligible(poligonal({ status: "rejected" }))).toBe(false);
  });

  // Un proceso abierto seguiría cambiando: el informe dejaría de ser
  // reproducible, que es lo que sostiene no guardar una copia de los datos.
  it("rechaza cualquier estado que no sea cerrado", () => {
    for (const status of ["draft", "in_progress", "calculated"] as const) {
      expect(isEligible(poligonal({ status }))).toBe(false);
    }
  });

  // Un lugar ACTIVO admite visitas nuevas aunque ya tenga varias cerradas:
  // su informe cambiaría al reabrirlo. La unidad incluible es el lugar
  // cerrado, no la visita suelta.
  it("rechaza un lugar activo aunque tenga visitas cerradas", () => {
    expect(isEligible({ kind: "site", id: "s1", name: "Torre", status: "active" })).toBe(
      false,
    );
  });
});

describe("selectableProcesses", () => {
  it("devuelve solo los elegibles, conservando el orden recibido", () => {
    const out = selectableProcesses([
      poligonal({ id: "a", status: "closed" }),
      poligonal({ id: "b", status: "rejected" }),
      poligonal({ id: "c", status: "draft" }),
      poligonal({ id: "d", kind: "site", status: "closed" }),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "d"]);
  });

  it("devuelve una lista vacía si nada es elegible", () => {
    expect(
      selectableProcesses([poligonal({ status: "calculated" })]),
    ).toEqual([]);
  });

  it("tolera una lista vacía", () => {
    expect(selectableProcesses([])).toEqual([]);
  });
});
