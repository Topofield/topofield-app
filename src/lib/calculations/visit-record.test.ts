import { describe, expect, it } from "vitest";
import { recalculateSite, visitRecordOf } from "./visit-record";
import { thresholdsFor } from "./tolerances";
import type { BookRowPayload, PointInput } from "@/types/settlement";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  bd: number | null = null, fd: number | null = null, startsSection = false): BookRowPayload {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: bd, foreDistanceM: fd, startsSection };
}
const point = (code: string, initialElevation: number | null = null): PointInput =>
  ({ id: code, code, initialElevation, activeFrom: null, retiredOn: null });
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];

describe("el registro de una visita", () => {
  it("un circuito cerrado: segundo orden, sin compensar, calculada", () => {
    const rec = visitRecordOf({ visitId: "v12", date: "2025-10-14", rows: alameda12, points: [point("TA-01"), point("TA-08")], benchmarks: BMS });
    expect(rec.header).toEqual({
      reference_bm_code: "BM-1", reference_bm_elevation: 100,
      closure_error_mm: -1.6, tolerance_mm: 2, meets_tolerance: true, total_distance_km: 0.113,
      precision_order: "segundo_orden", status: "calculated",
    });
    expect(rec.elevations.map((e) => [e.pointId, e.elevation])).toEqual([["TA-01", 100.5955], ["TA-08", 100.5836]]);
    expect(rec.rows.map((x) => x.starts_section)).toEqual([true, false, false, false, false]);
    expect(rec.rows.every((x) => x.elevation_corrected === x.elevation_calculated)).toBe(true);
  });

  it("la cartera: una armada sin cierre, sin verificación", () => {
    const rows = [r("PISCINA/BM", "bm", 1.45, null, null, null, true), r("B10", "intermediate", null, 4.12)];
    const rec = visitRecordOf({ visitId: "v3", date: "2022-04-12", rows, points: [point("B10")], benchmarks: [{ code: "PISCINA/BM", elevation: 156.299 }] });
    expect(rec.header).toMatchObject({
      reference_bm_code: "PISCINA/BM", closure_error_mm: null, tolerance_mm: null,
      meets_tolerance: null, precision_order: null, status: "calculated",
    });
    expect(rec.elevations).toEqual([{ pointId: "B10", elevation: 153.629, rowIndex: 1 }]);
  });

  it("una fila por leer se guarda sin cota y deja la visita en medición", () => {
    const rows = [r("PISCINA/BM", "bm", 1.45, null, null, null, true), r("B10", "intermediate", null, null)];
    const rec = visitRecordOf({ visitId: "v3", date: "2022-04-12", rows, points: [point("B10")], benchmarks: [{ code: "PISCINA/BM", elevation: 156.299 }] });
    expect(rec.header.status).toBe("in_progress");
    expect(rec.rows[1]!.elevation_calculated).toBeNull();
    expect(rec.elevations).toEqual([]);
  });
});

describe("el recálculo del lugar", () => {
  const visits = [
    { id: "v1", visitNumber: 1, date: "2025-01-07", rows: [r("BM-1", "bm", 1.5, null, null, null, true), r("TA-01", "intermediate", null, 1.0)] },
    { id: "v2", visitNumber: 2, date: "2025-02-07", rows: [r("BM-1", "bm", 1.5, null, null, null, true), r("TA-01", "intermediate", null, 1.002)] },
  ];
  const thresholds = thresholdsFor("edificio");

  it("cambiar la cota de un BM mueve las cotas; sin C0 tecleada, los asentamientos no", () => {
    const before = recalculateSite({ points: [point("TA-01")], benchmarks: BMS, thresholds, visits });
    const after = recalculateSite({ points: [point("TA-01")], benchmarks: [{ code: "BM-1", elevation: 100.01 }], thresholds, visits });
    expect(before[1]!.readings[0]).toMatchObject({ elevation: 100.498, accumulatedSettlement: -2 });
    expect(after[1]!.readings[0]).toMatchObject({ elevation: 100.508, accumulatedSettlement: -2 });
  });

  it("con C0 tecleada, el cambio del BM sí se ve en el acumulado", () => {
    const after = recalculateSite({ points: [point("TA-01", 100.5)], benchmarks: [{ code: "BM-1", elevation: 100.01 }], thresholds, visits });
    expect(after[1]!.readings[0]!.accumulatedSettlement).toBe(8);
  });

  it("una visita sin libreta entra al histórico con sus cotas guardadas", () => {
    const sinLibreta = { id: "v1", visitNumber: 1, date: "2025-01-07", rows: [], elevations: [{ pointId: "TA-01", elevation: 100.5 }] };
    const res = recalculateSite({ points: [point("TA-01")], benchmarks: BMS, thresholds, visits: [sinLibreta, visits[1]!] });
    expect(res[1]!.readings[0]).toMatchObject({ elevation: 100.498, partialSettlement: -2 });
  });
});
