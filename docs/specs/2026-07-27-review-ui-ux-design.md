# Review UI/UX — refinamiento transversal

**Fecha:** 2026-07-27
**Alcance:** fases 2 (Dashboard y Proyectos) y 3 (Módulo Poligonal), ya cerradas.
**Naturaleza:** trabajo transversal de UI/UX, no una fase nueva del § 9 del PRD.

---

## 1. Contexto

Recorrido completo de los flujos implementados con capturas en 1440px y 390px:
landing, sign-in, sign-up, dashboard, wizard de proyecto, hub del proyecto (3 tabs),
creación de poligonal y editor en los tres estados (`calculated`, `closed`, `rejected`).

Sin errores de consola. Todas las rutas responden 200. Los problemas detectados son
de semántica, jerarquía visual y flujo, más una inconsistencia de datos en el seed.

## 2. Diagnóstico

### 2.1 Verdad de datos

Las tarjetas del hub muestran **"Sin calcular"** en procesos cuyo badge dice
"Calculado". La causa no está en la aplicación: `saveProcess`
(`src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts:144-172`) persiste
correctamente `angular_error_seconds`, `linear_error`, `perimeter`,
`relative_precision` y `meets_tolerance`.

El origen es `scripts/seed.mjs`, que inserta procesos con `status: "calculated"`
sin escribir ninguno de esos campos. El resultado es un estado que la aplicación
nunca produce por sí misma: calculado sin resultados.

Verificado en base de datos: los 7 procesos del seed tienen `linear_error`,
`relative_precision` y `meets_tolerance` en `NULL`.

### 2.2 Cierre fuera de tolerancia

El proceso "Pentágono oficial (cerrado)" está en `status: closed` con precisión
relativa 1:46, contra un proyecto de tercer orden que exige 1:5000. El editor lo
reporta correctamente como "No cumple la tolerancia", pero la tarjeta del hub lo
muestra con el mismo badge verde "Cerrado" que un levantamiento conforme.

Cerrar fuera de tolerancia es un caso legítimo —documentar un levantamiento
deficiente— pero hoy es indistinguible de un cierre correcto.

### 2.3 Gestalt

- Configuración, Estaciones y Resultados usan la misma tarjeta blanca con el mismo
  borde y el mismo peso. No hay jerarquía: los tres bloques compiten por igual.
- El veredicto de tolerancia —la información que el topógrafo busca— es un punto
  de 8px con texto de 14px, al fondo de la página. Tiene menos peso visual que el
  enlace "Eliminar" de cada fila de estación.
- Configuración ocupa el primer tercio del editor de forma permanente, aunque se
  capture una vez y se consulte rara vez.

### 2.4 Flujo

- "Guardar" y "Cerrar proceso" son botones azules idénticos y adyacentes. Uno es
  reversible; el otro es irreversible y bloquea el proceso para siempre.
- El hub agrupa en dos secciones: "En progreso" (que incluye procesos ya calculados)
  y "Cerrados" (que mezcla `closed` con `rejected`, desenlaces opuestos).
- Dos de los tres KPI del dashboard muestran "—" con el texto "Disponible al
  implementar los módulos de proceso". Anuncian su propia ausencia.

### 2.5 Campo (móvil, 390px)

La tabla de estaciones tiene `overflow-x-auto`
(`src/components/polygonal/stations-table.tsx:75`), por lo que no se pierde
contenido, pero Azimut, ΔN y ΔE quedan fuera de vista sin ninguna señal visual de
que existan. Es la vista que se usa en campo, donde la captura ocurre.

Los campos DMS (grados, minutos, segundos) son demasiado angostos para uso táctil.

### 2.6 Estética

La paleta está definida y es correcta (azul geodésico `#0b3d5c` / `#1a7fb5`,
`src/app/globals.css`), pero infrautilizada. Todo el texto usa `system-ui`,
incluidas coordenadas, azimuts y precisiones. En una aplicación donde la coordenada
es el producto, los números no tienen tratamiento tipográfico propio.

## 3. Decisiones

Tomadas con el usuario antes de redactar esta spec:

| Eje | Decisión |
|---|---|
| Alcance | Incluir la corrección de datos, no solo UI |
| Ambición visual | Refinar la identidad actual, sin rediseño de marca |
| Móvil | Objetivo real: se captura en campo |

## 4. Diseño

### 4.1 Verdad de datos

**Seed.** `scripts/seed.mjs` debe producir estados que la aplicación pueda producir.
Dos opciones, a elegir en implementación:

- Calcular los resultados con `computePolygonal` e insertarlos, o
- Insertar los procesos como `draft` / `in_progress` y dejar que el primer guardado
  los calcule.

La primera preserva la utilidad de los fixtures (que existen para representar casos
de tolerancia concretos) y es la recomendada.

**Guarda de cierre.** El diálogo de cierre exige una nota justificativa cuando
`meets_tolerance === false`. El proceso se cierra igual —no se bloquea— pero queda
la trazabilidad de por qué.

