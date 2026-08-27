# Auditoría de seguridad y pentest — TopoField

**Fecha:** 2026-08-26
**Remediación:** 2026-08-26 (ver § 0)
**Alcance:** aplicación Next.js 16 + Supabase, monografía de grado, un solo rol de usuario.
**Método:** reproducción local (`npx supabase start`) con dos usuarios reales; ataques
a nivel de base (RLS simulando JWT) y a nivel de API REST (PostgREST con JWT firmado con
el `JWT_SECRET` local). Contra producción, solo lectura de cabeceras HTTP. **No se tocaron
datos de producción.** Todo hallazgo se acompaña de su reproducción.

---

## 0. Estado de la remediación

Sesión de remediación del 2026-08-26. Cada arreglo se verificó con el ciclo
**reproducir → arreglar → reproducir**: el ataque se ejecuta primero contra el
código sin arreglar (debe tener éxito), se aplica el fix, y se repite el mismo
ataque (debe fallar). Un arreglo sin esa doble prueba no se dio por bueno.

| Hallazgo | Severidad | Estado | Arreglo |
|---|---|---|---|
| H-1 | ALTA | **Arreglado y verificado** | `supabase/migrations/20260826120000_reject_write_on_closed_site_point.sql` |
| H-2 | MEDIA | **Arreglado y verificado** | `next` 16.2.4 → 16.3.3 + `overrides` — `npm audit` en **0** |
| H-3 | MEDIA | **Arreglado (parcial: sin CSP)** | `next.config.ts` — 4 cabeceras + `poweredByHeader: false` |
| H-4 | BAJA | **Arreglado y verificado** | `supabase/migrations/20260826120100_reports_insert_check_generated_by.sql` |
| § 4 · Redirect URLs | — | **Comprobado: no explotable** | Sin cambios; la allowlist de producción ya era exacta |

Los datos locales quedaron restaurados: `projects` 5, `settlement_readings` 36,
`polygonal_stations` 58, `reports` 2, `settlement_points` 6, y la `C0` del lugar
cerrado en `100.0000`. No se escribió nada en producción (la única operación
contra la nube fue una **lectura** de la configuración de Auth, § 4).

### H-1 — arreglado

- **Antes:** `PATCH /rest/v1/settlement_points?site_id=eq.<cerrado>` → **HTTP 204**,
  las 6 `C0` pasaron a 95.0000. Efecto medido en la visita 5: el acumulado
  recalculado en vivo pasó de `-8.5 mm` a `+4991.5 mm`.
- **Fix:** trigger `settlement_points_reject_write_when_site_closed`
  (`BEFORE INSERT/UPDATE/DELETE`) con la función
  `reject_write_on_closed_site_point()`, análoga a
  `reject_write_on_closed_site_visit()`. Migración nueva; no se tocó
  `20260825230000_reject_write_on_closed_site.sql`, que ya está en la nube.
- **Después:** el mismo PATCH → **HTTP 400 / `23001`**. También bloqueados el
  `DELETE` de un punto y el `INSERT` de un punto nuevo en el lugar cerrado.
- **Flujo legítimo intacto:** en un lugar **abierto**, INSERT (201), UPDATE (204)
  y DELETE (204) de puntos siguen funcionando; cerrar un lugar abierto sigue
  funcionando; el borrado en cascada `sites → settlement_points` de un lugar
  abierto sigue funcionando. `resyncSiteReadings` se ejecutó de verdad contra
  un lugar abierto con puntos, visitas y lecturas: `{"ok":true}` y los
  acumulados se recalcularon correctamente al cambiar la `C0`.
- **Matiz, no regresión:** `resyncSiteReadings` sobre un lugar **cerrado**
  devuelve error, pero es **anterior a este fix** — lo provoca el trigger de
  `settlement_readings` de la migración del 25/08. Comprobado desactivando y
  reactivando el trigger nuevo: el resultado es idéntico en ambos casos. En la
  app esa ruta es inalcanzable: `loadOpenSite` rechaza el lugar cerrado antes
  de llamar a `resyncSiteReadings`.
- Tipos regenerados y comparados: **idénticos** (un trigger no cambia el esquema).

### H-2 — arreglado

- **Antes:** `npm audit --omit=dev` → 9 vulnerabilidades (7 altas), con `next`,
  `postcss`, `sharp` y `nanoid` en la ruta de producción.
