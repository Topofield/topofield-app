import { describe, expect, it } from "vitest";
import { routeMenusOf } from "./route-menus";

const rows = {
  projects: [
    { id: "p2", name: "Vía Sur", status: "active" },
    { id: "p1", name: "Edificio Norte", status: "active" },
    { id: "p3", name: "Lote 2019", status: "archived" },
  ],
  polygonals: [
    { id: "a2", name: "TT4" },
    { id: "a1", name: "Sede Vivero" },
  ],
  levelings: [{ id: "n1", name: "El Verjón" }],
  sites: [{ id: "s1", name: "Torre Alameda" }],
};

describe("routeMenusOf (Fase 44)", () => {
  it("los proyectos, por nombre, con el actual marcado y el archivado avisado", () => {
    const { projects } = routeMenusOf(rows, { projectId: "p1" });
    expect(projects.map((e) => [e.label, e.href, e.hint ?? null, e.current ?? false])).toEqual([
      ["Edificio Norte", "/projects/p1", null, true],
      ["Lote 2019", "/projects/p3", "Archivado", false],
      ["Vía Sur", "/projects/p2", null, false],
    ]);
  });

  it("los procesos del proyecto: poligonales, nivelaciones y lugares, cada grupo por nombre", () => {
    const { processes } = routeMenusOf(rows, { projectId: "p1", processHref: "/projects/p1/polygonal/a2" });
    expect(processes.map((e) => [e.label, e.href, e.hint, e.current ?? false])).toEqual([
      ["Sede Vivero", "/projects/p1/polygonal/a1", "Poligonal", false],
      ["TT4", "/projects/p1/polygonal/a2", "Poligonal", true],
      ["El Verjón", "/projects/p1/leveling/n1", "Nivelación", false],
      ["Torre Alameda", "/projects/p1/settlement/s1", "Asentamientos", false],
    ]);
  });

  it("ordena con tildes y mayúsculas como en español", () => {
    const { projects } = routeMenusOf(
      { ...rows, projects: [{ id: "x", name: "Ñame", status: "active" }, { id: "y", name: "árbol", status: "active" }, { id: "z", name: "Nube", status: "active" }] },
      { projectId: "x" },
    );
    expect(projects.map((e) => e.label)).toEqual(["árbol", "Nube", "Ñame"]);
  });
});
