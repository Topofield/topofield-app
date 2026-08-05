# Estabilización del sistema de diseño — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** Fijar las reglas del sistema de diseño y aplicar los ajustes que
esas reglas hacen evidentes, antes de que las fases 4–6 construyan encima.

**Arquitectura:** Cambios acotados a la capa de presentación y a los tokens de
`globals.css`. No se toca `src/lib/calculations/` ni `src/lib/validators/`. No se
crean componentes nuevos. El trabajo es de cuatro clases: mover una regla CSS a
su capa, unificar el sistema de foco, corregir dos contrastes que fallan, y
converger una convención divergente.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase · Vitest · Playwright (solo para capturas de documentación)

**Spec:** [`docs/specs/2026-07-28-sistema-diseno-design.md`](../specs/2026-07-28-sistema-diseno-design.md)

## Restricciones globales

- No usar shadcn/ui ni ninguna librería de componentes o de iconos. Los SVG se
  escriben a mano, inline.
- Tailwind v4 puro, con los tokens en `@theme`. **Toda regla CSS global va
  dentro de `@layer`**: una regla fuera de capa gana sobre las utilidades y las
  anula en silencio.
- Prohibidas las peticiones a terceros en tiempo de ejecución.
- Vitest corre con `environment: "node"`, **sin jsdom**: no se testea el render.
  El patrón del proyecto es extraer la decisión como función pura y testear esa
  (`verdictFor`, `resolveBreadcrumbs`, `tabHref`).
- Contraste WCAG AA: 4.5:1 en texto, 3:1 en elementos gráficos. El color nunca
  es el único canal de información.
- Idioma de interfaz: español (Colombia). Zona horaria: America/Bogota.
- Los procesos `closed` y `rejected` son inmutables: nunca generar UPDATE.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- Commits en español con prefijo `feat:`, `fix:`, `refactor:` o `docs:`.

## Verificación transversal

La página `/design-system` mide en vivo la tabla de `src/lib/design/pairings.ts`
contra los tokens de `globals.css`. Es la herramienta de verificación de este
plan: **al terminar debe reportar 0 parejas por debajo de su umbral**, con la
exención de WCAG 1.4.3 apareciendo como «Exento» y no como fallo.

Para abrirla hace falta sesión (el proxy protege la ruta):

```bash
npm run dev
```

Luego entrar en `http://localhost:3000/sign-in` con `seed@topofield.local` /
`seed1234` y navegar a `http://localhost:3000/design-system`.

Si el servidor venía de un `npm run build`, borrar `.next` antes de `dev`: una
ruta estática puede resolverse como dinámica y devolver 404.

```bash
rm -rf .next
```

---

### Tarea 1: Mover la regla `body` dentro de `@layer base`

Es el riesgo que la propia documentación técnica advierte y que ya causó un fallo
silencioso una vez. La regla `body` de `src/app/globals.css` está fuera de toda
capa, así que gana sobre cualquier utilidad de Tailwind y la anula sin error
visible.

**Archivos:**
- Modificar: `src/app/globals.css:34-57`

**Interfaces:**
- Consume: nada.
- Produce: `globals.css` sin reglas fuera de `@layer`. El fondo, el color de
  texto y la retícula del `body` se mantienen idénticos.

- [ ] **Paso 1: Capturar el estado visual actual como referencia**

Con el servidor de desarrollo corriendo y sesión iniciada, abrir
`http://localhost:3000/dashboard` y observar: fondo gris muy claro
(`neutral-50`), retícula de líneas a 32 px y texto oscuro. Esto es lo que **no**
debe cambiar.

- [ ] **Paso 2: Mover la regla dentro de la capa**

En `src/app/globals.css`, la regla actual empieza en la línea 34 con `body {` y
termina en la línea 57. Hay que envolverla en la capa `base` ya existente.
Reemplazar el bloque `body { ... }` completo por nada, y añadir su contenido
dentro del `@layer base` que ya existe (línea 59), **antes** de la regla de
`h1, h2, h3`:

```css
@layer base {
  body {
    @apply bg-neutral-50 text-neutral-900 antialiased;
    font-family:
      system-ui,
      -apple-system,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
    background-image:
      linear-gradient(
        to right,
        color-mix(in srgb, var(--color-neutral-200) 25%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        to bottom,
        color-mix(in srgb, var(--color-neutral-200) 25%, transparent) 1px,
        transparent 1px
      );
    background-size: 32px 32px;
    background-position: center;
  }

  h1,
  h2,
  h3 {
    font-family: var(--font-display);
    color: var(--color-primary-600);
    letter-spacing: -0.01em;
  }

  :where(a, button, summary):focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
}
```