- **Fix:** `next` 16.2.4 → **16.3.3** (no *breaking*), fijado sin `^` para
  seguir el estilo del `package.json`.
- **Después:** 5 vulnerabilidades (3 altas). `next`, `postcss`, `sharp` y
  `nanoid` **desaparecen**: los avisos de *Middleware/Proxy bypass* quedan
  cerrados. Sigue en Next 16, no se saltó a 17.
- **Verificado:** `npm run build` completo (todas las rutas compilan, el
  `ƒ Proxy (Middleware)` sigue registrado), `typecheck` limpio, **392 tests en
  25 archivos** pasan, `lint` limpio.
- **Las 5 restantes también quedaron cerradas** (2026-08-27), sin perder
  funcionalidad. `npm audit` da **0 vulnerabilidades** en producción y en
  desarrollo.
  - `uuid`, `tmp`, `ws` y `brace-expansion` se fuerzan a su versión parcheada
    con `overrides` en `package.json`. El override es el mecanismo correcto
    aquí: `exceljs@4.4.0` es la última versión publicada (2024-12) y declara
    `uuid@8`, pero **solo llama a `v4()` y sin búfer**, mientras que el aviso
    afecta a `v3/v5/v6` *con* búfer — así que `uuid@11` le vale igual.
  - El «arreglo» que proponía `npm audit` para `exceljs` —bajar a `3.4.0`— es
    una versión de **2014** sin `writeBuffer()`: habría obligado a reescribir
    las tres rutas de exportación **a cambio de nada**, porque la ruta
    vulnerable no es alcanzable desde nuestro código. Descartado.
  - Los avisos de desarrollo (`vite`, `@babel/core`, `js-yaml`) se cerraron con
    `npm audit fix`.
- **Verificación del export tras el cambio:** libro generado y releído en
  proceso (formatos numéricos conservados), y **descarga real por HTTP** con
  sesión de navegador contra la ruta de asentamientos: **HTTP 200**, 12 428
  bytes, firma `PK`, `content-type` de xlsx, `content-disposition` correcto y
  `nosniff` presente. Abierto con `exceljs`: 3 hojas («Datos Crudos»,
  «Cálculos», «Resumen») con el catálogo y las cotas correctos.

### H-3 — arreglado en su parte segura; la CSP queda a decisión