**Estado visual.** Un proceso cerrado fuera de tolerancia se muestra como
"Cerrado fuera de tolerancia" en ámbar, distinto del "Cerrado" verde de un
levantamiento conforme.

### 4.2 Jerarquía del editor

Principio: **el veredicto de cierre es el producto; todo lo demás es insumo.**

```
┌─ CUADRADO CON ERROR 0.4 M ───────────── [Calculado] ─┐
│                                                       │
│  ╔═══════════════════════════════════════════════╗   │
│  ║  ✕  NO CUMPLE TERCER ORDEN                    ║   │
│  ║     1:1.001        requerido 1:5.000          ║   │
│  ║     Error de cierre 0.400 m · 400.400 m       ║   │
│  ╚═══════════════════════════════════════════════╝   │
│                                                       │
│  ▸ Configuración                          [colapsado] │
│  ▾ Estaciones                                    (4)  │
│  ▾ Resultados detallados                              │
└───────────────────────────────────────────────────────┘
```

- El veredicto sube al tope de la página, en banda de color, con la precisión
  alcanzada y la requerida enfrentadas.
- Configuración se colapsa automáticamente cuando el proceso está calculado.
  Permanece expandida en `draft` e `in_progress`.
- Resultados detallados conserva la tabla completa de verificación angular, cierre
  lineal y coordenadas corregidas.

Estados del veredicto:

| Condición | Color | Texto |
|---|---|---|
| `meetsTolerance === true` | verde `#27ae60` | Cumple {orden} |
| `meetsTolerance === false` | rojo `#e74c3c` | No cumple {orden} |
| `open_uncontrolled` | neutro | Sin verificación de cierre |
| Datos incompletos | neutro | Datos incompletos |

### 4.3 Tipografía de datos

Cambio de mayor retorno y menor riesgo.

- **Datos numéricos** (coordenadas, azimuts, ΔN/ΔE, precisiones, errores):
  familia monoespaciada con cifras tabulares. Los dígitos se alinean en columna,
  permiten comparación vertical y hacen evidente un orden de magnitud fuera de
  lugar. Es la convención de las carteras de campo y las planchas catastrales.
- **Interfaz** (etiquetas, botones, navegación): se mantiene la sans actual.
- **Color**: se refuerza el azul geodésico existente. Ámbar `#f39c12` queda
  reservado exclusivamente para "cerrado fuera de tolerancia"; rojo `#e74c3c`
  exclusivamente para rechazo y para incumplimiento de tolerancia.

No se introducen tipografías de display ni cambios de marca.

### 4.4 Flujo

**Acciones del editor.** "Guardar" permanece como primario azul. "Cerrar proceso"
pasa a secundario con borde, separado visualmente del grupo primario, por ser
irreversible.

**Agrupación del hub.** Cuatro secciones que reflejan los estados reales:

- Borradores (`draft`, `in_progress`)
- Calculados (`calculated`)
- Cerrados (`closed`)
- Rechazados (`rejected`)

**KPI del dashboard.** Se reemplazan los dos KPI vacíos por métricas derivables de
los datos existentes: procesos calculados y procesos fuera de tolerancia. Los KPI
de módulos no implementados se omiten hasta que existan.

### 4.5 Campo (móvil)

Por debajo de 768px, la tabla de estaciones se reemplaza por **tarjetas por
estación**: el código de estación como encabezado, y ángulo, distancia, azimut,
ΔN y ΔE apilados y etiquetados. Ninguna columna queda fuera de vista.

Los campos DMS pasan a targets táctiles de 44px de alto.

Por encima de 768px se conserva la tabla actual, que es densa y correcta para
escritorio.

## 5. Fuera de alcance

- Rediseño de marca o cambio de paleta base.
- Lenguaje visual cartográfico (curvas de nivel, retícula). Evaluado y descartado
  a favor de refinar la identidad existente.
- Módulos de nivelación y asentamientos (fases 4 y 5, no implementadas).
- Visualización geoespacial del polígono, fuera del alcance del PRD principal.

## 6. Criterios de aceptación

1. Ningún proceso muestra "Sin calcular" y "Calculado" simultáneamente.
2. Un proceso cerrado fuera de tolerancia es visualmente distinguible de uno
   conforme, en el hub y en el editor.
3. El cierre fuera de tolerancia exige nota justificativa.
4. El veredicto de tolerancia es el primer elemento del editor en procesos
   calculados.
5. Los datos numéricos usan familia monoespaciada con cifras tabulares.
6. "Cerrar proceso" no es visualmente equivalente a "Guardar".
7. El hub distingue cuatro estados de proceso.
8. En 390px, ninguna columna de estaciones queda fuera de vista.
9. `npm run typecheck` y `npm run test` pasan.
10. Los procesos cerrados siguen siendo inmutables: sin UPDATE sobre `closed`.