- [ ] **Paso 3: Verificar que no queda ninguna regla fuera de capa**

```bash
grep -n "^[a-z@:*]" src/app/globals.css
```

Esperado: solo `@import`, `@theme`, `@layer` y `@media`. Ninguna regla de
elemento (`body`, `h1`, …) en la columna 0 fuera de un bloque `@layer`.

- [ ] **Paso 4: Verificar que el aspecto no cambió**

Recargar `http://localhost:3000/dashboard`. El fondo, la retícula y el color del
texto deben verse exactamente igual que en el paso 1.

- [ ] **Paso 5: Comprobar que ahora una utilidad puede ganarle**

Es la razón del cambio. Temporalmente, en `src/app/(app)/layout.tsx:28`, añadir
`bg-white` al `<div>` raíz:

```tsx
<div className="flex min-h-screen flex-col bg-white">
```

Recargar: el fondo debe volverse blanco (antes de este cambio, la regla fuera de
capa impedía que utilidades equivalentes sobre `body` tuvieran efecto). Revertir
el `bg-white` inmediatamente después de comprobarlo.

- [ ] **Paso 6: Verificar y commitear**

```bash
npm run typecheck && npm run lint
```

```bash
git add src/app/globals.css
git commit -m "fix: mover la regla body dentro de @layer base

Una regla fuera de capa gana sobre las utilidades de Tailwind y las
anula en silencio. Ya habia ocurrido con la regla de titulos."
```

---

### Tarea 2: Unificar el sistema de foco en el `outline` de la capa base

Hoy conviven dos sistemas: el `outline` de `globals.css` para `a`, `button` y
`summary`, y el `ring` propio de los componentes. Cuál se aplica depende de qué
componente se usó, no de una decisión.

**Archivos:**
- Modificar: `src/app/globals.css` (selector de la regla de foco)
- Modificar: `src/components/design-system/button.tsx:43`
- Modificar: `src/components/design-system/input.tsx:42`
- Modificar: `src/components/design-system/select.tsx:52`
- Modificar: `src/components/design-system/textarea.tsx:44`
- Modificar: `src/components/design-system/dms-input.tsx:32`
- Modificar: `src/app/(app)/layout.tsx:34`
- Modificar: `src/components/polygonal/close-process-dialog.tsx:155`

**Interfaces:**
- Consume: nada.
- Produce: ningún componente declara `focus-visible:ring-*` ni
  `focus-visible:outline-none`. El foco lo da la regla base para enlaces,
  botones, `summary` y campos de formulario.

- [ ] **Paso 1: Ampliar el selector base a los campos de formulario**

`<input>`, `<select>` y `<textarea>` no son `a`/`button`/`summary`, así que hoy
no los cubre la regla base. En `src/app/globals.css`, dentro de `@layer base`,
reemplazar el selector de foco:

```css
  :where(a, button, summary, input, select, textarea):focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
```

`:where()` mantiene la especificidad en cero, así que un componente puede
seguir sobreescribiéndolo si algún día hace falta.

- [ ] **Paso 2: Retirar el `ring` de `buttonClasses`**

En `src/components/design-system/button.tsx:43`, la cadena base actual termina
en `focus-visible:ring-offset-2`. Dejarla así:

```tsx
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
```

- [ ] **Paso 3: Retirar el `ring` de `Input`**

En `src/components/design-system/input.tsx`, borrar la línea 42 completa
(`"focus-visible:outline-none focus-visible:ring-2 …"`) y ajustar la línea de
error, que también menciona el ring. El `cn(...)` queda:

```tsx
        className={cn(
          "h-10 rounded-md border border-neutral-200 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-500",
          "disabled:bg-neutral-100 disabled:text-neutral-500",
          error && "border-danger-500",
          className,
        )}
```

- [ ] **Paso 4: Retirar el `ring` de `Select`**

En `src/components/design-system/select.tsx`, mismo cambio:

```tsx
        className={cn(
          "h-10 rounded-md border border-neutral-200 bg-white px-3 text-base text-neutral-900",
          "disabled:bg-neutral-100 disabled:text-neutral-500",
          error && "border-danger-500",
          className,
        )}
```

- [ ] **Paso 5: Retirar el `ring` de `Textarea`**

En `src/components/design-system/textarea.tsx`:

