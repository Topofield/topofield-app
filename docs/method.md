# Método de planificación incremental — TopoField

Este documento describe **cómo se planifica e implementa TopoField**. No es un PRD: es el proceso de trabajo. El PRD del producto vive en [`PRD-TopoField.md`](../PRD-TopoField.md) y los PRDs detallados por fase en [`docs/prds/`](./prds/).

## Idea central

El PRD principal define qué se construye. Pero entrar a codificar directamente desde un PRD de 37 KB invita a saltarse decisiones, a olvidar validaciones y a mezclar fases. Por eso, **el desarrollo se hace fase por fase, y cada fase tiene su propio PRD detallado** que se redacta **justo antes** de comenzar a implementarla — no antes, no después.

El PRD principal tiene 6 fases (§ 9 del PRD). Cada una recibe su propio PRD-de-fase en `docs/prds/NN-<slug>.md`:

| # | Fase | PRD de fase | Estado |
|---|---|---|---|
| 1 | Setup técnico | [`prds/00-setup.md`](./prds/00-setup.md) | pendiente |
| 2 | Dashboard y Proyectos | [`prds/01-dashboard-proyectos.md`](./prds/01-dashboard-proyectos.md) | pendiente |
| 3 | Módulo Poligonal | [`prds/02-poligonal.md`](./prds/02-poligonal.md) | pendiente |
| 4 | Módulo Nivelación | [`prds/03-nivelacion.md`](./prds/03-nivelacion.md) | pendiente |
| 5 | Módulo Asentamientos | [`prds/04-asentamientos.md`](./prds/04-asentamientos.md) | pendiente |
| 6 | Cierre, Informes, Export | [`prds/05-cierre-informes-export.md`](./prds/05-cierre-informes-export.md) | pendiente |

El estado de cada fila se actualiza al avanzar (`pendiente` → `en curso` → `cerrada`). El mismo estado vive también en [`prds/README.md`](./prds/README.md) como índice rápido.

## El ciclo de una fase

Cada fase atraviesa estas etapas, en orden:

### 1. Apertura — redactar el PRD-de-fase

Antes de tocar código de la fase, se abre una sesión de planificación con el usuario para producir `docs/prds/NN-<slug>.md`. En esa sesión:

- Se leen las secciones relevantes del PRD principal (modelo de datos, algoritmos, validaciones, pantallas) y se aterrizan a decisiones concretas para la fase.
- Se definen pantallas, contratos, validaciones por capa, criterios de aceptación y casos de prueba mínimos.
- Se identifican dependencias con fases anteriores y se acuerda el alcance — qué entra, qué se difiere.
- El PRD-de-fase no tiene plantilla rígida: cada uno adopta la estructura que mejor le sirva. Un PRD de "Setup" no se parece a uno de "Editor de poligonal", y forzarlos al mismo molde introduce ruido.

El PRD-de-fase se commitea apenas se aprueba, antes de empezar a implementar. Marca el inicio del trabajo de esa fase.

### 2. Ejecución

Se implementa siguiendo el PRD-de-fase. Reglas:

- Cambios mínimos: solo lo que sirve a la fase actual.
- `npx tsc --noEmit` después de cada cambio relevante (ver `CLAUDE.md`).
- Commits en español con prefijos `feat:`, `fix:`, `refactor:`, `docs:`. Un commit por cambio lógico.
- Si durante la implementación se descubre que un supuesto del PRD-de-fase es incorrecto, **se actualiza el PRD-de-fase primero** y luego se sigue. El PRD-de-fase es un documento vivo hasta el cierre.

### 3. Cierre de fase

Una fase se cierra cuando:

- Todos los criterios de aceptación del PRD-de-fase están cumplidos y verificados.
- `npx tsc --noEmit` y `npm run lint` pasan limpios.
- Las pruebas mínimas del PRD-de-fase pasan.

Al cerrar:

- Commit final con mensaje `docs: cerrar fase N — <nombre>` que congela el PRD-de-fase.
- Se actualiza la tabla de este archivo (`method.md`) y de `prds/README.md` cambiando el estado a `cerrada`.
- Se anota en este mismo archivo, bajo "Aprendizajes", cualquier cosa que el ciclo enseñó y que vale la pena llevar a la siguiente fase.

### 4. Apertura de la siguiente fase

Solo entonces se abre la siguiente fase con su propio PRD-de-fase. **No se solapan fases**: no se empieza a redactar el PRD de la fase N+1 mientras la fase N sigue abierta. Esto evita arrastrar decisiones a medias.

## Aprendizajes acumulados

Sección viva. Cada cierre de fase añade una entrada con:

- Fecha de cierre
- Qué supuesto del PRD-de-fase resultó incorrecto y cómo se corrigió
- Qué patrón funcionó bien y conviene replicar

(Vacía hasta cerrar la fase 1.)

## Anti-patrones a evitar

- **Saltar a código sin PRD-de-fase aprobado.** Aunque "esté claro", el ejercicio de redactar el PRD-de-fase fuerza decisiones que de otro modo emergen tarde.
- **Redactar todos los PRDs por adelantado.** Lo que se aprende implementando la fase 1 cambia las decisiones óptimas de la fase 2. Redactar todos al inicio congela decisiones con información incompleta.
- **Refactorizar fuera de alcance** durante la ejecución de una fase. Si algo de una fase anterior molesta, se anota en aprendizajes y se trata en la fase a la que pertenece — o en una fase de saneamiento explícita.
- **Cerrar una fase con criterios de aceptación a medias.** Mejor extender el alcance del PRD-de-fase explícitamente que declarar cierre con deuda.
