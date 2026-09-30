import { describe, expect, it } from "vitest";
import { countGroupOf, NO_PROCESSES, processCountsLabel } from "./process-counts";

// Fase 24: la tarjeta del proyecto desglosa sus procesos por estado.

describe("processCountsLabel", () => {
  it("el total y cada grupo con su número", () => {
    expect(processCountsLabel({ open: 3, closed: 2, rejected: 1 })).toBe(
      "6 procesos · 3 en curso · 2 cerrados · 1 rechazado",
    );
  });

  it("singulares y grupos en cero omitidos", () => {
    expect(processCountsLabel({ open: 0, closed: 1, rejected: 0 })).toBe("1 proceso · 1 cerrado");
    expect(processCountsLabel({ open: 1, closed: 0, rejected: 2 })).toBe(
      "3 procesos · 1 en curso · 2 rechazados",
    );
  });

  it("sin procesos", () => {
    expect(processCountsLabel(NO_PROCESSES)).toBe("0 procesos");
  });
});

describe("countGroupOf", () => {
  it("cerrado y rechazado aparte; lo demás, en curso", () => {
    expect(countGroupOf("closed")).toBe("closed");
    expect(countGroupOf("rejected")).toBe("rejected");
    for (const status of ["draft", "in_progress", "calculated", "active"]) {
      expect(countGroupOf(status)).toBe("open");
    }
  });
});
