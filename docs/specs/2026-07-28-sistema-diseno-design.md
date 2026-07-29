# Sistema de diseño — estabilización

**Fecha:** 2026-07-28
**Alcance:** `src/components/design-system/` (15 componentes) y el bloque `@theme`
de `src/app/globals.css` (21 tokens).
**Naturaleza:** trabajo transversal, no una fase del § 9 del PRD.
**Motivación:** las fases 4–6 (nivelación, asentamientos, informes) reutilizarán
estos componentes. Las reglas deben servirles antes de que se escriban.

---

## 1. Contexto

Los componentes y los tokens se crearon de forma incremental durante las fases
1–3. Funcionan, pero no hay reglas escritas. Tres rondas de refinamiento UI/UX
destaparon problemas que no eran de los componentes sino de la ausencia de
sistema:

**Los cuatro tokens de color incumplían WCAG AA**, y se corrigieron uno por uno,
en momentos distintos: `primary-500` daba 4.42:1, `danger-500` 3.82:1,
`success-500` 2.87:1 y `warning-500` 2.19:1. Cada corrección descubrió un alcance
mayor del previsto. El caso decisivo: un verde que cumplía sobre blanco (4.78:1)
fallaba sobre su propio fondo teñido al 10 % (4.21:1) — un contexto que ninguna
revisión previa había considerado.

**Convenciones divergentes para el mismo problema.** `dashboard-filter.tsx`
resuelve el filtro excluyente con `<Link>` + `aria-current`;
`process-list-toolbar.tsx` lo resuelve con `<button>` + `router.push`. Dos
patrones para lo mismo, en componentes hermanos.

**Dos sistemas de foco conviviendo.** La regla base de `globals.css` da `outline`
a `:where(a, button, summary):focus-visible`; `Button`, `Input`, `Select` y
`Textarea` declaran `focus-visible:outline-none focus-visible:ring-2`. En un
`<button>` del sistema de diseño gana el `ring` y cancela el `outline`; en los
chips de `process-list-toolbar.tsx`, en los `<Link>` de `dashboard-filter.tsx` y
en `Tabs` no hay `ring`, así que aplica el `outline` de la base. Ambos son
accesibles y del mismo color, pero cuál se aplica depende de qué componente se
usó, no de una decisión.

## 2. Contrato de tokens

### 2.1 Significado de cada escalón

| Escalón | Rol | Uso válido |
|---|---|---|
| `-50` | Fondo teñido claro | Solo fondo. Nunca texto. |
| `-100`, `-200` | Fondo y bordes | Solo fondo y `border-*`. Nunca texto sobre blanco. |
| `-500` | Base accesible | Texto sobre blanco · fondo bajo texto blanco · borde · punto de estado. |
| `-600` | Texto y profundidad | Texto sobre blanco y sobre `-50` · `hover:` de un fondo `-500`. |
| `-700` | Texto de máximo contraste | Texto sobre `-50` · `active:` de un fondo `-500`. |

`neutral-500` es la excepción deliberada: se usa como texto secundario sobre
blanco (etiquetas de `KpiCard`, texto inactivo de `Tabs`) y cumple AA en ese uso.

### 2.2 La regla de los tres contextos

Un token de estado (`success`, `warning`, `danger`) y `primary-500` se usan en
tres contextos distintos, y **cumplir en uno no implica cumplir en los otros**:

1. **Como texto sobre blanco** — mensaje de error de `Input`, veredicto de
   cierre. Umbral: **4.5:1**.
2. **Como texto sobre su propio fondo teñido** — `Badge` usa
   `bg-success-500/10 text-success-500`; `Alert` usa la misma composición. El
   fondo efectivo es el token compuesto al 10 % sobre blanco, no blanco.
   Umbral: **4.5:1**. *Este es el contexto que falló y que ninguna revisión
   previa medía.*
3. **Como fondo bajo texto blanco** — `Button` primario, chip activo del filtro.
   Umbral: **4.5:1** contra `#ffffff`.

Los puntos de color de `StatusIndicator` y los bordes son componentes gráficos:
umbral **3:1**.

`/10` es la única transparencia sancionada para fondos teñidos. Introducir otra
(`/5`, `/20`) crea un contexto nuevo que hay que medir; si hace falta, se añade
al contrato y a la tabla de verificación, no se usa suelto.

### 2.3 Verificación

**Implementado** (commit 07c3312):

- `src/lib/design/contrast.ts` — funciones puras: hex → RGB, luminancia
  relativa, razón de contraste, y `composite(color, alpha, base)` para obtener
  el color efectivo de un fondo teñido antes de medirlo. Sin React, sin
  dependencias nuevas; mismo patrón que `src/lib/calculations/`.
