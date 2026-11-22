import { describe, expect, it } from "vitest";
import {
  INVITE_ALPHABET,
  formatInviteCode,
  generateInviteCode,
  isWellFormedInviteCode,
  normalizeInviteCode,
} from "./invite-code";

describe("el código de invitación", () => {
  it("el alfabeto no tiene caracteres que se confundan", () => {
    for (const c of "0O1IL") expect(INVITE_ALPHABET).not.toContain(c);
    expect(INVITE_ALPHABET).toHaveLength(31);
  });

  it("sale con ocho caracteres del alfabeto", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateInviteCode();
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      expect(isWellFormedInviteCode(c)).toBe(true);
    }
  });

  it("dos seguidos difieren", () => {
    expect(generateInviteCode()).not.toBe(generateInviteCode());
  });

  it("descarta los bytes que sesgarían el reparto", () => {
    // 248 y más se descartan; 0 → «A», 31 → «A», 30 → «9».
    let llamada = 0;
    const bytes = (n: number) => {
      llamada += 1;
      return llamada === 1
        ? Uint8Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 250 : 30))
        : new Uint8Array(n);
    };
    expect(generateInviteCode(bytes)).toBe("99999999");
  });

  it("se normaliza como lo hace la base", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ab cd\tef-gh")).toBe("ABCDEFGH");
  });

  it("reconoce la forma con o sin guion, en cualquier caja", () => {
    expect(isWellFormedInviteCode("abcd-efgh")).toBe(true);
    expect(isWellFormedInviteCode("ABCDEFG")).toBe(false);
    expect(isWellFormedInviteCode("ABCD-EFG0")).toBe(false);
    expect(isWellFormedInviteCode("ABCD-EFGL")).toBe(false);
  });

  it("se muestra en dos grupos", () => {
    expect(formatInviteCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(formatInviteCode("abcd-efgh")).toBe("ABCD-EFGH");
  });
});