```tsx
        className={cn(
          "rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500",
          "disabled:bg-neutral-100 disabled:text-neutral-500",
          error && "border-danger-500",
          className,
        )}
```

- [ ] **Paso 6: Retirar el `ring` de `DmsInput`**

En `src/components/design-system/dms-input.tsx`, la constante `cell` queda:

```tsx
  const cell = cn(
    "h-9 min-h-11 w-16 md:w-14 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-sm text-neutral-900",
    "disabled:bg-neutral-100 disabled:text-neutral-500",
    error && "border-danger-500",
  );
```

- [ ] **Paso 7: Retirar los dos `ring` que quedan fuera del sistema de diseño**

Son los que harían que la unificación quedase a medias.

En `src/app/(app)/layout.tsx:34`, el enlace del logo:

```tsx
            className="rounded-md transition-opacity hover:opacity-80"
```

En `src/components/polygonal/close-process-dialog.tsx:155`, la casilla:

```tsx
                  className="h-4 w-4 rounded border-neutral-200"
```

- [ ] **Paso 8: Comprobar que no queda ningún `ring` de foco**

```bash
grep -rn "focus-visible:ring\|focus-visible:outline-none" src/
```

Esperado: **sin resultados**.

- [ ] **Paso 9: Recorrer el foco con el tabulador**

Con el servidor corriendo y sesión iniciada, abrir
`http://localhost:3000/design-system#patrones` y recorrer con `Tab`. Los cuatro
controles de la demostración de § 4.2 (botón, enlace, chip y campo) deben
mostrar **el mismo** contorno azul de 2 px.

Después, en `http://localhost:3000/dashboard`, comprobar el enlace del logo del
encabezado y los campos del buscador. Ningún control puede quedarse sin
indicación de foco.

- [ ] **Paso 10: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add src/app/globals.css src/components/design-system src/app/\(app\)/layout.tsx src/components/polygonal/close-process-dialog.tsx
git commit -m "refactor: unificar el foco visible en el outline de la capa base

Convivian dos sistemas: el outline de globals.css y el ring propio de
los componentes. Cual se aplicaba dependia de que componente se usara.
El selector base se amplia a input, select y textarea, que no estaban
cubiertos, y los componentes dejan de declarar el suyo."
```

---

### Tarea 3: Corregir el contraste del borde de los campos de formulario

`neutral-200` sobre blanco da 1.43:1, muy por debajo del 3:1 que WCAG 1.4.11
exige al límite de un control. Agrava el caso que el campo sea blanco sobre un
fondo de página `neutral-50`: el borde es lo único que marca dónde está.

**Archivos:**
- Modificar: `src/app/globals.css` (bloque `@theme`)
- Modificar: `src/components/design-system/input.tsx`
- Modificar: `src/components/design-system/select.tsx`
- Modificar: `src/components/design-system/textarea.tsx`
- Modificar: `src/components/design-system/dms-input.tsx`
- Modificar: `src/components/polygonal/close-process-dialog.tsx:155`
- Modificar: `src/lib/design/pairings.ts`

**Interfaces:**
- Consume: `Pairing` de `src/lib/design/pairings.ts`.
- Produce: token `--color-neutral-400: #828c98`, usado como borde de todo
  control de formulario. El borde decorativo de `Card`, `KpiCard`, `Modal`,
  `EmptyState` y `Tabs` **sigue siendo `neutral-200`**: no delimita un control.

- [ ] **Paso 1: Añadir el token**

En `src/app/globals.css`, dentro de `@theme`, junto al resto de neutrales
(después de `--color-neutral-200`):

```css
  --color-neutral-400: #828c98;
```

El valor da 3.41:1 sobre blanco y 3.24:1 sobre `neutral-50`, así que cumple
sobre los dos fondos donde aparecen los campos.

- [ ] **Paso 2: Declarar la pareja nueva y corregir la existente**

En `src/lib/design/pairings.ts`, en la sección de elementos gráficos, sustituir
la entrada de `neutral-200` por dos entradas:

```ts
  {
    fg: "neutral-400",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Borde de Input/Select/Textarea/DmsInput — límite del control",
  },
  {
    fg: "neutral-400",
    bg: "neutral-50",
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Borde de control sobre el fondo de página",
  },
```

- [ ] **Paso 3: Aplicar el token en los cuatro componentes de captura**

En `input.tsx`, `select.tsx` y `textarea.tsx`, cambiar `border-neutral-200` por
`border-neutral-400` en el `cn(...)` del control. En `dms-input.tsx`, el mismo
cambio dentro de la constante `cell`. Ejemplo para `input.tsx`:

