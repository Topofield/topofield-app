import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LevelingReportSection } from "@/components/reports/sections/leveling-section";
import { NIVELACION_VERJON, nivelacionTramo2, type LecturaNivelacionDemo, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { LevelingProcess, LevelingReading } from "@/types/leveling";
import { levelingSectionData } from "./leveling-data";
import type { ReportSection } from "./sections";
import { precisionSummaryRows } from "./summary";

// Fase 36: el informe sencillo de la nivelación, por tipo, con el orden
// detectado; la sección es la misma en la pestaña y en el consolidado.

function filas(run: "forward" | "return", rows: LecturaNivelacionDemo[]): LevelingReading[] {
  return rows.map(
    (r, i) =>
      ({
        id: `${run}-${i}`,
        run_type: run,
        reading_order: i + 1,
        point_code: r.code,
        point_type: r.type,
        backsight: r.back ?? null,
        foresight: r.fore ?? null,
        back_upper_m: null,
        back_lower_m: null,
        fore_upper_m: null,
        fore_lower_m: null,
        back_distance_m: r.backDistanceM ?? null,
        fore_distance_m: r.foreDistanceM ?? null,
      }) as unknown as LevelingReading,
  );
}

function datos(
  n: NivelacionDemo,
  { sinVuelta = false, ida = n.forward, ...over }: { sinVuelta?: boolean; ida?: LecturaNivelacionDemo[] } & Partial<LevelingProcess> = {},
) {
  const vuelta = n.return && !sinVuelta ? n.return : null;
  const process = {
    id: "l1",
    project_id: "p1",
    name: n.name,
    type: n.type,
    status: "calculated",
    start_bm_code: n.startBmCode,
    start_bm_elevation: n.startElevation,
    end_bm_code: n.endBmCode ?? null,
    end_bm_elevation: n.endElevation ?? null,
    has_return_run: vuelta != null,
    location: null,
    responsible_name: null,
    responsible_role: null,
    equipment_brand: null,
    equipment_model: null,
    equipment_serial: null,
    notes: null,
    updated_at: "2026-10-06T00:00:00Z",
    ...over,
  } as unknown as LevelingProcess;
  return levelingSectionData(process, [...filas("forward", ida), ...(vuelta ? filas("return", vuelta) : [])]);
}

const seccion = (data: ReturnType<typeof datos>): ReportSection => ({
  kind: "leveling",
  entry: { type: "leveling", id: "l1", name: "Nivelación", order: 0 },
  data,
});
const html = (data: ReturnType<typeof datos>) => renderToStaticMarkup(createElement(LevelingReportSection, { data }));

const verjon = datos(NIVELACION_VERJON);
const tramo2 = datos(nivelacionTramo2());
// La ida de El Verjón, como si D4 fuera un BM de cota conocida (el lienzo).
const enlace = datos(NIVELACION_VERJON, { sinVuelta: true, type: "link", end_bm_code: "D4", end_bm_elevation: 3315.0855 });

describe("el resumen de precisión de una nivelación (Fase 36)", () => {
  it("la abierta con vuelta, por la discrepancia y el orden detectado", () => {
    const [row] = precisionSummaryRows([seccion(verjon)]);
    expect(row).toMatchObject({ precision: "Δ 5.0 mm · Segundo orden", cumple: true });
  });

  it("la cerrada, por su cierre", () => {
    const [row] = precisionSummaryRows([seccion(tramo2)]);
    expect(row).toMatchObject({ precision: "-0.4 mm · Primer orden", cumple: true });
  });

  it("la abierta sin vuelta no tiene verificación", () => {
    const [row] = precisionSummaryRows([seccion(datos(NIVELACION_VERJON, { sinVuelta: true }))]);
    expect(row).toMatchObject({ precision: "Sin verificación", cumple: null });
  });

  it("una libreta a medias lo dice", () => {
    const aMedias = datos(nivelacionTramo2(), { ida: nivelacionTramo2().forward.slice(0, 5) });
    expect(aMedias.pending).toBe("forward");
    const [row] = precisionSummaryRows([seccion(aMedias)]);
    expect(row).toMatchObject({ precision: "Libreta a medias", cumple: null });
  });
});

describe("la sección del informe, por tipo (Fase 36)", () => {
  it("abierta con vuelta: veredicto, las dos libretas, ida y vuelta ajustadas y el gráfico", () => {
    const out = html(verjon);
    expect(out).toContain("Alcanza segundo orden.");
    expect(out).toContain("no en la de primer orden (2.6 mm)");
    expect(out).toContain("1. Datos iniciales");
    expect(out).toContain("2. Datos ajustados");
    expect(out).toContain("3. Ida, vuelta y ajustada");
    expect(out).toContain("Cota vuelta");
    expect(out).toContain("3289.4400");
    expect(out).not.toMatch(/adoptada/i);
  });

  it("cerrada: los puntos leídos dos veces con sus dos lecturas", () => {
    const out = html(tramo2);
    expect(out).toContain("Alcanza primer orden.");
    expect(out).toContain("cabe en la tolerancia más exigente");
    expect(out).toContain("1.ª lectura");
    expect(out).toContain("2.ª lectura");
    expect(out).toContain("3. Medido y ajustada");
  });

  it("de enlace: la corrección de cada punto hasta la cota de llegada", () => {
    const out = html(enlace);
    expect(out).toContain("Alcanza segundo orden.");
    expect(out).toContain("no en la de primer orden (1.9 mm)");
    expect(out).toContain("Corrección (mm)");
    expect(out).toContain("3315.0855");
  });

  it("abierta sin vuelta: sin verificación y sin datos ajustados", () => {
    const out = html(datos(NIVELACION_VERJON, { sinVuelta: true }));
    expect(out).toContain("Sin verificación.");
    expect(out).toContain("1. Datos iniciales");
    expect(out).not.toContain("2. Datos ajustados");
  });

  it("fuera de todo orden, compensa y lo alerta", () => {
    const fuera = datos(NIVELACION_VERJON, { sinVuelta: true, type: "link", end_bm_code: "D4", end_bm_elevation: 3315.2 });
    expect(fuera.order).toBeNull();
    expect(html(fuera)).toContain("No alcanza ningún orden.");
  });
});