- `src/lib/design/pairings.ts` — la tabla de las parejas que el sistema usa
  realmente, con el umbral de cada una. Es el contrato en forma de datos.
- `/design-system` — página de desarrollo que mide la tabla y la muestra.

Los tokens se **leen de `globals.css` en tiempo de render**
(`parseThemeColors`), no se duplican en TypeScript. La hoja de estilos sigue
siendo la única fuente de verdad, así que las muestras y las razones no pueden
desincronizarse de la paleta real — que es exactamente el momento en que hay que
medir.

**Decisión sobre la prueba automatizada:** no se añade `contrast.test.ts`. La
verificación es la página, que se abre cuando se toca la paleta. La tabla de
parejas queda escrita y medible, de modo que convertirla en prueba de Vitest son
unas pocas líneas si más adelante conviene.

Lo que esto **no** cubre: mide las parejas declaradas, no lo que el JSX compone
en tiempo de ejecución. Las clases se ensamblan dinámicamente (`TONE_CLASSES`,
`cn()`), y rastrearlas desde el código fuente sería frágil. Al añadir una pareja
nueva —un `Badge` con un tono nuevo, un fondo teñido distinto— hay que
declararla en `pairings.ts`.

### 2.4 Resultado de la primera medición

31 parejas medidas: **26 cumplen, 4 no, 1 exenta**.

Los cuatro tokens corregidos en las fases 1–3 se sostienen **también sobre su
propio tinte**, que era la duda: `success-500` 4.70:1, `danger-500` 4.69:1,
`warning-500` 5.23:1 sobre el badge al 10 %. Pasan, con dos décimas de margen —
confirma que la regla de los tres contextos era necesaria y que cualquier ajuste
futuro de esos tres tokens hay que volver a medirlo.

Los cuatro incumplimientos son casos que nadie había medido:

| Razón | Mín. | Pareja | Dónde |
|---|---|---|---|
| 1.43:1 | 3:1 | `neutral-200` sobre blanco | Borde de `Input`/`Select`/`Textarea` |
| 1.66:1 | 3:1 | `semaphore-yellow` | Semáforo — fase 5 |
| 2.85:1 | 3:1 | `semaphore-orange` | Semáforo — fase 5 |
| 2.87:1 | 3:1 | `semaphore-green` | Semáforo — fase 5 |

El borde de los campos incumple WCAG 1.4.11. Agrava el caso que el campo sea
blanco sobre un fondo de página `neutral-50`: el borde es lo único que marca
dónde está el control.

Tres de los cuatro tokens del semáforo fallan como indicador gráfico
(`semaphore-red` cumple con 3.82:1). Ningún componente los usa todavía, así que
corregirlos ahora no puede causar regresión visual.

**Exención registrada:** `neutral-500` sobre `neutral-200` (botón deshabilitado)
da 3.71:1, pero WCAG 1.4.3 exime los componentes de interfaz inactivos. Se mide
y se muestra como «Exento», sin contar como incumplimiento. Declararla con
umbral 4.5:1 habría mandado a corregir algo que la norma no exige.

## 3. Regla de composición

**Un componente pertenece al sistema de diseño si no conoce el dominio de
TopoField.** Recibe cadenas, `href`s y uniones definidas en su propio archivo.
No importa nada de `@/types/*` ni de `@/lib/*` salvo utilidades genéricas
(`cn`).

Criterio verificable leyendo los imports. Explica la separación que ya existe:
`Breadcrumbs` recibe `{ label, href }[]` y sirve a cualquier jerarquía;
`ProcessTable` importa `PolygonalProcess` y conoce estados, tipos y tolerancias.

Consecuencia para la fase 4: la tabla de nivelación **no** va al sistema de
diseño. Si comparte estructura con la de poligonales, lo que se extrae es el
patrón (§ 4.5), no un componente genérico parametrizado. La deuda ya registrada
—`process-list.ts` tipado contra `PolygonalProcess`— se resuelve con un tipo base
común en `@/types`, no promoviendo componentes al sistema.

## 4. Patrones canónicos

### 4.1 Filtro excluyente

**`<Link>` + `aria-current`.** El filtro es navegación: cambia la URL, debe poder
abrirse en pestaña nueva y compartirse. `dashboard-filter.tsx` es la
implementación de referencia.

`<button>` + `router.push` solo cuando el control necesite estado de cliente que
un enlace no pueda expresar. `process-list-toolbar.tsx` usa botones sin esa
necesidad — el enlace le basta.

### 4.2 Foco visible

