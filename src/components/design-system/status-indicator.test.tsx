import { describe, expect, it } from "vitest";
import { SEMAPHORE_SHAPES } from "./status-indicator";

describe("SEMAPHORE_SHAPES", () => {
  it("da una forma distinta a cada uno de los 4 niveles", () => {
    const formas = Object.values(SEMAPHORE_SHAPES);
    expect(formas).toHaveLength(4);
    expect(new Set(formas).size).toBe(4);
  });

  it("cubre exactamente los 4 niveles de alerta", () => {
    expect(Object.keys(SEMAPHORE_SHAPES).sort()).toEqual([
      "alarm",
      "alert",
      "caution",
      "normal",
    ]);
  });
});
