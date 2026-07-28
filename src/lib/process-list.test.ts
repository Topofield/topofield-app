import { describe, expect, it } from "vitest";
import {
  countByStatus,
  filterProcesses,
  parsePrecision,
  type ProcessFilters,
} from "./process-list";
import type { PolygonalProcess } from "@/types/polygonal";

function proc(over: Partial<PolygonalProcess> = {}): PolygonalProcess {
  return {
    id: "p1",
    project_id: "proj",
    name: "Poligonal",
    type: "closed",
    status: "calculated",
    relative_precision: null,
    meets_tolerance: null,
    updated_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  } as PolygonalProcess;
}

const SIN_FILTRO: ProcessFilters = {
  q: "",
  estado: "todos",
  tipo: "todos",
  orden: "actividad",
  dir: "desc",
};

describe("parsePrecision", () => {
  it("extrae el valor numérico de la cadena formateada", () => {
    expect(parsePrecision("1:5000")).toBe(5000);
  });

  it("ignora los separadores de miles", () => {
    expect(parsePrecision("1:17.222.920")).toBe(17222920);
  });

  it("trata 1:∞ como el valor máximo", () => {
    expect(parsePrecision("1:∞")).toBe(Number.POSITIVE_INFINITY);
  });

  it("devuelve -Infinity cuando no hay precisión, para que ordene al final", () => {
    expect(parsePrecision(null)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("trata 1:0 como cero", () => {
    expect(parsePrecision("1:0")).toBe(0);
  });

  it("devuelve -Infinity con una cadena malformada", () => {
    expect(parsePrecision("abc")).toBe(Number.NEGATIVE_INFINITY);
  });

  it("devuelve -Infinity cuando la parte tras 1: no es numérica", () => {
    expect(parsePrecision("1:abc")).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("filterProcesses — búsqueda", () => {
  const lista = [proc({ id: "a", name: "Manzana 12" }), proc({ id: "b", name: "Vía terciaria" })];

  it("sin término devuelve todo", () => {
    expect(filterProcesses(lista, SIN_FILTRO)).toHaveLength(2);
  });

  it("filtra por nombre", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "manzana" });
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("no distingue mayúsculas", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "MANZANA" });
    expect(r).toHaveLength(1);
  });

  it("no distingue acentos", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "via" });
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("ignora espacios alrededor del término", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "  manzana  " });
    expect(r).toHaveLength(1);
  });
});

describe("filterProcesses — estado y tipo", () => {
  const lista = [
    proc({ id: "d", status: "draft" }),
    proc({ id: "p", status: "in_progress" }),
    proc({ id: "c", status: "calculated" }),
    proc({ id: "x", status: "closed" }),
    proc({ id: "r", status: "rejected" }),
  ];

  it("«borradores» agrupa draft e in_progress", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "borradores" });
    expect(r.map((p) => p.id).sort()).toEqual(["d", "p"]);
  });

  it("«calculados» solo trae los calculados", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "calculados" });
    expect(r.map((p) => p.id)).toEqual(["c"]);
  });

  it("«cerrados» no incluye los rechazados", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "cerrados" });
    expect(r.map((p) => p.id)).toEqual(["x"]);
  });

  it("filtra por tipo de poligonal", () => {
    const porTipo = [
      proc({ id: "1", type: "closed" }),
      proc({ id: "2", type: "open_controlled" }),
    ];
    const r = filterProcesses(porTipo, { ...SIN_FILTRO, tipo: "open_controlled" });
    expect(r.map((p) => p.id)).toEqual(["2"]);
  });

  it("combina búsqueda, estado y tipo", () => {
    const mixta = [
      proc({ id: "1", name: "Manzana 12", status: "calculated", type: "closed" }),
      proc({ id: "2", name: "Manzana 13", status: "closed", type: "closed" }),
      proc({ id: "3", name: "Vía 4", status: "calculated", type: "closed" }),
    ];
    const r = filterProcesses(mixta, {
      ...SIN_FILTRO,
      q: "manzana",
      estado: "calculados",
      tipo: "closed",
    });
    expect(r.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("filterProcesses — ordenamiento", () => {
  it("ordena por actividad reciente de forma descendente por defecto", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    const r = filterProcesses(lista, SIN_FILTRO);
    expect(r.map((p) => p.id)).toEqual(["nuevo", "viejo"]);
  });

  it("ordena la precisión numéricamente, no como texto", () => {
    // Lexicográficamente "1:1001" iría antes que "1:46"; numéricamente no.
    const lista = [
      proc({ id: "peor", relative_precision: "1:46" }),
      proc({ id: "mejor", relative_precision: "1:1001" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["mejor", "peor"]);
  });

  it("coloca 1:∞ como la mejor precisión", () => {
    const lista = [
      proc({ id: "finita", relative_precision: "1:99999" }),
      proc({ id: "exacta", relative_precision: "1:∞" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["exacta", "finita"]);
  });

  it("coloca los procesos sin precisión al final", () => {
    const lista = [
      proc({ id: "sin", relative_precision: null }),
      proc({ id: "con", relative_precision: "1:5000" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["con", "sin"]);
  });

  it("ordena por nombre alfabéticamente respetando el español", () => {
    const lista = [
      proc({ id: "b", name: "Ñandú" }),
      proc({ id: "a", name: "Norte" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "nombre", dir: "asc" });
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("invierte el orden con dir ascendente", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, dir: "asc" });
    expect(r.map((p) => p.id)).toEqual(["viejo", "nuevo"]);
  });

  it("desempata de forma determinista cuando dos precisiones son 1:∞ (caso real del seed)", () => {
    const lista = [
      proc({ id: "b", relative_precision: "1:∞" }),
      proc({ id: "a", relative_precision: "1:∞" }),
    ];
    const primero = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" }).map(
      (p) => p.id,
    );
    const segundo = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" }).map(
      (p) => p.id,
    );
    expect(primero).toEqual(segundo);
    expect(primero).toEqual(["a", "b"]);
  });

  it("desempata de forma determinista cuando dos updated_at son idénticos", () => {
    const lista = [
      proc({ id: "b", updated_at: "2026-07-10T00:00:00Z" }),
      proc({ id: "a", updated_at: "2026-07-10T00:00:00Z" }),
    ];
    const primero = filterProcesses(lista, SIN_FILTRO).map((p) => p.id);
    const segundo = filterProcesses(lista, SIN_FILTRO).map((p) => p.id);
    expect(primero).toEqual(segundo);
    expect(primero).toEqual(["a", "b"]);
  });

  it("no altera el arreglo recibido", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    filterProcesses(lista, SIN_FILTRO);
    expect(lista.map((p) => p.id)).toEqual(["viejo", "nuevo"]);
  });
});

describe("countByStatus", () => {
  it("cuenta cada grupo y el total", () => {
    const lista = [
      proc({ status: "draft" }),
      proc({ status: "in_progress" }),
      proc({ status: "calculated" }),
      proc({ status: "closed" }),
      proc({ status: "rejected" }),
    ];
    expect(countByStatus(lista)).toEqual({
      todos: 5,
      borradores: 2,
      calculados: 1,
      cerrados: 1,
      rechazados: 1,
    });
  });

  it("devuelve ceros con una lista vacía", () => {
    expect(countByStatus([])).toEqual({
      todos: 0,
      borradores: 0,
      calculados: 0,
      cerrados: 0,
      rechazados: 0,
    });
  });
});
