# PRD-de-fase 27 — Segundo pulido

**Estado:** pendiente (redactado; se abre al cerrar la Fase 26)
**Fecha de redacción:** 2026-10-01

**Rama:** `fase-27-segundo-pulido`
**Petición:** del usuario, 2026-10-01, tras revisar los pendientes: «corrige
CLAUDE.md y prepara el PRD del pulido». Recoge el grupo de pulido de la § 11
de la doc técnica y un fallo del alta de proyecto encontrado al prepararlo.
Va después de la Fase 26 (correcciones del cálculo), por decisión del usuario.
**Módulo:** transversal — alta de proyecto, etiquetas de tipo de poligonal y
nivelación, y acción de guardado de la poligonal

## Propósito

Detalles de la § 11 que no merecían una fase cada uno, más un fallo real:
**pulsar «Siguiente» en el alta de un proyecto lo crea sin mostrar el paso 2**
(PU11). Lo demás es vocabulario que se contradice en pantalla y un test que
falta. La distancia acumulada en coma flotante (antes PU14) pasó a la Fase 26,
junto con los demás arreglos de aritmética.

## Hallazgos que condicionan la fase

### 1. «Siguiente» envía el formulario (PU11)

Encontrado al revisar en pantalla el paso 2, que la § 11 tenía pendiente desde
la Fase 8. `ProjectWizard` pinta en el mismo sitio un `Button type="button"`
(«Siguiente») o un `Button type="submit"` («Crear proyecto») según el paso.
React reutiliza el mismo `<button>` y le cambia el `type`. Al pulsar, el
`setStep(2)` se aplica antes de la acción por defecto del clic, así que el
navegador ve un botón de envío y manda el formulario. El proyecto se crea con
el datum por defecto (MAGNA-SIRGAS) y sin proyección, y el usuario no llega a
ver el paso 2: solo ve «Creando…».

Reproducido en local con Playwright, que pulsa como un usuario: dos clics
crearon dos proyectos (ya borrados). Afecta a producción, que tiene el mismo
código. Los demás formularios no cambian el tipo de un botón al pulsarlo:
revisados.

Además, el subtítulo de la página dice «Registra los datos del proyecto **y del
equipo** en dos pasos»: el equipo salió del proyecto en la Fase 8.

### 2. El paso 2 tiene dos campos

Datum y proyección. La § 11 dejó la duda de si se leía como un `fieldset`
vacío; en pantalla, a 1280 px, son dos campos y dos botones en una tarjeta
casi vacía. El formulario de **editar** el proyecto ya junta los dos grupos en
uno solo (`ProjectEditForm`). La Fase 8 no los fusionó para no rehacer la
validación nativa por paso; con un solo formulario esa validación por paso
desaparece, porque el navegador valida todo el formulario al enviar.

### 3. «Abierta sin control» con vuelta (PU12)

`LEVELING_TYPE_LABELS.open` es «Abierta sin control». Una abierta con vuelta
sí tiene control: la discrepancia entre ida y vuelta, que desde la Fase 23 es
su veredicto. El hub la muestra como «Nivelación · Abierta sin control · ida y
vuelta», y la cabecera, el diálogo de cierre, el informe y el Excel dicen
«Abierta sin control» a secas.

### 4. «Cerrada» y «Cerrado» en la misma fila (PU13)

El hub rotula el tipo en el subtítulo («Poligonal · Cerrada») y el estado en
su badge («Cerrado»). Son cosas distintas —un circuito que vuelve al origen y
un proceso sellado— con la misma palabra a centímetros.

### 5. El amarre sin coordenadas (PU15)

`resolveStartAzimuth` (acción de guardado de la poligonal) rechaza un punto de
amarre sin coordenadas, pero solo por inspección: no tiene test, y la acción
se alcanza con una carga hecha a mano. Al revisarlo:

- un punto que **no existe** recibe el mismo mensaje que uno sin coordenadas;
- la consulta busca el punto por id sin filtrar por proyecto. La RLS impide
  usar el de otro usuario, pero no el de otro proyecto del mismo usuario.

## Alcance

### PU11 · Alta de proyecto

