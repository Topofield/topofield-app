// Fase 35, revisión final: un guardado que falla por la red o por un 500
// rechaza la promesa de la Server Action. Sin capturarlo, React lo lleva al
// límite de error, la página se reemplaza y el popup pierde lo tecleado.
import { describe, expect, it } from "vitest";
import { callAction, NETWORK_ERROR } from "./action-call";

describe("callAction", () => {
  it("devuelve la respuesta de la acción tal cual", async () => {
    await expect(callAction(async () => ({ ok: true }))).resolves.toEqual({ ok: true });
    await expect(callAction(async () => ({ ok: false, error: "Falta el título." }))).resolves.toEqual({
      ok: false,
      error: "Falta el título.",
    });
  });

  it("un rechazo de red o del servidor vuelve como error, sin lanzar", async () => {
    await expect(
      callAction(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).resolves.toEqual({ ok: false, error: NETWORK_ERROR });
  });

  it("deja pasar las señales de navegación de Next (redirect, notFound)", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    await expect(
      callAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});