```tsx
          "h-10 rounded-md border border-neutral-400 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-500",
```

En `src/components/polygonal/close-process-dialog.tsx:155`, la casilla:

```tsx
                  className="h-4 w-4 rounded border-neutral-400"
```

- [ ] **Paso 4: Comprobar que no se tocó ningún borde decorativo**

```bash
grep -rn "border-neutral-400" src/
```

Esperado: solo `input.tsx`, `select.tsx`, `textarea.tsx`, `dms-input.tsx` y
`close-process-dialog.tsx`. Si aparece `card.tsx`, `kpi-card.tsx`, `modal.tsx`,
`empty-state.tsx` o `tabs.tsx`, revertir esos: son bordes decorativos.

- [ ] **Paso 5: Verificar la medición**

Abrir `http://localhost:3000/design-system#contraste`. En la tabla de elementos
gráficos, las dos parejas de `neutral-400` deben aparecer como «Cumple» (3.41:1
y 3.24:1). Ya no debe existir la fila de `neutral-200` con 1.43:1.

- [ ] **Paso 6: Comprobar que los formularios reales siguen bien**

Los campos son de toda la aplicación, no solo del sistema de diseño. Revisar:

- `http://localhost:3000/sign-in` — los dos campos.
- `http://localhost:3000/projects/new` — el asistente de proyecto.
- Un editor de poligonal con sus `DmsInput` (entrar por el dashboard a un
  proyecto y abrir un proceso en estado `draft` o `calculated`).

El borde debe verse más definido que antes, sin que el campo parezca
deshabilitado ni el formulario, sucio.

- [ ] **Paso 7: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add src/app/globals.css src/lib/design/pairings.ts src/components/design-system src/components/polygonal/close-process-dialog.tsx
git commit -m "fix: subir a 3:1 el contraste del borde de los campos

neutral-200 daba 1.43:1 sobre blanco, muy por debajo del 3:1 que WCAG
1.4.11 exige al limite de un control. El borde es lo unico que marca
donde esta el campo, porque el campo es blanco sobre un fondo neutral-50.
Los bordes decorativos (Card, KpiCard, Modal, Tabs) siguen en neutral-200."
```

---

### Tarea 4: Corregir los cuatro tokens del semáforo

Tres de los cuatro fallan como indicador gráfico: verde 2.87:1, amarillo 1.66:1,
naranja 2.85:1, contra el 3:1 exigido. Ningún componente los usa todavía, así que
el cambio no puede causar regresión visual.

**Nota de decisión:** se oscurecen los rellenos, en lugar de conservar el tono
vivo y añadir cuatro tokens de anillo oscuro. Es la opción que no deja deuda: no
obliga a nada al componente de la fase 5. El coste está medido y se registra
abajo: los cuatro valores quedan a luminancia parecida, así que los niveles
contiguos se separan poco (verde/amarillo 1.18, amarillo/naranja 1.15,
naranja/rojo 1.01). No se pierde información porque el semáforo siempre va
acompañado de texto, pero de un vistazo se distinguen peor.

**Archivos:**
- Modificar: `src/app/globals.css` (bloque `@theme`)
- Modificar: `src/lib/design/pairings.ts`
- Modificar: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consume: nada.
- Produce: los cuatro tokens `--color-semaphore-*` cumpliendo 3:1 sobre blanco y
  sobre `neutral-50`.

- [ ] **Paso 1: Sustituir los cuatro valores**

En `src/app/globals.css`, en el bloque `@theme`:

```css
  /* Semáforo de asentamientos. Oscurecidos para cumplir 3:1 como indicador
     gráfico: los valores vivos originales daban 2.87, 1.66 y 2.85. */
  --color-semaphore-green: #1e8e4e;
  --color-semaphore-yellow: #8a6d0b;
  --color-semaphore-orange: #c25e08;
  --color-semaphore-red: #d94436;
```

Razones resultantes sobre blanco: 4.17, 4.91, 4.29 y 4.35.

- [ ] **Paso 2: Añadir la medición sobre el fondo de página**

Los puntos del semáforo aparecerán sobre tarjetas blancas y sobre el fondo
`neutral-50`. En `src/lib/design/pairings.ts`, añadir tras las cuatro entradas
de semáforo existentes:

```ts
  {
    fg: "semaphore-green",
    bg: "neutral-50",
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo sobre el fondo de página — fase 5",
  },
  {
    fg: "semaphore-yellow",
    bg: "neutral-50",
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo sobre el fondo de página — fase 5",
  },
  {
    fg: "semaphore-orange",
    bg: "neutral-50",
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo sobre el fondo de página — fase 5",
  },
  {
    fg: "semaphore-red",
    bg: "neutral-50",
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo sobre el fondo de página — fase 5",
  },
