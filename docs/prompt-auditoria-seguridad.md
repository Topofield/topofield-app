# Prompt — Auditoría de seguridad y pentest de TopoField

> Copiar el bloque de abajo como primer mensaje de una sesión nueva, en la raíz
> del repositorio. Está escrito para que el agente **verifique** en vez de
> suponer: este proyecto ya ha sufrido tres veces el patrón de «documentación
> que era cierta cuando se escribió».

---

Audita la seguridad de TopoField y ejecuta un pentest sobre él. Es una
aplicación Next.js 16 + Supabase desplegada en producción
(`topofield-app.vercel.app`), monografía de grado, con un solo rol de usuario.

## Antes de proponer nada, lee

1. `CLAUDE.md` y `AGENTS.md` — reglas del proyecto y advertencias de Next 16.
2. `docs/tecnica/README.md`, en este orden: `§5` Seguridad (RLS, inmutabilidad,
   secretos, registro por invitación, callback de correo), `§3` Arquitectura
   (Server Actions y Route Handlers), `§4` Modelo de datos, `§13` Despliegue.
3. `docs/method.md` → «Aprendizajes acumulados». Presta atención a dos
   entradas: la del despliegue («los fallos de configuración de Auth no dan
   error, **redirigen**») y la de la Fase 4 («verificar contra la base de
   datos, no contra la interfaz»).
4. `docs/tecnica/README.md` `§11` — 13 entradas de deuda abierta. Algunas tocan
   seguridad; tríalas y di cuáles.

## Advertencia de método, aprendida a base de errores

**No te fíes de la documentación ni de los comentarios: verifícalos con
código.** En este proyecto, tres veces un marco teórico resultó
aritméticamente inconsistente, una entrada de deuda técnica describía la causa
equivocada del síntoma correcto, y un comentario afirmaba una garantía
(«los resultados que se persisten los calcula el motor real») que el código no
cumplía. Si una defensa está documentada, **compruébala ejecutándola**.

Aplica el mismo criterio a tus propios hallazgos: antes de reportar algo,
reprodúcelo. Un hallazgo de seguridad sin prueba de explotación es una
hipótesis.

## Superficie que hay que cubrir

Contexto factual, verificado hoy — confírmalo igualmente:

- **4 Route Handlers**: `auth/callback` y tres de exportación a Excel
  (`.../export/route.ts` en poligonal, nivelación y asentamientos).
- **15 archivos con Server Actions** (`"use server"`): auth, proyectos, puntos
  de referencia, los tres módulos de proceso, lugares, puntos, visitas e
  informes.
- **12 tablas con RLS**, todas con 4 políticas salvo `profiles` (2).
- **7 funciones de trigger** `reject_*` que imponen la inmutabilidad de lo
  cerrado a nivel de base.
- **`proxy.ts`** deniega por defecto: solo `/sign-in`, `/sign-up`,
  `/sign-up/revisa-tu-correo` y `/auth/callback` son públicas.
- **Secretos**: `SUPABASE_SECRET_KEY` (solo en scripts y `.env`),
  `SIGNUP_INVITE_CODE` (solo en un Server Action, **sin** prefijo
  `NEXT_PUBLIC_`).

### Lo que quiero que ataques, en orden de importancia

1. **Aislamiento entre usuarios (RLS).** Es la garantía central: un usuario no
   debe ver ni tocar datos de otro. Compruébalo **a nivel de base**, no solo
   por la interfaz — se puede simular un usuario con
   `set local role authenticated; set local request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}';`
   dentro de una transacción. Cubre las 12 tablas, y en las hijas
   (`polygonal_stations`, `leveling_readings`, `settlement_readings`) verifica
   que el aislamiento no dependa solo del `join`. Prueba también IDOR por HTTP
   directo contra las rutas de exportación y de informes.

2. **Inmutabilidad de lo cerrado.** Un proceso, visita o lugar cerrado no debe
   poder mutarse **ni siquiera vía API REST directa**, saltándose la
   aplicación. Los triggers deberían impedirlo; verifica que cubren INSERT,
   UPDATE y DELETE en todas las tablas hijas, y busca huecos (¿alguna tabla sin
   trigger? ¿algún camino que borre por cascada lo que el trigger protege?).

3. **Revalidación en el servidor.** Cada Server Action debe revalidar lo que el
   cliente envía. Ataca con payloads que la interfaz nunca produciría: ids de
   otro proyecto, estados imposibles, números fuera de rango, arrays vacíos,
   tipos equivocados. Presta atención especial a `createReportAction`, que
   decide qué procesos entran en un informe, y a las acciones de cierre, que
   producen registros inmutables.

4. **Autenticación y registro.** El registro exige `SIGNUP_INVITE_CODE` y
   confirmación de correo. Verifica que el código no se pueda eludir, que no se
   filtre al cliente, y que falte la variable **bloquee** el registro en vez de
   abrirlo. Revisa el flujo de `/auth/callback` (PKCE) y si el `redirectTo`
   admite destinos arbitrarios (open redirect).

5. **Las rutas de exportación e informes**, que son lo más nuevo. Devuelven
   binarios y HTML con datos de la base: busca inyección en el nombre de
   archivo (`Content-Disposition`), fuga de datos entre proyectos, y si el
   contenido del informe puede incluir algo que el usuario no debería ver.

6. **XSS y contenido.** El informe imprimible y el manual renderizan texto que
   el usuario controla (nombres de proceso, observaciones, notas). Comprueba si
   React escapa todo o hay algún `dangerouslySetInnerHTML`.

7. **Dependencias y configuración.** `npm audit`, cabeceras de seguridad
   (CSP, HSTS, X-Frame-Options) en la respuesta de producción, y si el build
   filtra algo en los bundles del cliente — busca el secreto de Supabase y el
   código de invitación en `.next/static`.

## Reglas de compromiso

- **Autorizado**: es el proyecto del usuario, en su propia infraestructura.
- **Local primero.** Reproduce todo contra `npx supabase start` y `npm run
  dev`. Contra producción, **solo lectura**: consultas con
  `npx supabase db query --linked` y peticiones HTTP que no muten nada. Si un
  hallazgo necesita escritura para probarse, demuéstralo en local y dilo.
- **No toques datos de producción sin pedírmelo antes.** Hay un proyecto real
  con procesos; ya se reparó una vez y no quiero sorpresas.
- **No exfiltres secretos.** Si encuentras uno expuesto, repórtalo por su
  nombre y ubicación, nunca su valor.

## Qué quiero de vuelta

Un informe en `docs/auditoria-seguridad.md` con:

1. **Resumen ejecutivo**: ¿es seguro desplegar esto tal como está? Sí o no, y
   por qué, en un párrafo.
2. **Hallazgos**, cada uno con: severidad (crítica / alta / media / baja),
   dónde está (`archivo:línea`), **prueba de explotación reproducible** —el
   comando o script exacto—, impacto real en este producto, y arreglo
   propuesto.
3. **Lo que comprobaste y salió bien**, explícitamente. Un informe que solo
   lista fallos no dice qué quedó cubierto.
4. **Lo que no pudiste comprobar** y por qué. No lo omitas.

Ordena por severidad. Si algo es una decisión consciente del diseño y no un
fallo —por ejemplo, que un lugar cerrado congele todas sus visitas—, dilo así
en vez de reportarlo como vulnerabilidad.

No arregles nada todavía: primero el informe, y decidimos juntos qué se toca.