- Arreglar el envío involuntario. La forma depende de la decisión 1.
- El subtítulo deja de mencionar el equipo.
- Manual (§ 4.1, dos copias) y la captura `03-nuevo-proyecto.png`.

### PU12 · Abierta con vuelta

Una función `levelingTypeLabel(type, hasReturnRun)` da la etiqueta del tipo
donde hoy se usa `LEVELING_TYPE_LABELS` para mostrar un proceso: hub,
cabecera, diálogo de cierre, informe y Excel. La forma de la etiqueta depende
de la decisión 2. El manual (§ 6.1, tabla de tipos) se ajusta.

### PU13 · Tipo y estado en el hub

El subtítulo del hub deja de poder confundirse con el estado. La forma depende
de la decisión 3.

### PU15 · Test del amarre

- La parte pura de `resolveStartAzimuth` —del punto de amarre al azimut, o el
  error— sale a una función con tests: con coordenadas, sin norte, sin este,
  sin punto.
- Mensajes distintos para «no existe» y «sin coordenadas».
- La consulta filtra por el proyecto del proceso.

## Decisiones del usuario (por tomar)

1. **Alta de proyecto:** ¿un solo formulario (datos básicos y sistema de
   referencia, como el de editar), o dos pasos con el botón arreglado?
2. **Abierta con vuelta:** ¿cómo se rotula? La auditoría propone «Abierta
   con ida y vuelta», y «sin control» solo para la que no tiene vuelta.
3. **Tipo y estado en el hub:** ¿«Poligonal cerrada» como frase, «Circuito
   cerrado», o se deja?
4. **Los dos diálogos que mueven una poligonal** («Asignar coordenadas
   reales» y «Georreferenciar»): ¿se unifican en esta fase o siguen fuera?

## Pruebas

| Qué | Cómo |
|---|---|
| PU11 | En pantalla: «Siguiente» (o el formulario único) no crea nada hasta pulsar «Crear proyecto»; render del formulario |
| PU12 | Test de `levelingTypeLabel`: los tres tipos, con y sin vuelta |
| PU13 | Render de las filas del hub |
| PU15 | Tests de la función pura: con coordenadas, sin norte, sin este, sin punto |

**En pantalla (local), claro y oscuro, 1280 y 390 px:** el alta de un
proyecto de principio a fin, el hub de la demo con poligonales y
nivelaciones, una abierta con vuelta (cabecera, cierre, informe y Excel).

## Criterios de aceptación

1. Crear un proyecto exige pulsar «Crear proyecto»; no se crea al avanzar.
2. Ninguna nivelación con vuelta se rotula «sin control».
3. El tipo y el estado de un proceso no se confunden en el hub.
4. El rechazo del amarre sin coordenadas tiene test.
5. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` limpios. Manual en sus dos copias y § 11 revisada (se
   cierran las entradas de cada PU).

## Fuera de alcance

- Las decisiones técnicas del motor (desnivel adoptado, σ del nivel digital,
  margen de tendencia, prueba χ²): se revisan aparte.
- Migrar `relative_precision` a número, historial de georreferenciaciones,
  la guarda en atrás y adelante del navegador.
- La distancia acumulada en coma flotante: va en la Fase 26 (C-14).

## Riesgos

- **PU12 y PU13 cambian textos que salen en el informe y el Excel.** Un
  informe ya impreso no cambia (no se guarda), pero uno nuevo de un proceso
  cerrado dirá la etiqueta nueva. Mitigación: es vocabulario, no dato; se
  anota en el manual.

## Tareas (en orden)

0. **Apertura:** estados en `method.md` y `prds/README.md`, `pendientes.md`
   (el PRD ya se commitea con la apertura de la Fase 26). Commit `docs:`.
   Rama.
1. **PU11** — alta de proyecto.
2. **PU15** — función pura, tests y filtro por proyecto.
3. **PU12 y PU13** — etiquetas.
4. **Verificación en pantalla** en local.
5. **Cierre:** manual (dos copias) y capturas que cambien, doc técnica § 11,
   `method.md`, `prds/README.md`, `pendientes.md`. Revisión de código y PR.