```

- [ ] **Paso 3: Verificar que las ocho parejas cumplen**

Abrir `http://localhost:3000/design-system#contraste`. Las ocho filas de
`semaphore-*` deben aparecer como «Cumple».

- [ ] **Paso 4: Registrar la deuda de separación entre niveles**

Es una consecuencia medida de esta decisión y la fase 5 tiene que conocerla. En
`.superpowers/sdd/progress.md`, al final de la sección «Deuda registrada para la
fase 4», añadir:

```markdown
- Semáforo de asentamientos: los cuatro tokens se oscurecieron para cumplir 3:1
  como indicador gráfico (fase de estabilización del sistema de diseño). El
  efecto colateral medido es que quedan a luminancia parecida y los niveles
  contiguos se separan poco: verde/amarillo 1.18, amarillo/naranja 1.15,
  naranja/rojo 1.01. No se pierde información —el semáforo siempre lleva texto,
  por la regla de que el color nunca es el único canal— pero de un vistazo se
  distinguen peor. Si al construir el módulo de asentamientos la lectura rápida
  resulta insuficiente, la alternativa es volver a los rellenos vivos añadiendo
  cuatro tokens de anillo oscuro (#0f5c2e, #7a6207, #8a4a0c, #8f2418, todos
  ≥5.8:1 sobre blanco), que aportan el límite sin tocar el tono.
```

- [ ] **Paso 5: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add src/app/globals.css src/lib/design/pairings.ts .superpowers/sdd/progress.md
git commit -m "fix: subir a 3:1 el contraste de los cuatro tokens del semaforo

Verde 2.87, amarillo 1.66 y naranja 2.85 fallaban como indicador
grafico. Ningun componente los usaba todavia, asi que el cambio no
causa regresion. Se registra la deuda: al oscurecerlos quedan a
luminancia parecida y los niveles contiguos se separan poco."
```

---

### Tarea 5: Converger el filtro de estado a enlaces

`dashboard-filter.tsx` resuelve el filtro excluyente con `<Link>` +
`aria-current`; `process-list-toolbar.tsx` lo resuelve con `<button>` +
`router.push`. Dos patrones para lo mismo, en componentes hermanos.

Es la tarea delicada del plan: ese componente además restaura y persiste el
filtro en `localStorage` con **dos efectos cuyo orden de declaración importa**.
Reordenarlos reintroduce un bug ya corregido (el efecto de persistencia borraba
la clave antes de que el de restauración pudiera leerla). No tocar ese orden.

**Archivos:**
- Modificar: `src/components/projects/process-list-toolbar.tsx:161-190`

**Interfaces:**
- Consume: `toQuery` y `ProcessFilters` del propio archivo; `StatusCounts` de
  `@/lib/process-list`.
- Produce: los chips de estado como `<Link>` con `aria-current`. El resto del
  componente (buscador, selector de tipo, «Limpiar filtros», persistencia) no
  cambia de comportamiento.

- [ ] **Paso 1: Leer el componente entero antes de tocarlo**

Leer `src/components/projects/process-list-toolbar.tsx` completo, con atención a
los comentarios de los dos `useEffect`: explican por qué el orden de declaración
no se puede invertir.

- [ ] **Paso 2: Añadir un ayudante para la URL de un chip**

El componente ya tiene `toQuery`, que arma la cadena de consulta. Añadir justo
después de `toQuery` una función que dé el destino de un chip:

```tsx
/** Destino de un chip de estado, conservando el resto de filtros. */
function chipHref(
  projectId: string,
  filters: ProcessFilters,
  estado: StatusFilter,
): string {
  return `/projects/${projectId}?${toQuery({ ...filters, estado })}`;
}
```

- [ ] **Paso 3: Sustituir los `<button>` por `<Link>`**

En el bloque de los chips (alrededor de la línea 168), reemplazar el `<button>`
por un `<Link>` con el mismo aspecto. `router.push` desaparece de aquí; el
`import` de `useRouter` se mantiene porque `navegar` lo sigue usando para el
buscador y el selector de tipo.

```tsx
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
        {CHIPS.map((chip) => {
          const activo = chip.value === filters.estado;
          return (
            <Link
              key={chip.value}
              href={chipHref(projectId, filters, chip.value)}
              aria-current={activo ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                activo
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800",
              )}
            >
              {chip.label}{" "}
              <span className="tabular-nums">({counts[chip.value]})</span>
            </Link>
          );
        })}
      </div>
