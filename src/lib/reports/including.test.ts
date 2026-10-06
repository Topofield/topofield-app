import { describe, expect, it } from "vitest";
import type { Report } from "@/types/report";
import { deletionReportsNotice, reportsIncluding } from "./including";

const informe = (id: string, incluidos: [Report["included_processes"][number]["type"], string][]) =>
  ({
    id,
    project_id: "p",
    title: id,
    observations: null,
    generated_at: null,
    generated_by: "u",
    included_processes: incluidos.map(([type, pid], order) => ({ type, id: pid, name: pid, order })),
  }) as Report;

describe("reportsIncluding (Fase 22)", () => {
  const informes = [
    informe("a", [["polygonal", "x"], ["leveling", "y"]]),
    informe("b", [["leveling", "x"]]),
    informe("c", [["site", "z"]]),
  ];

  it("devuelve los informes que incluyen el proceso, por tipo e id", () => {
    expect(reportsIncluding(informes, "polygonal", "x").map((r) => r.id)).toEqual(["a"]);
    expect(reportsIncluding(informes, "leveling", "x").map((r) => r.id)).toEqual(["b"]);
    expect(reportsIncluding(informes, "site", "z").map((r) => r.id)).toEqual(["c"]);
  });

  it("un id de otro tipo no cuenta", () => {
    expect(reportsIncluding(informes, "site", "x")).toEqual([]);
  });
});

describe("deletionReportsNotice (Fase 34)", () => {
  it("sin informes no hay aviso", () => {
    expect(deletionReportsNotice([])).toBeNull();
  });

  it("nombra el informe que pierde la sección", () => {
    expect(deletionReportsNotice(["Entrega 1"])).toBe(
      "Está en el informe consolidado «Entrega 1», que quedará sin esta sección.",
    );
  });

  it("cuenta y nombra varios", () => {
    expect(deletionReportsNotice(["A", "B"])).toBe(
      "Está en 2 informes consolidados: «A», «B». Quedarán sin esta sección.",
    );
  });
});
