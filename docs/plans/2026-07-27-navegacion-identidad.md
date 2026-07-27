# Navegación e identidad visual — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** Dar a TopoField una navegación con sentido de ubicación y una
identidad visual propia, sin sacrificar la legibilidad de una herramienta densa
en datos.

**Arquitectura:** Un componente de migas de pan nuevo, consumido por cada página
bajo el dashboard, sustituye los cuatro enlaces «← Volver» dispersos. La
identidad se introduce por tokens en `globals.css` y una fuente autohospedada vía
`next/font`, de modo que el cambio se propague sin tocar cada componente.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
`next/font/google` · Vitest

**Spec:** [`docs/specs/2026-07-27-navegacion-identidad-design.md`](../specs/2026-07-27-navegacion-identidad-design.md)

## Restricciones globales

- Los archivos de `src/lib/calculations/` son funciones puras: sin React, sin
  hooks, sin Supabase. No se tocan en este plan.
- Los procesos con status `closed` o `rejected` son inmutables. Ningún cambio de
  este plan puede abrir una vía de escritura sobre ellos.
- Prohibido shadcn/ui o cualquier librería de componentes o de iconos. El sistema
  de diseño propio está en `src/components/design-system/` sobre Tailwind v4 puro.
- Prohibidas las peticiones a terceros en tiempo de ejecución. La fuente se
  autohospeda vía `next/font/google`, que la descarga durante el build.
- Los SVG se escriben a mano, inline. Sin dependencias de iconos.
- Todo elemento decorativo lleva `aria-hidden` y no aporta significado.
- Contraste WCAG AA: 4.5:1 en texto normal, 3:1 en texto grande.
- `prefers-reduced-motion` se respeta en toda transición.
- Idioma de interfaz: español (Colombia). Zona horaria America/Bogota.
- Cambios mínimos: no refactorizar código ajeno a la tarea.
- Commits en español con prefijo `feat:`, `fix:`, `refactor:` o `docs:`.
- Ejecutar `npm run typecheck`, `npm run lint` y `npm run test` tras cada tarea.

---

### Tarea 1: Componente de migas de pan

Base de toda la navegación. Las tareas 2 y 3 lo consumen.

**Archivos:**
- Crear: `src/components/design-system/breadcrumbs.tsx`
- Modificar: `src/components/design-system/index.ts`
- Test: `src/components/design-system/breadcrumbs.test.tsx`

**Interfaces:**
- Produce: `<Breadcrumbs items={BreadcrumbItem[]} />` con
  `BreadcrumbItem = { label: string; href?: string }`. El último elemento se
  renderiza como texto con `aria-current="page"`, nunca como enlace, tenga `href`
  o no. Las tareas 2 y 3 la consumen.
- Produce: `resolveBreadcrumbs(items)`, función pura exportada del mismo archivo,
  que decide qué elemento es el actual y cuál es el anterior. Es lo que se testea.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/components/design-system/breadcrumbs.test.tsx`. El proyecto usa Vitest
sin jsdom, así que se testea la función pura de resolución, no el render.

```tsx
import { describe, expect, it } from "vitest";
import { resolveBreadcrumbs } from "./breadcrumbs";

describe("resolveBreadcrumbs", () => {
  it("marca el último elemento como actual y sin enlace", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Lote catastral", href: "/projects/1" },
      { label: "Cuadrado con error", href: "/projects/1/polygonal/2" },
    ]);
    expect(r.trail).toHaveLength(3);
    expect(r.trail[2].current).toBe(true);
    expect(r.trail[2].href).toBeUndefined();
    expect(r.trail[0].current).toBe(false);
    expect(r.trail[0].href).toBe("/dashboard");
  });

  it("expone el nivel anterior para el retorno móvil", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Lote catastral", href: "/projects/1" },
      { label: "Nueva poligonal" },
    ]);
    expect(r.parent).toEqual({ label: "Lote catastral", href: "/projects/1" });
  });

  it("no devuelve nivel anterior cuando solo hay un elemento", () => {
    const r = resolveBreadcrumbs([{ label: "Dashboard", href: "/dashboard" }]);
    expect(r.parent).toBeNull();
    expect(r.trail[0].current).toBe(true);
  });

  it("ignora elementos vacíos sin romper la ruta", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "", href: "/projects/1" },
      { label: "Proceso" },
    ]);
    expect(r.trail).toHaveLength(2);
    expect(r.trail[1].label).toBe("Proceso");
  });
});
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run src/components/design-system/breadcrumbs.test.tsx
```

Esperado: FAIL — no existe el módulo `./breadcrumbs`.

- [ ] **Paso 3: Implementar el componente**

Crear `src/components/design-system/breadcrumbs.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ResolvedItem extends BreadcrumbItem {
  current: boolean;
}