```

- [ ] **Paso 4: Añadir el import de `Link`**

En la cabecera del archivo, junto a `useRouter`:

```tsx
import Link from "next/link";
```

- [ ] **Paso 5: Verificar que compila y que no quedó código muerto**

```bash
npm run typecheck && npm run lint
```

El lint avisa de imports sin usar. Si señala `useRouter`, comprobar antes de
borrarlo que `navegar` ya no se usa en ninguna parte: el buscador y el selector
de tipo deberían seguir usándolo.

- [ ] **Paso 6: Verificar los cuatro casos de la persistencia**

Son los que se verificaron al cerrar la tarea 7 de la fase 3 y los que este
cambio podría romper. Con el servidor corriendo y sesión iniciada, en el listado
de procesos de un proyecto (`http://localhost:3000/projects/<id>?tab=processes`):

1. **Restaura:** pulsar el chip «Cerrados», ir al dashboard, volver al proyecto.
   Debe reaparecer «Cerrados».
2. **La URL manda:** con «Cerrados» guardado, abrir directamente
   `…/projects/<id>?tab=processes&estado=borradores`. Debe mostrar «Borradores»,
   no «Cerrados».
3. **Limpiar olvida:** pulsar «Limpiar filtros» y volver a entrar al proyecto.
   Debe mostrar «Todos», no el filtro anterior.
4. **Sin bucle:** al entrar al proyecto, la navegación debe quedarse quieta. Si
   la URL parpadea o el historial crece solo, hay bucle de navegación.

Para partir de un estado limpio entre pruebas, borrar la clave en la consola del
navegador:

```js
localStorage.removeItem(`topofield:procesos:${"<id-del-proyecto>"}`)
```

- [ ] **Paso 7: Verificar que el chip se puede abrir en pestaña nueva**

Es lo que motiva el cambio. Clic central (o `Ctrl`+clic) sobre el chip
«Cerrados»: debe abrirse una pestaña nueva ya filtrada. Con el `<button>`
anterior no era posible.

- [ ] **Paso 8: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add src/components/projects/process-list-toolbar.tsx
git commit -m "refactor: converger los chips de estado a enlaces

dashboard-filter.tsx ya resolvia el filtro excluyente con Link y
aria-current; el listado de procesos usaba button y router.push para lo
mismo. El filtro es navegacion: ahora se puede abrir en pestana nueva y
compartir. La persistencia en localStorage no cambia, y el orden de
declaracion de sus dos efectos se mantiene."
```

---

### Tarea 6: Escribir las reglas en la documentación técnica

Sin esto el plan deja el código arreglado pero las reglas sin escribir, que es
justo el problema que motivó la spec.

**Archivos:**
- Modificar: `docs/tecnica/README.md` (§ 8, sistema de diseño)

**Interfaces:**
- Consume: la spec `docs/specs/2026-07-28-sistema-diseno-design.md`.
- Produce: § 8 con el contrato de tokens, la regla de composición, los cinco
  patrones canónicos y cómo se verifica el contraste.

- [ ] **Paso 1: Leer la sección actual**

Leer `docs/tecnica/README.md` § 8 completo. Ya contiene la lista de componentes,
una tabla de tokens, las reglas tipográficas, el aviso de `@layer`, las fuentes,
el responsive y la accesibilidad. Se conserva todo eso; se añade lo que falta y
se actualiza lo que cambió.

- [ ] **Paso 2: Sustituir la tabla de tokens por el contrato de escalones**

Reemplazar la tabla actual de § 8 por:

```markdown
### Contrato de tokens

| Escalón | Rol | Uso válido |
|---|---|---|
| `-50` | Fondo teñido claro | Solo fondo. Nunca texto. |
| `-100`, `-200` | Fondo y bordes decorativos | Nunca texto sobre blanco. No sirve como límite de un control. |
| `-400` | Borde de control | Límite de campos de formulario: cumple 3:1. |
| `-500` | Base accesible | Texto sobre blanco · fondo bajo texto blanco · borde · punto de estado. |
| `-600` | Texto y profundidad | Texto sobre blanco y sobre `-50` · `hover:` de un fondo `-500`. |
| `-700` | Texto de máximo contraste | Texto sobre `-50` · `active:` de un fondo `-500`. |

`neutral-500` es la excepción deliberada: se usa como texto secundario sobre
blanco y cumple AA en ese uso.

