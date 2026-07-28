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

`src/lib/design/contrast.ts` — módulo de funciones puras: hex → RGB, luminancia
relativa, razón de contraste, y `compose(fg, bg, alpha)` para obtener el color
efectivo de un fondo teñido antes de medirlo. Sin React, sin dependencias
nuevas; mismo patrón que `src/lib/calculations/`.

`src/lib/design/contrast.test.ts` declara **la tabla de parejas que el sistema
usa realmente** y afirma el umbral de cada una. La tabla es el contrato en forma
ejecutable: `npm test` ya corre en el proyecto, así que a partir de aquí el
contraste deja de ser un paso manual que alguien deba recordar. Una pareja nueva
introducida en la fase 5 falla la prueba en lugar de llegar a producción.

Lo que esto **no** cubre: verifica las parejas declaradas, no lo que el JSX
compone en tiempo de ejecución. Las clases se ensamblan dinámicamente
(`TONE_CLASSES`, `cn()`), y rastrearlas desde el código fuente sería frágil. Una
auditoría real sobre el DOM con Playwright —ya presente como devDependency para
`docs/manual/capturas.mjs`— queda registrada como trabajo futuro, no como
guardarraíl de cada commit: necesita servidor y base sembrada.

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
   Simplifica el componente y salda deuda registrada.
3. **Retirar los `ring` de `buttonClasses`, `Input`, `Select`, `Textarea`;
   ampliar el selector base a los campos de formulario** (§ 4.2).
4. **`src/lib/design/contrast.ts` + su tabla de parejas** (§ 2.3).
5. **`docs/tecnica/README.md` § 8** recoge el contrato de tokens, la regla de
   composición y los patrones canónicos.

Fuera de alcance: rediseño visual, componentes nuevos, tokens nuevos, y los
componentes que las reglas no señalan.

## 6. Criterios de aceptación

1. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios.
2. `contrast.test.ts` cubre las tres parejas de cada token de estado, las de
   `primary`, y falla si se altera un token por debajo de su umbral.
3. Ningún componente del sistema de diseño declara `focus-visible:ring-*`; el
   foco es visible en botones, enlaces, chips, tabs y campos de formulario.
4. Ninguna regla CSS de `globals.css` queda fuera de `@layer`.
5. Los chips de estado son enlaces con `aria-current`, y el filtro sigue
   persistiendo y restaurándose como hoy.
6. Ningún componente de `design-system/` importa de `@/types/*` ni de
   `@/lib/*` salvo `cn`.
7. La documentación técnica § 8 refleja las reglas.