export interface ResolvedBreadcrumbs {
  trail: ResolvedItem[];
  /** Nivel anterior al actual, para el retorno en móvil. */
  parent: BreadcrumbItem | null;
}

/** Decide qué elemento es el actual y cuál el anterior. Función pura. */
export function resolveBreadcrumbs(
  items: BreadcrumbItem[],
): ResolvedBreadcrumbs {
  const clean = items.filter((i) => i.label.trim() !== "");
  const trail = clean.map((item, i) => {
    const isLast = i === clean.length - 1;
    return {
      label: item.label,
      href: isLast ? undefined : item.href,
      current: isLast,
    };
  });
  const parent = clean.length > 1 ? clean[clean.length - 2] : null;
  return { trail, parent: parent ?? null };
}

/**
 * Ruta de navegación entre los tres niveles de la aplicación
 * (dashboard → proyecto → proceso). En móvil se reduce al retorno al nivel
 * anterior, que es el control que hace falta en pantalla pequeña.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const { trail, parent } = resolveBreadcrumbs(items);
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className={cn("min-w-0", className)}>
      {/* Móvil: solo el retorno al nivel anterior. */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 sm:hidden"
        >
          <span aria-hidden>‹</span>
          <span className="truncate">{parent.label}</span>
        </Link>
      )}

      {/* Escritorio: ruta completa. */}
      <ol className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        {trail.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-neutral-200">
                ›
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                title={item.label}
                className="max-w-[16rem] truncate text-neutral-500 transition-colors hover:text-primary-600"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                title={item.label}
                className="max-w-[20rem] truncate font-medium text-neutral-900"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Paso 4: Exportarlo desde el índice del sistema de diseño**

En `src/components/design-system/index.ts`, añadir en orden alfabético (después
de la línea de `Badge`):

```ts
export { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
```

- [ ] **Paso 5: Ejecutar el test y verificar que pasa**

```bash
npx vitest run src/components/design-system/breadcrumbs.test.tsx
```

Esperado: PASS, 4 tests.

- [ ] **Paso 6: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores.

- [ ] **Paso 7: Commit**

```bash
git add src/components/design-system/breadcrumbs.tsx src/components/design-system/breadcrumbs.test.tsx src/components/design-system/index.ts
git commit -m "feat(ds): componente de migas de pan"
```

---

### Tarea 2: Migas en las cuatro pantallas

Sustituye los enlaces «← Volver» dispersos. El hub del proyecto, que hoy no tiene
retorno alguno, gana el suyo.

**Archivos:**
- Modificar: `src/app/(app)/projects/[id]/page.tsx`
- Modificar: `src/app/(app)/projects/new/page.tsx`
- Modificar: `src/app/(app)/projects/[id]/polygonal/new/page.tsx`
- Modificar: `src/components/polygonal/polygonal-editor.tsx`

**Interfaces:**
- Consume: `<Breadcrumbs items={[…]} />` y `BreadcrumbItem` de la Tarea 1.

- [ ] **Paso 1: Hub del proyecto**

En `src/app/(app)/projects/[id]/page.tsx`, añadir `Breadcrumbs` al import
existente de `@/components/design-system` (que ya trae `EmptyState`, `Tabs` y
`type TabItem`).

Luego, dentro del `return`, insertar como primer hijo del contenedor, antes de
`<ProjectHeader project={project} />` (línea ~90):

```tsx
<Breadcrumbs
  items={[
    { label: "Dashboard", href: "/dashboard" },
    { label: project.name },
  ]}
/>
```

- [ ] **Paso 2: Nuevo proyecto**

En `src/app/(app)/projects/new/page.tsx`, localizar el enlace «← Volver al
dashboard» (línea ~12) y reemplazarlo por:

```tsx
<Breadcrumbs
  items={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Nuevo proyecto" },
  ]}
/>
```

Añadir `Breadcrumbs` al import de `@/components/design-system`. Si al quitar el
enlace queda un import de `Link` sin uso, eliminarlo.

- [ ] **Paso 3: Nueva poligonal**

En `src/app/(app)/projects/[id]/polygonal/new/page.tsx`, reemplazar el enlace
«← Volver al proyecto» (línea ~20) por:

```tsx
<Breadcrumbs
  items={[
    { label: "Dashboard", href: "/dashboard" },
    { label: project.name, href: `/projects/${project.id}` },
    { label: "Nueva poligonal" },
  ]}
/>
```

Leer el archivo primero: si la variable del proyecto no se llama `project` o no
está disponible, usar la que exista. Si no hay datos del proyecto en esa página,
cargarlos con `getProjectById` siguiendo el patrón del hub, o —si eso complica la
página— usar `{ label: "Proyecto", href: \`/projects/${id}\` }`. Dejar constancia
de la decisión en el informe.

- [ ] **Paso 4: Editor de poligonal**

En `src/components/polygonal/polygonal-editor.tsx`, el bloque del encabezado
(líneas ~228-245) contiene el enlace «← Volver al proyecto». Reemplazar ese
`<Link>` por las migas.

El editor recibe `projectId` pero **no** el nombre del proyecto. Añadir una prop
nueva `projectName: string` a `PolygonalEditorProps` y pasarla desde la página
que lo renderiza (`src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx`), que sí
tiene el proyecto cargado. Leer esa página antes de editar.

El bloque queda:

```tsx
<div>
  <Breadcrumbs
    items={[
      { label: "Dashboard", href: "/dashboard" },
      { label: projectName, href: `/projects/${projectId}?tab=processes` },
      { label: process.name },
    ]}
  />
  <div className="mt-2 flex items-center justify-between gap-4">
    <h1 className="text-2xl font-bold text-neutral-900">{process.name}</h1>
    <Badge tone={STATUS_TONE[process.status]}>
      {PROCESS_STATUS_LABELS[process.status]}
    </Badge>
  </div>
</div>
```

Añadir `Breadcrumbs` al import de `@/components/design-system` y eliminar el
import de `Link` si queda sin uso.

- [ ] **Paso 5: Verificar que no queda ningún «Volver» huérfano**

```bash
grep -rn "Volver al" src/ --include=*.tsx
```

Esperado: solo `src/app/(app)/projects/[id]/not-found.tsx`, que es una pantalla de
error sin jerarquía y conserva su enlace directo.

- [ ] **Paso 6: Verificar tipos, lint y tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores; 36 tests (32 previos + 4 de la Tarea 1).

- [ ] **Paso 7: Verificar en la aplicación**

Con el dev server en http://localhost:3000 y sesión iniciada
(`seed@topofield.local` / `seed1234`), recorrer: dashboard → proyecto → proceso.

Confirmar que cada pantalla muestra su ruta, que los niveles intermedios navegan,
que el último no es enlace, y que a 375 px se ve el retorno «‹ …» en vez de la
ruta completa.

Los IDs cambian con cada `db reset`; consultarlos con:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select id, project_id, name, status from public.polygonal_processes;"
```

- [ ] **Paso 8: Commit**

```bash
git add src/app/\(app\)/projects src/components/polygonal/polygonal-editor.tsx
git commit -m "feat(nav): migas de pan en lugar de enlaces de retorno dispersos"
```

---

### Tarea 3: Las pestañas preservan la consulta

Sin esto, el listado de procesos (spec siguiente) pierde su filtro al cambiar de
pestaña y volver.

**Archivos:**
- Modificar: `src/components/design-system/tabs.tsx`
- Modificar: `src/app/(app)/projects/[id]/page.tsx`
- Test: `src/components/design-system/tabs.test.ts`

**Interfaces:**
- Produce: `tabHref(basePath, tabId, searchParams)`, función pura exportada de
  `tabs.tsx`, que construye el destino conservando los parámetros existentes.
- Modifica: `<Tabs>` acepta una prop opcional nueva
  `searchParams?: Record<string, string | undefined>`. Sin ella se comporta como
  hoy.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/components/design-system/tabs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tabHref } from "./tabs";

describe("tabHref", () => {
  it("conserva los demás parámetros al cambiar de pestaña", () => {
    const href = tabHref("/projects/1", "config", {
      tab: "processes",
      q: "cuadrado",
      estado: "calculated",
    });
    expect(href).toContain("tab=config");
    expect(href).toContain("q=cuadrado");
    expect(href).toContain("estado=calculated");
  });

  it("funciona sin parámetros previos", () => {
    expect(tabHref("/projects/1", "reports", undefined)).toBe(
      "/projects/1?tab=reports",
    );
  });

  it("reemplaza el tab anterior en vez de duplicarlo", () => {
    const href = tabHref("/projects/1", "config", { tab: "processes" });
    expect(href.match(/tab=/g)).toHaveLength(1);
    expect(href).toContain("tab=config");
  });

  it("descarta parámetros vacíos", () => {
    const href = tabHref("/projects/1", "config", { q: undefined, estado: "" });
    expect(href).toBe("/projects/1?tab=config");
  });
});
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run src/components/design-system/tabs.test.ts
```

Esperado: FAIL — `tabHref` no está exportada.

- [ ] **Paso 3: Implementar `tabHref` y usarla en `Tabs`**

En `src/components/design-system/tabs.tsx`, añadir antes del componente:

```ts
/** Destino de una pestaña, conservando los demás parámetros de la consulta. */
export function tabHref(
  basePath: string,
  tabId: string,
  searchParams?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key !== "tab" && value != null && value !== "") {
      params.set(key, value);
    }
  }
  params.set("tab", tabId);
  return `${basePath}?${params.toString()}`;
}
```

Añadir la prop a `TabsProps`:

```ts
interface TabsProps {
  items: TabItem[];
  activeId: string;
  /** Ruta base; cada tab enlaza a `${basePath}?tab=${id}`. */
  basePath: string;
  /** Parámetros actuales, para no perderlos al cambiar de pestaña. */
  searchParams?: Record<string, string | undefined>;
}
```

Y en el componente, reemplazar el `href` literal por la función:

```tsx
href={tabHref(basePath, item.id, searchParams)}
```

Recordar añadir `searchParams` a la desestructuración de props.

- [ ] **Paso 4: Ejecutar el test y verificar que pasa**

```bash
npx vitest run src/components/design-system/tabs.test.ts
```

Esperado: PASS, 4 tests.

- [ ] **Paso 5: Pasar los parámetros desde el hub**

En `src/app/(app)/projects/[id]/page.tsx`, la firma de `searchParams` es hoy
`Promise<{ tab?: string }>`. Ampliarla para admitir cualquier parámetro:

```ts
interface ProjectHubPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}
```

En el cuerpo, sustituir `const { tab } = await searchParams;` por:

```ts
const sp = await searchParams;
const tab = sp.tab;
```

Y pasar los parámetros al componente:

```tsx
<Tabs
  items={TABS}
  activeId={activeTab}
  basePath={`/projects/${project.id}`}
  searchParams={sp}
/>
```

- [ ] **Paso 6: Verificar tipos, lint y tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores; 40 tests.

- [ ] **Paso 7: Verificar el comportamiento**

Abrir `/projects/<id>?tab=processes&q=prueba`, cambiar a la pestaña
«Configuración» y confirmar que la URL conserva `q=prueba`.

- [ ] **Paso 8: Commit**

```bash
git add src/components/design-system/tabs.tsx src/components/design-system/tabs.test.ts "src/app/(app)/projects/[id]/page.tsx"
git commit -m "fix(ds): las pestañas conservan los parametros de consulta"
```

---

### Tarea 4: Tipografía de títulos y color de marca

El cambio de mayor efecto visual. Se hace por tokens para que se propague sin
tocar cada componente.

**Archivos:**
- Modificar: `src/app/layout.tsx`
- Modificar: `src/app/globals.css`

**Interfaces:**
- Produce: la variable CSS `--font-display`, disponible como clase
  `font-display` de Tailwind, y la regla base que aplica esa familia y el color
  de marca a `h1`–`h3`. Las tareas 5 y 6 asumen que existe.

- [ ] **Paso 1: Cargar Space Grotesk con `next/font`**

En `src/app/layout.tsx`, añadir el import y la instancia. `next/font/google`
descarga la fuente durante el build y la autohospeda: no hay peticiones a
terceros en tiempo de ejecución.

```tsx
import { Space_Grotesk } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display-src",
  display: "swap",
});
```

El nombre `--font-display-src` es deliberado: el token del tema se llamará
`--font-display` y envolverá esta variable con sus alternativas, así que deben
ser distintos para no colisionar.

Y aplicar la variable al `<html>`:

```tsx
<html
  lang="es-CO"
  className={`h-full ${display.variable}`}
  suppressHydrationWarning
>
```

- [ ] **Paso 2: Registrar la familia y el color en el tema**

En `src/app/globals.css`, dentro del bloque `@theme`, junto a `--font-mono`:

```css
  --font-display: var(--font-display-src), ui-sans-serif, system-ui, sans-serif;
```

Esto hace que Tailwind genere la clase `font-display`, que la Tarea 5 usa en el
logotipo.

- [ ] **Paso 3: Aplicar a los títulos**

En `src/app/globals.css`, después de la regla de `body`, añadir:

```css
h1,
h2,
h3 {
  font-family: var(--font-display);
  color: var(--color-primary-600);
  letter-spacing: -0.01em;
}
```

El color de marca en los títulos es el cambio de mayor efecto y menor riesgo:
tiñe toda la aplicación sin tocar la legibilidad del cuerpo.

- [ ] **Paso 4: Verificar el contraste**

`--color-primary-600` es `#0b3d5c` sobre fondo `#f8f9fa` (`neutral-50`) y sobre
blanco. Calcular el ratio de contraste de ambas combinaciones y confirmar que
superan 4.5:1.

Si alguna quedara por debajo, usar `--color-primary-700` (`#082d44`) en su lugar
y anotarlo en el informe. No dejar el criterio sin verificar.

- [ ] **Paso 5: Verificar tipos, lint, tests y build**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Esperado: los cuatro limpios. El build es imprescindible aquí: es donde
`next/font` descarga la fuente, y donde fallaría si no pudiera obtenerla.

- [ ] **Paso 6: Verificar en el navegador**

Comprobar con Playwright que un `h1` usa Space Grotesk y que el cuerpo sigue en
`system-ui`:

```js
await page.evaluate(() => ({
  h1: getComputedStyle(document.querySelector("h1")).fontFamily,
  body: getComputedStyle(document.body).fontFamily,
}));
```

Esperado: el primero contiene «Space Grotesk»; el segundo empieza por
`system-ui`.

Confirmar también en la pestaña de red que no hay peticiones a `fonts.gstatic.com`
ni a `fonts.googleapis.com` al cargar la página.

- [ ] **Paso 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(ds): tipografia Space Grotesk y color de marca en titulos"
```

---

### Tarea 5: Marca propia

**Archivos:**
- Crear: `src/components/design-system/logo.tsx`
- Crear: `src/app/icon.svg`
- Modificar: `src/components/design-system/index.ts`
- Modificar: `src/app/(app)/layout.tsx`
- Eliminar: `public/next.svg`, `public/vercel.svg`, `public/globe.svg`,
  `public/file.svg`, `public/window.svg`

**Interfaces:**
- Produce: `<Logo />` (isotipo + palabra) y `<LogoMark />` (solo isotipo), ambos
  desde `src/components/design-system/logo.tsx`.

- [ ] **Paso 1: Crear el isotipo**

El signo convencional de vértice geodésico en cartografía es un triángulo con el
punto de estación marcado en su centro. Crear
`src/components/design-system/logo.tsx`:

```tsx
import { cn } from "@/lib/utils/cn";

/** Isotipo: vértice geodésico — triángulo de control con su punto de estación. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** Marca completa: isotipo y palabra. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-6 w-6 text-primary-500" />
      <span className="font-display text-lg font-bold text-primary-700">
        TopoField
      </span>
    </span>
  );
}
```

- [ ] **Paso 2: Exportarlo**

En `src/components/design-system/index.ts`, en orden alfabético:

```ts
export { Logo, LogoMark } from "./logo";
```

- [ ] **Paso 3: Usarlo en el chrome**

En `src/app/(app)/layout.tsx`, sustituir el texto «TopoField» del enlace por el
componente, y darle tratamiento de control con foco visible:

```tsx
<Link
  href="/dashboard"
  aria-label="TopoField — ir al dashboard"
  className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
>
  <Logo />
</Link>
```

Añadir `Logo` al import de `@/components/design-system`, que ya trae `Button`.

- [ ] **Paso 4: Crear el favicon**

Crear `src/app/icon.svg`. App Router lo detecta por convención y genera las
etiquetas del documento automáticamente.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="5" fill="#0b3d5c"/>
  <path d="M12 5 19.5 19H4.5L12 5Z" stroke="#ffffff" stroke-width="1.75" stroke-linejoin="round"/>
  <circle cx="12" cy="14" r="2" fill="#ffffff"/>
</svg>
```

- [ ] **Paso 5: Eliminar los SVG por defecto de Next**

```bash
git rm public/next.svg public/vercel.svg public/globe.svg public/file.svg public/window.svg
```

Antes de eliminarlos, confirmar que ninguno se usa:

```bash
grep -rn "next.svg\|vercel.svg\|globe.svg\|file.svg\|window.svg" src/
```

Esperado: sin resultados. Si alguno se usa, no eliminarlo y anotarlo.

- [ ] **Paso 6: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Esperado: limpio. Comprobar en el navegador que el favicon aparece en la pestaña
y que el logotipo se ve en el header con foco visible al tabular.

- [ ] **Paso 7: Commit**

```bash
git add src/components/design-system/logo.tsx src/components/design-system/index.ts "src/app/(app)/layout.tsx" src/app/icon.svg
git commit -m "feat(ds): isotipo de vertice geodesico, logotipo y favicon"
```

---

### Tarea 6: Jerarquía de superficie y acento topográfico

El elemento distintivo del sistema. Se aplica con restricción deliberada: dos
lugares, no más.

**Archivos:**
- Modificar: `src/app/globals.css`
- Modificar: `src/components/projects/project-header.tsx`

**Interfaces:**
- Consume: el token `--font-display` de la Tarea 4.
- Produce: la clase utilitaria `.surface-canvas` (retícula de fondo) y el patrón
  de curvas de nivel embebido en `ProjectHeader`.

- [ ] **Paso 1: Retícula del lienzo**

En `src/app/globals.css`, después de la regla de `body`, añadir la retícula de
papel milimetrado. Debe ser apenas perceptible: si se nota como textura, está mal
calibrada.

```css
body {
  background-image:
    linear-gradient(to right, var(--color-neutral-200) 1px, transparent 1px),
    linear-gradient(to bottom, var(--color-neutral-200) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: center;
}
```

Nota: la regla de `body` existente usa `@apply bg-neutral-50 …`. Añadir estas
propiedades a esa misma regla, no crear una segunda que compita.

Si a simple vista la retícula resulta visible como textura, bajar la opacidad
usando `color-mix(in srgb, var(--color-neutral-200) 40%, transparent)` en lugar
del color pleno.

- [ ] **Paso 2: Curvas de nivel en el encabezado del proyecto**

En `src/components/projects/project-header.tsx`, el contenedor raíz es un `<div>`
con `rounded-lg border … p-6 shadow-sm`. Añadirle `relative overflow-hidden` y,
como primer hijo, el patrón decorativo:

```tsx
<svg
  aria-hidden="true"
  viewBox="0 0 200 120"
  className="pointer-events-none absolute -right-8 -top-6 h-40 w-64 text-primary-500 opacity-[0.04]"
  fill="none"
>
  <path d="M-10 90C30 90 40 60 80 60s50 30 90 30" stroke="currentColor" strokeWidth="2" />
  <path d="M-10 74C30 74 40 44 80 44s50 30 90 30" stroke="currentColor" strokeWidth="2" />
  <path d="M-10 58C30 58 40 28 80 28s50 30 90 30" stroke="currentColor" strokeWidth="2" />
  <path d="M-10 42C30 42 40 12 80 12s50 30 90 30" stroke="currentColor" strokeWidth="2" />
</svg>
```

Alude a la plancha topográfica sin competir con los datos. Es decorativo:
`aria-hidden` y `pointer-events-none`.

Comprobar que el contenido del encabezado (título, campos) queda por encima. Si
el SVG se superpone, envolver el contenido existente en un `<div className="relative">`.

- [ ] **Paso 3: Tercer nivel de superficie**

La spec define tres niveles: lienzo, panel y destacado. Los dos primeros ya
existen (fondo de página y `Card`); el tercero lo usa hoy `ClosureVerdict` como
caso particular.

No hace falta código nuevo: verificar que `ClosureVerdict`
(`src/components/polygonal/closure-verdict.tsx`) usa fondo teñido y borde del
color de estado, y dejar constancia en el informe de que el tercer nivel queda
representado por ese componente. **No modificarlo**: está revisado y otras partes
dependen de él.

- [ ] **Paso 4: Verificar contraste sobre la retícula**

La retícula está bajo todo el texto de la página. Confirmar que el texto sobre el
fondo sigue cumpliendo 4.5:1: al ser líneas de 1 px sobre `neutral-50`, el color
de fondo efectivo apenas cambia, pero debe comprobarse y no darse por supuesto.

- [ ] **Paso 5: Verificar tipos, lint, tests y build**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Esperado: los cuatro limpios.

- [ ] **Paso 6: Verificar visualmente**

Capturar el dashboard y el hub del proyecto. Confirmar que la retícula es apenas
perceptible, que las curvas de nivel se ven como textura y no como ilustración, y
que ningún texto perdió legibilidad.

- [ ] **Paso 7: Commit**

```bash
git add src/app/globals.css src/components/projects/project-header.tsx
git commit -m "feat(ds): reticula de lienzo y curvas de nivel en el encabezado"
```

---

### Tarea 7: Estados de interacción y carga

**Archivos:**
- Modificar: `src/app/globals.css`
- Crear: `src/app/(app)/dashboard/loading.tsx`
- Crear: `src/app/(app)/projects/[id]/loading.tsx`

**Interfaces:**
- Consume: los tokens de color existentes.

- [ ] **Paso 1: Foco visible coherente**

En `src/app/globals.css`, añadir una regla base para que ningún control quede sin
indicación de foco:

```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 0.25rem;
}
```

Comprobar que no entra en conflicto con los `focus-visible:ring-*` que ya usan
`Input`, `Select` y `DmsInput`. Si se duplica el indicador (anillo y contorno a la
vez), acotar la regla base con `:where(a, button, summary):focus-visible` para
que solo cubra los elementos que hoy no lo tienen.

- [ ] **Paso 2: Respetar `prefers-reduced-motion`**

Añadir en `src/app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Paso 3: Skeleton del dashboard**

Crear `src/app/(app)/dashboard/loading.tsx`. Debe tener la forma del contenido
que reemplaza: encabezado, tres KPI y una rejilla de proyectos.

```tsx
function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-100 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el dashboard…</span>
      <div className="flex items-center justify-between gap-4">
        <Block className="h-8 w-40" />
        <Block className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Block className="h-28" />
        <Block className="h-28" />
        <Block className="h-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Skeleton del hub del proyecto**

Crear `src/app/(app)/projects/[id]/loading.tsx`:

```tsx
function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-100 ${className}`} />;
}

export default function ProjectLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el proyecto…</span>
      <Block className="h-4 w-56" />
      <Block className="h-64" />
      <Block className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Block className="h-28" />
        <Block className="h-28" />
      </div>
    </div>
  );
}
```

- [ ] **Paso 5: Hover perceptible en las tarjetas de proceso**

En `src/components/projects/process-card.tsx`, el enlace usa hoy
`transition-colors hover:border-primary-200`, un cambio apenas visible. Añadir
cambio de fondo:

```tsx
className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
```

- [ ] **Paso 6: Verificar**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Esperado: los cuatro limpios.

Comprobar en el navegador: tabular por la interfaz y confirmar que todo control
muestra foco visible; pasar el cursor por una tarjeta y ver el cambio de fondo.

- [ ] **Paso 7: Commit**

```bash
git add src/app/globals.css "src/app/(app)/dashboard/loading.tsx" "src/app/(app)/projects/[id]/loading.tsx" src/components/projects/process-card.tsx
git commit -m "feat(ds): foco visible, skeletons de carga y hover perceptible"
```

---

### Tarea 8: Verificación final

**Archivos:** ninguno (solo verificación).

- [ ] **Paso 1: Suite completa**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Esperado: los cuatro limpios.

- [ ] **Paso 2: Recorrer los 15 criterios de aceptación**

Verificar uno por uno los criterios de la § 7 de
[`docs/specs/2026-07-27-navegacion-identidad-design.md`](../specs/2026-07-27-navegacion-identidad-design.md).

Prestar atención especial a:
- **Criterio 7**: ninguna petición a `fonts.googleapis.com` ni `fonts.gstatic.com`
  en tiempo de ejecución. Comprobarlo interceptando las peticiones de red con
  Playwright, no solo mirando el código.
- **Criterio 13**: contraste WCAG AA de las combinaciones nuevas (títulos en
  `primary-600`, texto sobre la retícula).
- **Criterio 12**: ningún control sin foco visible.

- [ ] **Paso 3: Verificar el responsive**

Recorrer dashboard, hub y editor en 390 px y en 1440 px. Confirmar que en móvil
las migas se reducen al retorno al nivel anterior y que ninguna pantalla desborda
horizontalmente:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

- [ ] **Paso 4: Confirmar que la inmutabilidad sigue intacta**

Abrir un proceso cerrado y verificar que sigue en solo lectura: 0 controles
habilitados y 0 botones de acción. Ningún cambio de este plan debería afectarlo,
pero es la garantía más importante del proyecto.

- [ ] **Paso 5: Capturar el resultado**

Capturar dashboard, hub y editor en escritorio y móvil, para comparar con el
estado anterior.

- [ ] **Paso 6: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "fix: ajustes finales de navegacion e identidad"
```

---

## Notas de implementación

- El orden importa: la Tarea 1 produce el componente que consumen la 2 y la 3; la
  Tarea 4 produce el token `--font-display` que usan la 5 y la 6.
- Las Tareas 4, 6 y 7 comparten `src/app/globals.css`. Ejecutarlas en orden evita
  conflictos.
- La Tarea 4 es la única que depende de la red durante el build (`next/font`
  descarga la fuente). Si el build fallara por no poder obtenerla, detenerse y
  reportarlo en vez de recurrir a un `<link>` a Google Fonts, que violaría la
  restricción de no hacer peticiones a terceros en tiempo de ejecución.
- No tocar `src/lib/calculations/` ni `src/lib/validators/`.
- No modificar `closure-verdict.tsx`: está revisado y la Tarea 6 solo lo
  inspecciona.
