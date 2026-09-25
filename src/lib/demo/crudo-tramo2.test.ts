import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRUDO_TRAMO2 } from "./crudo-tramo2";

describe("CRUDO_TRAMO2", () => {
  it("es idéntico al archivo de docs/carteras, byte a byte", () => {
    const original = readFileSync(join(process.cwd(), "docs/carteras/CRDUDO-TRAMO2.L"), "latin1");
    expect(CRUDO_TRAMO2).toBe(original);
  });
});