- **Antes:** producción sin ninguna de las cabeceras; además `x-powered-by: Next.js`.
- **Fix aplicado** en `next.config.ts` (`async headers()` sobre `/:path*`):
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`,
  y `poweredByHeader: false`.
- **Después (verificado sobre el servidor de producción local, no solo en el
  config):** las cuatro cabeceras aparecen en `/sign-in` y también en la ruta de
  exportación `.xlsx` —que es donde `nosniff` importa—; `x-powered-by` ya no se
  emite. Las páginas siguen renderizando.
- **Pendiente de decisión: la CSP.** Es la parte con riesgo real de romper
  estilos y el visor de Excel, así que no se aplicó por cuenta propia. Ver la
  propuesta al final de este documento. Mientras tanto, `frame-ancestors` queda
  cubierto por `X-Frame-Options: DENY`.

### H-4 — arreglado

- **Antes:** `POST /rest/v1/reports` con `generated_by` de otro usuario en un
  proyecto propio → **HTTP 201**, fila creada con la autoría falsa.
- **Fix:** la política `reports_insert_via_project` añade
  `and generated_by = auth.uid()::text` (el campo es `text`, de ahí el cast).
- **Después:** el mismo POST → **HTTP 403 / `42501`**.
- **Flujo legítimo intacto:** el mismo POST con `generated_by` propio → **201**.
  No cambia la aplicación: `createReportAction` ya fijaba `generated_by = user.id`.

---

## 1. Resumen ejecutivo

**¿Es seguro desplegar esto tal como está? Con una salvedad, sí — hay una brecha real
que conviene cerrar antes, pero no compromete el aislamiento entre usuarios.**

La garantía central del producto —que un usuario no vea ni toque datos de otro— **se
sostiene**: RLS bloquea lectura y escritura entre inquilinos en las 12 tablas, verificado
tanto a nivel de base como por la API REST directa, incluidas las tablas hijas de forma
independiente del `join`. Los secretos no se filtran al cliente, el registro por invitación
falla cerrado, y no hay XSS ni open-redirect. La brecha es de **integridad, no de
confidencialidad**: el catálogo de puntos de un lugar de asentamientos cerrado (`settlement_points`)
es el único eslabón del modelo de inmutabilidad sin trigger de base, de modo que su propio
dueño puede alterar por REST directo la cota base `C0` de un lugar sellado y, con ello,
reescribir todo el histórico de asentamientos que la app recalcula en vivo. Es el mismo
patrón que el proyecto ya documentó como decisivo —«la segunda capa [el trigger] es la que
cuenta»— aplicado a la única tabla donde esa segunda capa no existe. Es un arreglo de una
migración.

---

## 2. Hallazgos

Ordenados por severidad.

### H-1 · ALTA · Un lugar de asentamientos cerrado es mutable vía REST directo (falta trigger en `settlement_points`)

> **Estado: [ARREGLADO]** — ver § 0.

- **Dónde:** `supabase/migrations/20260825230000_reject_write_on_closed_site.sql` — protege
  `settlement_visits` y `settlement_readings`, **no** `settlement_points`. La defensa de
  aplicación sí existe y es correcta: `src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts:50`
  (`loadOpenSite` rechaza el lugar cerrado en crear/editar/borrar puntos). Pero el modelo de
  seguridad del propio proyecto declara que esa capa es *bypasseable* por REST y que «la
  segunda capa [el trigger de base] es la que cuenta» (`docs/tecnica/README.md` § 5). Para
  `settlement_points` no hay segunda capa.

- **Por qué importa en este producto:** el asentamiento acumulado se recalcula siempre en vivo
  como `(cota − C0) × 1000` (`src/lib/calculations/settlement.ts:105`), tanto en el panel de
  análisis como en la ruta de exportación a Excel (`.../settlement/[siteId]/export/route.ts:78`,
  que explícitamente **recalcula** en vez de leer lo persistido). Alterar `initial_elevation`
  (la `C0`) de un punto cambia retroactivamente todo el histórico mostrado de un lugar que la
  interfaz presenta como cerrado e inmutable — el registro trazable que el módulo existe para
  proteger. También `northing`/`easting` alimentan la distorsión angular.

- **Prueba de explotación reproducible** (local; el dueño legítimo del lugar cerrado
  «Edificio Torre Central», atacando por REST y saltándose la app):

  ```bash
  API="http://127.0.0.1:54321"
  PUB="<PUBLISHABLE_KEY local>"     # de `npx supabase status`
  # JWT del dueño firmado con el JWT_SECRET local (HS256), sub = su user_id
  TOK="<jwt>"
  SITE="88444937-b313-48bb-9652-37ded85d920e"   # lugar en estado 'closed'

  # CONTROL — la cabecera del lugar cerrado SÍ está protegida por trigger:
  curl -X PATCH "$API/rest/v1/sites?id=eq.$SITE" \
       -H "apikey: $PUB" -H "Authorization: Bearer $TOK" \
       -H "Content-Type: application/json" -d '{"name":"HACK"}'
  # -> HTTP 400 (reject_update_on_closed_process)

  # ATAQUE — los puntos del lugar cerrado NO están protegidos:
  curl -X PATCH "$API/rest/v1/settlement_points?site_id=eq.$SITE" \
       -H "apikey: $PUB" -H "Authorization: Bearer $TOK" \
       -H "Content-Type: application/json" -d '{"initial_elevation":95.0}'
  # -> HTTP 200, C0 cambiada. Efecto medido en la visita 5:
  #    acumulado antes: -8.5 mm (normal) -> recalculado: +491.5 mm
  ```

  Verificado también con `UPDATE` a nivel de base simulando el JWT: 6 puntos modificados,
  éxito. (El cambio se revirtió; los datos locales quedaron restaurados a `C0 = 100.0000`.)

- **Impacto real:** integridad del registro inmutable de asentamientos. No cruza inquilinos
  —RLS sigue impidiendo tocar puntos ajenos—, así que un usuario solo puede corromper *sus
  propios* lugares cerrados. Para una monografía cuyo valor es la trazabilidad del cierre, es
  un hueco que contradice una garantía explícita del diseño.

- **Arreglo propuesto:** añadir a `settlement_points` un trigger `BEFORE INSERT/UPDATE/DELETE`
  análogo a `reject_write_on_closed_site_visit()` — consultar el `sites.status` del `site_id`
  de la fila (NEW/OLD) y rechazar con `23001` si es `'closed'`. Una migración nueva (la
  original ya está en la nube; no editarla). Considerar además revisar si el borrado en
  cascada `settlement_points → sites` deja alguna otra vía (el `DELETE` del lugar cerrado sí
  está cubierto porque `reject_delete_on_closed_process` dispara en `sites`).

### H-2 · MEDIA · Next.js 16.2.4 con avisos de *Middleware/Proxy bypass* de severidad alta

> **Estado: [ARREGLADO]** — ver § 0.

- **Dónde:** `package.json` fija `next` en 16.2.4; `npm audit` reporta varios CVE altos,
  entre ellos múltiples «Middleware / Proxy bypass in App Router applications». El fix no es
  *breaking*: **16.3.3** (`fixAvailable` de `npm audit`).

- **Por qué importa —y por qué es MEDIA y no ALTA:** el control de acceso de la app **no
  depende del proxy en solitario**. Cada ruta que sirve datos crea su propio cliente de
  Supabase y se apoya en RLS (rutas de exportación, Server Actions, loaders de página), y el
  layout del grupo autenticado revalida la sesión por su cuenta
  (`src/app/(app)/layout.tsx:19` hace `getUser()` y redirige si no hay usuario). Un bypass del
  proxy dejaría *llegar* una petición no autenticada a una ruta, pero RLS no devuelve nada sin
  sesión válida y las páginas vuelven a comprobar. Aun así, el proxy es la primera línea y
  ejecutar una versión con bypass conocido de esa capa es deuda que se salda con un bump menor.

- **Prueba:** `npm audit --omit=dev` → 9 vulnerabilidades (7 altas) en la ruta de producción;
  `next` entre ellas con `fixAvailable: { version: "16.3.3", isSemVerMajor: false }`.

- **Arreglo:** `npm i next@16.3.3` (o `npm audit fix`), reconstruir y redesplegar. Verificar
  que sigue en Next 16 (no saltar a 17). Ver también H-5 para el resto de dependencias.

### H-3 · MEDIA · Sin cabeceras de seguridad en producción (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

> **Estado: [ARREGLADO — sin CSP]** — ver § 0.

- **Dónde:** `next.config.ts` no define `headers()`. La respuesta de producción
  (`https://topofield-app.vercel.app/sign-in`) trae `strict-transport-security` (bien) pero
  **ninguna** de: `content-security-policy`, `x-frame-options`, `x-content-type-options`,
  `referrer-policy`, `permissions-policy`. Además expone `x-powered-by: Next.js`.