**Un solo sistema: el `outline` de `@layer base`.** Cubre `a`, `button` y
`summary` con `:where()`, especificidad cero, sin mantenimiento por componente.

Los componentes **no declaran su propio `ring`**. Se elimina
`focus-visible:outline-none focus-visible:ring-2 …` de `buttonClasses`.

Excepción: `<input>`, `<select>` y `<textarea>` no están en el selector base
—no son `a`/`button`/`summary`— y conservan su `ring`. Se añaden al selector
base para que el sistema sea uno solo, y se retira el `ring` también de ellos.

### 4.3 Estado de carga

Los envíos van por Server Action dentro de `startTransition`. El estado de carga
se expresa **deshabilitando el control y cambiando su texto** («Guardando…»), no
con un spinner: el cambio de texto lo anuncia el lector de pantalla, un spinner
decorativo no. El control deshabilitado conserva su ancho para que el botón no
salte.

### 4.4 Indicador de estado con texto accesible

El color nunca es el único canal. `StatusIndicator` es la referencia: punto
`aria-hidden` + etiqueta de texto real. Todo indicador nuevo lleva texto legible,
no solo `aria-label` — el usuario vidente con visión cromática atípica también
necesita el canal redundante.

### 4.5 Tabla en escritorio, tarjetas en móvil

Punto de corte 768 px. **La tarjeta móvil y la fila de escritorio muestran los
mismos campos y los mismos valores.** Ya falló una vez: la tarjeta mostraba
`created_at` donde la tabla mostraba `updated_at`, y le faltaba el semáforo de
tolerancia (corregido en 43bc2fa).

La tarjeta no se envuelve entera en un `<Link>` si necesita acciones por fila: un
`<button>` dentro de un `<a>` es HTML inválido. Se enlaza el título y las
acciones van sueltas — esto desbloquea la deuda registrada de acciones ausentes
en móvil.

## 5. Ajustes que estas reglas hacen evidentes

Deliberadamente acotado. Reglas claras y los ajustes que se siguen de ellas, no
una refactorización de los 15 componentes.

1. **`globals.css:34` — la regla `body` está fuera de `@layer`.** Es el riesgo
   que la propia documentación técnica advierte: una regla fuera de capa gana
   sobre las utilidades y las anula en silencio. Mover a `@layer base`.
2. **Convergir los chips de `process-list-toolbar.tsx` a `<Link>`** (§ 4.1).
   Simplifica el componente y salda deuda registrada. Hay que confirmar que la
   persistencia en `localStorage` sigue funcionando: es la parte delicada.
3. **Retirar los `ring` de `buttonClasses`, `Input`, `Select`, `Textarea` y
   `DmsInput`; ampliar el selector base a los campos de formulario** (§ 4.2).
4. **Subir el contraste del borde de los campos de formulario** a ≥ 3:1
   (§ 2.4). Afecta a `Input`, `Select`, `Textarea` y `DmsInput`, que hoy usan
   `border-neutral-200` (1.43:1). Requiere un token de borde de control con
   contraste suficiente; el borde decorativo de `Card` y `KpiCard` puede seguir
   en `neutral-200`, porque no delimita un control.
5. **Corregir los cuatro tokens del semáforo** para que cumplan 3:1 como
   indicador gráfico (§ 2.4). Sin uso todavía: cambio sin regresión posible.
6. **`docs/tecnica/README.md` § 8** recoge el contrato de tokens, la regla de
   composición, los patrones canónicos y la exención de 1.4.3.

Fuera de alcance: rediseño visual, componentes nuevos, y los componentes que las
reglas no señalan. `/design-system` es herramienta de desarrollo, no producto.

## 6. Criterios de aceptación

1. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios.
2. `/design-system` reporta **0 parejas por debajo de su umbral** (la exención
   de 1.4.3 sigue apareciendo como «Exento», no como fallo).
3. Ningún componente del sistema de diseño declara `focus-visible:ring-*`; el
   foco es visible en botones, enlaces, chips, tabs y campos de formulario.
4. Ninguna regla CSS de `globals.css` queda fuera de `@layer`.
5. Los chips de estado son enlaces con `aria-current`, y el filtro sigue
   persistiendo y restaurándose como hoy — verificado con los cuatro casos de
   la tarea 7 de la fase 3: restaura, la URL manda, limpiar olvida, sin bucle.
6. Ningún componente de `design-system/` importa de `@/types/*` ni de
   `@/lib/*` salvo `cn`.
7. Los editores de poligonal siguen viéndose y funcionando igual: el cambio de
   foco y de borde afecta a todos los formularios de la aplicación.
8. La documentación técnica § 8 refleja las reglas.
