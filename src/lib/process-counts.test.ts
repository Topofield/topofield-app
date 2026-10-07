import { describe, expect, it } from "vitest";
import { NO_PROCESSES, processCountsLabel } from "./process-counts";

// Fase 24: la tarjeta del proyecto desglosaba sus procesos por estado. Desde
// la Fase 37 nada se cierra: solo queda el total.

describe("processCountsLabel", () => {
  it("el total, en plural o en singular", () => {
    expect(processCountsLabel({ total: 6 })).toBe("6 procesos");
    expect(processCountsLabel({ total: 1 })).toBe("1 proceso");
  });

  it("sin procesos", () => {
    expect(processCountsLabel(NO_PROCESSES)).toBe("0 procesos");
  });
});