- **Prueba:**
  ```bash
  curl -sS -D - -o /dev/null https://topofield-app.vercel.app/sign-in \
    | grep -iE 'content-security|x-frame|x-content-type|referrer|permissions'
  # (sin coincidencias)
  ```

- **Impacto real:** moderado. No hay `dangerouslySetInnerHTML` en el código (ver § 3), así que
  la superficie de XSS es baja; pero sin `X-Frame-Options`/CSP `frame-ancestors` la app es
  enmarcable (clickjacking), y sin `X-Content-Type-Options: nosniff` un binario servido —los
  `.xlsx` de exportación— podría sufrir MIME-sniffing en clientes antiguos. Es defensa en
  profundidad que hoy falta por completo.

- **Arreglo:** añadir `async headers()` en `next.config.ts` con, como mínimo,
  `X-Frame-Options: DENY` (o CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, y una CSP a medida. Quitar `x-powered-by`
  con `poweredByHeader: false`.

### H-4 · BAJA · Un informe puede fabricarse por REST con atribución y contenido arbitrarios (dentro del propio proyecto)

> **Estado: [ARREGLADO]** — ver § 0.

- **Dónde:** política RLS de `INSERT` en `reports` — su `WITH CHECK` liga `project_id` al
  dueño, pero **no** restringe `generated_by` ni el contenido de `included_processes`. La
  Server Action `createReportAction` (`src/app/(app)/projects/[id]/reports/actions.ts:37`) sí
  revalida la elegibilidad contra la base y fija `generated_by = user.id`; el hueco es que un
  `POST` directo a `/rest/v1/reports` se la salta.

- **Prueba:** `POST` REST con `generated_by` de otro usuario y `included_processes` arbitrario
  en un proyecto propio → HTTP 201 (fila creada con la atribución falsa). (Fila de prueba
  eliminada tras verificar.)

- **Impacto real: bajo, y contenido por RLS en la lectura.** El informe *impreso*
  (`.../reports/[reportId]/print/page.tsx:115`) **re-obtiene** cada proceso por id con el
  cliente RLS y comprueba `project_id`, renderizando «missing» si no cuadra: una entrada
  forjada que apunte a otro proyecto **no** filtra datos ajenos. El `name` forjado solo
  aparece como etiqueta en la vista de resumen, dentro del proyecto del propio atacante, y se
  renderiza vía JSX (escapado). Es, en la práctica, vandalismo de los propios datos y
  falsificación de la atribución de autor de un informe propio.

- **Arreglo (opcional, endurecimiento):** añadir `WITH CHECK (generated_by = auth.uid())` a la
  política de `INSERT` de `reports`. No cambia el flujo de la app (ya escribe `user.id`).

---

## 3. Lo que se comprobó y salió bien

- **Aislamiento entre usuarios (RLS) — la garantía central: sólida.** Con dos usuarios reales
  en local, simulando el JWT del atacante:
  - **Lectura:** el atacante ve **cero** filas de las 12 tablas fuera de su proyecto
    (`projects`, `reference_points`, `sites`, `settlement_points/visits/readings`,
    `polygonal_processes/stations`, `leveling_processes/readings`, `reports`, `profiles`). Los
    procesos que sí ve son los de su propio proyecto demo (verificado por `project_id`).
  - **Escritura cruzada — 13 vectores, todos bloqueados:** UPDATE/DELETE de proyecto ajeno
    (0 filas), UPDATE/DELETE de estaciones y lecturas ajenas (0 filas), INSERT en proyecto
    ajeno (`42501`), INSERT de estación colgada de proceso ajeno (`42501`), robo de proyecto
    por cambio de `user_id` (0 filas), reparenting de un proceso propio al proyecto de la
    víctima (`WITH CHECK` lo rechaza), UPDATE de perfil ajeno (0 filas), reasignación del
    propio `profiles.id` al de la víctima (`42501`). Un control (INSERT en el proyecto propio)
    **sí** funcionó, confirmando que las pruebas llegaban a la base.
  - **Tablas hijas aisladas de forma independiente:** el bloqueo no depende del `join` de la
    aplicación — la política de `polygonal_stations`/`settlement_readings`/`leveling_readings`
    filtra por sí misma vía `EXISTS` al proyecto contenedor.
  - **IDOR por API REST directa:** con JWT del atacante, `GET /rest/v1/projects?id=eq.<ajeno>`
    devuelve `[]`; las 15 estaciones que devuelve sin filtro son las suyas.

- **Inmutabilidad de lo cerrado: correcta salvo H-1.** 7 funciones `reject_*` y 14 triggers.
  Las tablas hijas (`polygonal_stations`, `leveling_readings`, `settlement_readings`) rechazan
  INSERT+UPDATE+DELETE sobre proceso/lugar cerrado. Reproducido contra un lugar cerrado real:
  UPDATE/DELETE de cabecera, visita y lectura → todos `23001`/HTTP 400. El **borrado en
  cascada** de un punto de un lugar cerrado también se bloquea, porque el trigger de
  `settlement_readings` dispara sobre las filas que la cascada intenta borrar. La única vía sin
  cubrir es la mutación *directa* de `settlement_points` (H-1).

- **Revalidación en el servidor.** `createReportAction` parte de lo que la base dice que está
  cerrado (`getClosedWorkForReports` + `isEligible`), no de los ids que llegan; rechaza
  procesos abiertos, rechazados o de otro proyecto. La captura de los tres módulos se revalida
  con los validadores puros y se recalcula con el motor antes de persistir (documentado y
  ejercido en fases previas).

- **Secretos no filtrados al cliente.** `grep -rF` del valor de `SUPABASE_SECRET_KEY`, del
  `SIGNUP_INVITE_CODE` y de `service_role` sobre `.next/static`: **ninguno** aparece.
  `SUPABASE_SECRET_KEY` solo se referencia en `scripts/` (seed y reparación); ningún archivo de
  `src/` lo usa. Ninguna variable sensible lleva prefijo `NEXT_PUBLIC_`.

- **Registro por invitación: falla cerrado.** `invitacionValida` devuelve `false` si la
  variable no está definida (`src/lib/validators/sign-up.ts:41`), el código se comprueba solo
  en el Server Action, y nunca viaja al cliente.

- **Autenticación.** `updateSession` usa `getUser()`, que valida el token contra el servidor de
  Auth (no confía en la cookie decodificada). El grupo `(app)` revalida la sesión en su layout.
  El `/auth/callback` **no** acepta un `next`/`redirectTo` del query —redirige siempre a
  `/dashboard`—, así que no hay open redirect. El `error_description` que sí refleja va
  URL-encodeado a `/sign-in?error=…` y se renderiza como `{error}` en JSX (escapado).

- **XSS.** **Cero** `dangerouslySetInnerHTML` en todo `src/`. Nombres de proceso,
  observaciones y notas se renderizan como texto JSX; React los escapa. El informe imprimible
  y el manual no inyectan HTML crudo.

- **Inyección en `Content-Disposition` de las exportaciones: cerrada.** `safeFilename`
  (`src/lib/export/workbook.ts:135`) normaliza a NFD, colapsa todo lo que no sea `[A-Za-z0-9]`
  en `-` y trunca a 60 — no hay forma de inyectar CRLF ni comillas en la cabecera.

- **Fuga entre proyectos en exportación/informes: no la hay.** Las tres rutas de exportación
  cargan proyecto e hijo con el cliente RLS y comparan `project_id`, devolviendo 404 en caso
  contrario; el informe impreso re-obtiene cada proceso con RLS y descarta lo que no pertenece
  al proyecto.

## 4. Lo que no se pudo comprobar en la auditoría

> El primer punto —la allowlist de Redirect URLs— **quedó resuelto** en la
> sesión de remediación del 2026-08-26. Se deja el resto como estaba.

- **Allowlist de *Redirect URLs* de producción (Supabase cloud) — RESUELTO el
  2026-08-26: no es explotable.** `urlDeCallback`
  (`src/app/(auth)/sign-up/actions.ts:35`) deriva el host del correo de
  confirmación de `x-forwarded-host`, cabecera controlable por el cliente. La
  duda era si la allowlist de producción tenía comodines. Se consultó **en solo
  lectura** la configuración de Auth del proyecto en la nube (Management API,
  `GET /v1/projects/<ref>/config/auth`) y el resultado es:

  ```
  SITE_URL:       https://topofield-app.vercel.app
  URI_ALLOW_LIST: https://topofield-app.vercel.app/auth/callback
  ```

  Una única URL **exacta y sin comodines**. Un `x-forwarded-host` inyectado no
  coincide con la lista, así que Supabase cae a `site_url` y el enlace de
  confirmación nunca sale hacia un host atacante: **no hay robo del `code` PKCE**.
  No hace falta ninguna acción manual. *Recomendación de mantenimiento:* si algún
  día se añade un dominio o un entorno de preview, mantenerlos exactos y no
  introducir comodines.

- **Pentest HTTP de extremo a extremo con el stack Next real.** El servidor de dev no estaba
  levantado durante la auditoría. La autorización de las rutas de exportación e informes se
  verificó por su equivalente real —RLS por la API REST directa, que es la vía que el propio
  modelo de seguridad considera la peligrosa— y por lectura del código (lógica 404-on-null
  trivial). No se ejercieron las rutas `/…/export` ni `/…/print` sirviendo binarios/HTML por
  HTTP con una cookie de sesión de navegador; el resultado sería el mismo que el ya probado
  vía REST/RLS, pero queda anotado como no ejecutado por esa vía.

- **E/S de los Server Actions bajo carga / condiciones de carrera.** Fuera de alcance de una
  auditoría de seguridad estática; el proyecto ya documenta (§ 11) que esta capa carece de
  tests de integración por no poder mockear el cliente de Supabase.

---

## 5. Pendiente de tu decisión — la CSP (parte de H-3)

Las otras cuatro cabeceras ya están puestas porque no tienen efectos
secundarios. La CSP sí los tiene, así que va aquí en vez de aplicada.

**El problema:** Next inyecta estilos y scripts *en línea* en el HTML que sirve
(el arranque de React, los estilos críticos), y la app usa además `style={{…}}`
en tres componentes (`settlement-chart.tsx:255` y dos en la página del sistema
de diseño). Una CSP estricta sin más rompe eso.

Dos opciones reales:

**Opción A — CSP con `'unsafe-inline'` en estilos (recomendada aquí).**
Estática, se pone en `next.config.ts` junto a las demás y no toca código:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://<ref>.supabase.co https://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

Cierra clickjacking, inyección de `<base>`, `<object>` y exfiltración a
dominios arbitrarios. No protege frente a XSS *inline*, pero la auditoría
verificó **cero** `dangerouslySetInnerHTML` en todo `src/`, así que hoy esa
superficie no existe. Riesgo de rotura: **bajo**. Las fuentes son de
`next/font/google`, que las auto-aloja en el build, así que `font-src 'self'`
basta y no hace falta abrir `fonts.gstatic.com`.

**Opción B — CSP con nonce por petición.** Más estricta (elimina
`'unsafe-inline'` en scripts), pero exige generar un nonce en `src/proxy.ts`,
propagarlo y volver dinámicas rutas hoy estáticas — con el coste de rendimiento
que eso implica. Es la opción correcta si algún día entra HTML de terceros;
hoy, para una monografía sin `dangerouslySetInnerHTML`, es complejidad que no
compra mucho.

**Mi recomendación: la Opción A**, y dejar la B anotada como trabajo futuro.
En cualquier caso, antes de darla por buena hay que **verificarla en el
servidor de producción local** —no solo comprobar que el config compila—
cargando el dashboard, un editor y una **descarga `.xlsx`**, con la consola del
navegador abierta para cazar bloqueos de CSP.

**No la he aplicado.** Dime cuál quieres y la pongo con esa verificación.

---

## Anexo — reproducción

Los scripts de ataque quedaron en el scratchpad de la sesión (no versionados). Los pasos
clave están inline en cada hallazgo. Todo se ejecutó contra la base local
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) y la API local
(`http://127.0.0.1:54321`); los dos cambios de escritura de prueba (H-1 y H-4) se
revirtieron y se verificó la restauración. No se escribió nada en producción.