`--font-display` (Space Grotesk) para títulos, `--font-mono` para datos
numéricos.

### La regla de los tres contextos

Un token de estado se usa de tres maneras, y **cumplir en una no implica cumplir
en las otras**:

1. **Texto sobre blanco** — 4.5:1.
2. **Texto sobre su propio fondo teñido** — 4.5:1. `Badge` usa
   `bg-success-500/10 text-success-500`: el fondo efectivo es el token al 10 %
   sobre blanco, no blanco. *Este es el contexto que falló y que ninguna
   revisión manual medía.*
3. **Fondo bajo texto blanco** — 4.5:1.

Puntos y bordes de control son elementos gráficos: 3:1.

`/10` es la única transparencia sancionada. Otra crea un contexto nuevo que hay
que declarar y medir.

**Excepción de WCAG 1.4.3:** los componentes de interfaz inactivos no tienen
requisito de contraste. El botón deshabilitado da 3.71:1 y es correcto así.
```

- [ ] **Paso 3: Documentar cómo se verifica**

Añadir a continuación:

```markdown
### Cómo se verifica el contraste

`src/lib/design/contrast.ts` son funciones puras (hex → RGB, luminancia, razón,
y `composite()` para resolver un fondo teñido antes de medirlo).
`src/lib/design/pairings.ts` declara las parejas que el sistema usa de verdad.

La ruta `/design-system` las mide y las muestra. Es herramienta de desarrollo:
devuelve 404 en producción y hace falta sesión para abrirla.

Los tokens se **leen de `globals.css` en tiempo de render**, no se duplican en
TypeScript: la hoja de estilos sigue siendo la única fuente de verdad, así que
las mediciones no pueden desincronizarse de la paleta real.

**Al tocar la paleta o añadir una pareja nueva** —un `Badge` con un tono nuevo,
un fondo teñido distinto— hay que declararla en `pairings.ts` y abrir la página.
No hay prueba automática que lo obligue.
```

- [ ] **Paso 4: Añadir la regla de composición**

```markdown
### Qué entra en el sistema de diseño

**Un componente pertenece al sistema de diseño si no conoce el dominio de
TopoField.** Recibe cadenas, `href`s y uniones definidas en su propio archivo.
No importa nada de `@/types/*` ni de `@/lib/*` salvo `cn`.

Es un criterio verificable leyendo los imports, y explica la separación que ya
existe: `Breadcrumbs` recibe `{ label, href }[]` y sirve a cualquier jerarquía;
`ProcessTable` importa `PolygonalProcess` y conoce estados y tolerancias.

Consecuencia para los módulos nuevos: la tabla de nivelación **no** va al
sistema de diseño. Si comparte estructura con la de poligonales, lo que se
extrae es el patrón, no un componente genérico parametrizado.
```

- [ ] **Paso 5: Añadir los patrones canónicos**

```markdown
### Patrones canónicos

**Filtro excluyente** — `<Link>` + `aria-current`. El filtro es navegación:
debe poder abrirse en pestaña nueva y compartirse. Referencia:
`dashboard-filter.tsx`. Usar `<button>` + `router.push` solo si el control
necesita estado de cliente que un enlace no pueda expresar.

**Foco visible** — un solo sistema: el `outline` de `@layer base`, que cubre
`a`, `button`, `summary`, `input`, `select` y `textarea` con `:where()`
(especificidad cero). Los componentes **no declaran su propio `ring`**.

**Estado de carga** — se deshabilita el control y cambia su texto
(«Guardando…»), sin spinner: el cambio de texto lo anuncia el lector de
pantalla, un spinner decorativo no.

**Indicador de estado** — el color nunca es el único canal. `StatusIndicator`
es la referencia: punto `aria-hidden` más etiqueta de texto real, no solo
`aria-label`.

