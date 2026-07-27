import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Vitest cubre los módulos de cálculo de src/lib/calculations/, que son
// funciones puras de TypeScript (sin React ni Supabase). El alias `@` replica
// el de tsconfig.json para que los tests importen con la misma ruta que la app.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