---

## Anexo B — reproducción de la remediación (2026-08-26)

Mismo entorno que la auditoría: base local `127.0.0.1:54322`, API local
`127.0.0.1:54321`, JWT del dueño firmado con el `JWT_SECRET` local (HS256).
Los scripts quedaron en el scratchpad de la sesión, sin versionar.

- **H-1.** `PATCH /rest/v1/settlement_points?site_id=eq.88444937-…` con
  `{"initial_elevation":95.0}` → **204 antes**, **400 `23001` después**.
  `DELETE` e `INSERT` sobre el lugar cerrado: **400 `23001`**. Control previo
  (`PATCH /rest/v1/sites`): 400, como en la auditoría original.
- **Flujo legítimo H-1.** Lugar abierto: INSERT 201 → UPDATE 204 → DELETE 204.
  Cierre de lugar abierto y cascada `sites → settlement_points`: correctos
  (probados en transacción y revertidos). `resyncSiteReadings` ejecutado de
  verdad sobre una fixture abierta (2 puntos, 2 visitas, 4 lecturas): `ok:true`
  con los acumulados recalculados. Fixture eliminada.
- **H-4.** `POST /rest/v1/reports` con `generated_by` ajeno → **201 antes**,
  **403 `42501` después**; con `generated_by` propio → **201**. Fila de prueba
  eliminada.
- **H-2/H-3.** `npm audit --omit=dev` antes/después; `npm run build`;
  `curl -D -` contra `127.0.0.1:3000` (servidor de producción local, detenido
  al terminar) sobre `/sign-in` y sobre la ruta de exportación.
- **Restauración verificada:** `projects` 5, `settlement_readings` 36,
  `polygonal_stations` 58, `reports` 2, `settlement_points` 6, `C0` = `100.0000`.
- **Producción:** solo una lectura de la config de Auth (§ 4). Ninguna escritura.