**Tabla en escritorio, tarjetas en móvil** — corte en 768 px. La tarjeta y la
fila muestran **los mismos campos y los mismos valores**; ya falló una vez
(una mostraba `created_at` y la otra `updated_at`). Si la tarjeta necesita
acciones por fila, no se envuelve entera en un `<Link>`: un `<button>` dentro
de un `<a>` es HTML inválido.
```

- [ ] **Paso 6: Actualizar el aviso de la paleta**

El aviso actual dice que se ajustaron **tres** colores. Son cuatro, y ahora hay
más. Sustituirlo por:

```markdown
> **Historial de la paleta.** Los cuatro tokens de estado se ajustaron para
> cumplir AA: `primary-500` daba 4.42:1, `danger-500` 3.82:1, `success-500`
> 2.87:1 y `warning-500` 2.19:1. Después, la primera medición sistemática
> encontró dos casos más que nadie había medido: el borde de los campos de
> formulario (`neutral-200`, 1.43:1) y tres de los cuatro tokens del semáforo.
> Todos corregidos.
>
> Al elegir un tono no basta con medirlo sobre blanco. Verifique los tres
> contextos.
```

- [ ] **Paso 7: Comprobar que la sección quedó coherente**

Releer § 8 entero. No puede quedar contradicción entre el contrato de tokens
nuevo y el texto que ya existía sobre tipografía, responsive y accesibilidad. En
particular, la lista de 15 componentes sigue siendo correcta: este plan no crea
ni elimina ninguno.

- [ ] **Paso 8: Commitear**

```bash
git add docs/tecnica/README.md
git commit -m "docs: escribir las reglas del sistema de diseno en la doc tecnica

Contrato de tokens por escalon, regla de los tres contextos, criterio de
composicion, los cinco patrones canonicos y como se verifica el
contraste. Es lo que faltaba: los componentes funcionaban pero las
reglas no estaban escritas."
```

---

### Tarea 7: Verificación final

**Archivos:**
- Modificar: ninguno (salvo que aparezca un fallo).

**Interfaces:**
- Consume: todo lo anterior.
- Produce: los ocho criterios de aceptación de la spec, verificados.

- [ ] **Paso 1: Suite completa**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Esperado: los cuatro limpios, 117 pruebas pasando. El `build` importa porque
regenera `.next/types`; el `typecheck` solo no basta cuando han cambiado rutas.

- [ ] **Paso 2: Contraste a cero fallos**

```bash
rm -rf .next && npm run dev
```

Abrir `http://localhost:3000/design-system#hallazgos` con sesión iniciada.
Esperado: **0 en «No cumplen»**, y la pareja exenta apareciendo aparte.

- [ ] **Paso 3: Recorrer los criterios restantes**

- **Ninguna regla fuera de capa:** `grep -n "^[a-z@:*]" src/app/globals.css`
  devuelve solo `@import`, `@theme`, `@layer` y `@media`.
- **Ningún `ring` de foco:** `grep -rn "focus-visible:ring" src/` sin
  resultados.
- **Sin acoplamiento de dominio:**
  `grep -rn "from \"@/" src/components/design-system/*.tsx | grep -v "utils/cn"`
  sin resultados.
- **Chips como enlaces:** los cuatro casos de persistencia de la tarea 5, paso 6.
- **Los editores siguen bien:** abrir un proceso de poligonal en estado
  `calculated` y comprobar que los `DmsInput`, la tabla de estaciones y el
  veredicto de cierre se ven y funcionan igual.

- [ ] **Paso 4: Regenerar las capturas del manual**

Los cambios de borde y de foco salen en las capturas de la documentación.

```bash
node docs/manual/capturas.mjs
```

- [ ] **Paso 5: Anotar el cierre en el método**

En `docs/method.md`, bajo «Aprendizajes acumulados», añadir una entrada de la
estabilización: qué reglas se fijaron, que la primera medición sistemática
encontró dos fallos que las revisiones manuales no veían, y que el semáforo
quedó con poca separación entre niveles contiguos a la espera de la fase 5.

- [ ] **Paso 6: Commit final**

```bash
git add -A
git commit -m "docs: cerrar la estabilizacion del sistema de diseno

Capturas del manual regeneradas y aprendizaje anotado en el metodo."
```

---

## Qué queda fuera, a propósito

- **Prueba automática de contraste.** La tabla de parejas existe y la página la
  mide, pero no hay nada que falle en `npm test` si alguien baja un token.
  Convertir `pairings.ts` en una prueba de Vitest son unas pocas líneas si más
  adelante conviene.
- **Auditoría del DOM con Playwright.** Mediría lo que el navegador compone de
  verdad, no las parejas declaradas. Necesita servidor y base sembrada, así que
  sería un script periódico, no un guardarraíl de cada commit.
- **Los otros tres puntos de deuda de la fase 4** (acciones por fila en móvil,
  filtros que se propagan entre pestañas, `process-list.ts` tipado contra
  `PolygonalProcess`). Son de dominio, no del sistema de diseño.
- **Rediseño visual y componentes nuevos.** El objetivo es fijar reglas y
  aplicar lo que esas reglas hacen evidente, no rehacer los 15 componentes.
