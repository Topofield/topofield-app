import { describe, expect, it } from "vitest";
import type { Report } from "@/types/report";
import { reportsIncluding } from "./including";

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
