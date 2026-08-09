import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  Input,
  KpiCard,
  Logo,
  LogoMark,
  Select,
  StatusIndicator,
  Tabs,
  Textarea,
} from "@/components/design-system";
import { formatRatio, parseThemeColors } from "@/lib/design/contrast";
import {
  CONTEXTO_LABELS,
  medirPairings,
  type Contexto,
  type Medicion,
} from "@/lib/design/pairings";
import {
  DmsInputDemo,
  EstadoCargaDemo,
  FiltroComparacion,
  ModalDemo,
} from "./demos";

export const metadata = {
  title: "Sistema de diseño — TopoField",
};

/** Grupos de tokens y el rol de cada escalón, según § 2.1 de la spec. */
const GRUPOS: { titulo: string; nota: string; tokens: string[] }[] = [
  {
    titulo: "Marca",
    nota: "-50/-100/-200 solo fondo y bordes · -500 base accesible · -600/-700 texto y profundidad",
    tokens: [
      "primary-50",
      "primary-100",
      "primary-200",
      "primary-500",
      "primary-600",
      "primary-700",
    ],
  },
  {
    titulo: "Estado",
    nota: "Cada uno se usa en tres contextos distintos. Cumplir en uno no implica cumplir en los otros.",
    tokens: ["success-500", "warning-500", "danger-500"],
  },
  {
    titulo: "Neutrales",
    nota: "neutral-400 es el borde de control · neutral-500 es la excepción: se usa como texto secundario sobre blanco y cumple AA ahí.",
    tokens: [
      "neutral-50",
      "neutral-100",
      "neutral-200",
      "neutral-400",
      "neutral-500",
      "neutral-800",
      "neutral-900",
    ],
  },
  {
    titulo: "Semáforo de asentamientos",
    nota: "Reservado para la fase 5. Ya cumple 3:1 como indicador gráfico, pero los niveles contiguos quedaron a luminancia parecida (1.18, 1.15, 1.01): el semáforo debe ir siempre con texto.",
    tokens: [
      "semaphore-green",
      "semaphore-yellow",
      "semaphore-orange",
      "semaphore-red",
    ],
  },
];

const ORDEN_CONTEXTOS: Contexto[] = [
  "texto-sobre-blanco",
  "texto-sobre-tinte",
  "fondo-bajo-texto-blanco",
  "grafico",
];

export default async function DesignSystemPage() {
  // Herramienta de desarrollo: no forma parte del producto.
  if (process.env.NODE_ENV === "production") notFound();

  // Los tokens se leen de globals.css, su única fuente de verdad. Duplicar los
  // hexadecimales aquí los dejaría desincronizados en el primer ajuste.
  const css = await readFile(
    join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  const tokens = parseThemeColors(css);
  const medidas = medirPairings(tokens);
  // Las parejas informativas se miden pero no cuentan: WCAG las exime.
  const fallos = medidas.filter((m) => !m.cumple && !m.informativo);
  const exentas = medidas.filter((m) => m.informativo);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10">
        <Logo className="text-2xl" />
        <h1 className="mt-4 text-3xl font-bold">Sistema de diseño</h1>
        <p className="mt-2 max-w-2xl text-neutral-800">
          Estado actual de los {Object.keys(tokens).length} tokens de color y
          los 15 componentes de{" "}
          <code className="text-sm">src/components/design-system/</code>. Los
          contrastes se miden en vivo desde{" "}
          <code className="text-sm">globals.css</code>.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Página de desarrollo — devuelve 404 en producción. Spec:{" "}
          <code>docs/specs/2026-07-28-sistema-diseno-design.md</code>
        </p>
      </header>

      <nav aria-label="Secciones" className="mb-10 flex flex-wrap gap-2">
        {[
          ["#hallazgos", "Hallazgos"],
          ["#tokens", "Tokens"],
          ["#contraste", "Contraste"],
          ["#componentes", "Componentes"],
          ["#patrones", "Patrones"],
          ["#decisiones", "Decisiones"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ── Hallazgos ─────────────────────────────────────────────────── */}
      <Seccion id="hallazgos" titulo="Hallazgos de la medición">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Parejas medidas"
            value={medidas.length}
            hint="Umbral 4.5:1 en texto, 3:1 en gráficos"
          />
          <KpiCard
            label="Cumplen"
            value={medidas.filter((m) => m.cumple).length}
          />
          <KpiCard
            label="No cumplen"
            value={fallos.length}
            hint={
              exentas.length > 0
                ? `${exentas.length} pareja exenta aparte (WCAG no la exige)`
                : undefined
            }
          />
        </div>

        {fallos.length === 0 ? (
          <Alert variant="success" title="Todas las parejas declaradas cumplen AA">
            Los cuatro tokens corregidos durante las fases 1–3 se sostienen en
            los tres contextos.
          </Alert>
        ) : (
          <Alert
            variant="warning"
            title={`${fallos.length} parejas por debajo de su umbral`}
          >
            <ul className="mt-2 space-y-2">
              {fallos.map((m, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs tabular-nums font-semibold">
                    {formatRatio(m.ratio)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    (mín. {m.umbral}:1)
                  </span>
                  <code className="text-xs">{m.fg}</code>
                  <span className="text-xs text-neutral-500">sobre</span>
                  <code className="text-xs">
                    {m.bg}
                    {m.bgAlpha !== undefined ? `/${m.bgAlpha * 100}` : ""}
                  </code>
                  <span className="text-xs text-neutral-500">— {m.donde}</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </Seccion>

      {/* ── Tokens ────────────────────────────────────────────────────── */}
      <Seccion id="tokens" titulo="Tokens de color">
        <div className="space-y-8">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <h3 className="text-base font-semibold">{grupo.titulo}</h3>
              <p className="mt-1 mb-3 max-w-2xl text-sm text-neutral-500">
                {grupo.nota}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.tokens.map((token) => (
                  <Swatch key={token} token={token} hex={tokens[token]} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h3 className="text-base font-semibold">Tipografía</h3>
          <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
            <p className="font-display text-2xl font-bold text-primary-600">
              Space Grotesk · títulos h1–h3
            </p>
            <p className="text-base">
              system-ui · cuerpo de texto. El paso de estación 4 a la 5 cerró
              con error angular de 12″.
            </p>
            <p className="font-mono tabular-nums text-base">
              1 234 567.890 · 1:5000 · 45°30′12.5″ — font-mono, tabular-nums
            </p>
          </div>
        </div>
      </Seccion>

      {/* ── Contraste ─────────────────────────────────────────────────── */}
      <Seccion
        id="contraste"
        titulo="Contraste por contexto"
        descripcion="Un color que cumple sobre blanco puede fallar sobre su propio fondo teñido, porque el fondo efectivo ya no es blanco. Ese fue el fallo que ninguna revisión manual detectaba."
      >
        <div className="space-y-8">
          {ORDEN_CONTEXTOS.map((contexto) => {
            const filas = medidas.filter((m) => m.contexto === contexto);
            const primera = filas[0];
            if (primera === undefined) return null;
            return (
              <div key={contexto}>
                <h3 className="text-base font-semibold">
                  {CONTEXTO_LABELS[contexto]}
                </h3>
                <p className="mt-1 mb-3 text-sm text-neutral-500">
                  Umbral {primera.umbral}:1
                </p>
                <TablaMediciones filas={filas} />
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* ── Componentes ───────────────────────────────────────────────── */}
      <Seccion id="componentes" titulo="Componentes">
        <div className="space-y-8">
          <Demo titulo="Button" nota="4 variantes × 3 tamaños, con estado deshabilitado.">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primario</Button>
                <Button variant="secondary">Secundario</Button>
                <Button variant="danger">Peligro</Button>
                <Button variant="ghost">Fantasma</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Pequeño</Button>
                <Button size="md">Mediano</Button>
                <Button size="lg">Grande</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled>Primario</Button>
                <Button variant="secondary" disabled>
                  Secundario
                </Button>
                <Button variant="danger" disabled>
                  Peligro
                </Button>
                <Button variant="ghost" disabled>
                  Fantasma
                </Button>
              </div>
            </div>
          </Demo>

          <Demo titulo="Badge" nota="El tono success/warning/danger usa el token al 10 % como fondo y el mismo token como texto.">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Borrador</Badge>
              <Badge tone="primary">Calculado</Badge>
              <Badge tone="success">Cerrado</Badge>
              <Badge tone="warning">Cerrado fuera de tolerancia</Badge>
              <Badge tone="danger">Rechazado</Badge>
            </div>
          </Demo>

          <Demo titulo="StatusIndicator" nota="§ 4.4 — el punto es aria-hidden; la etiqueta de texto es el canal accesible.">
            <div className="flex flex-wrap items-center gap-6">
              <StatusIndicator status="ok" label="Cumple la tolerancia" />
              <StatusIndicator status="warning" label="Al límite" />
              <StatusIndicator status="danger" label="No cumple la tolerancia" />
            </div>
          </Demo>

          <Demo titulo="Alert" nota="4 variantes. role=alert siempre presente.">
            <div className="space-y-3">
              <Alert title="Información">
                La poligonal cerrada requiere al menos 3 estaciones.
              </Alert>
              <Alert variant="success" title="Proceso cerrado">
                Cierre registrado con trazabilidad.
              </Alert>
              <Alert variant="warning" title="Fuera de tolerancia">
                La precisión relativa 1:46 no alcanza el 1:5000 exigido.
              </Alert>
              <Alert variant="error" title="No se pudo guardar">
                Un proceso cerrado es inmutable.
              </Alert>
            </div>
          </Demo>

          <Demo titulo="Input · Select · Textarea" nota="Etiqueta, texto de ayuda, estado de error con aria-invalid y aria-describedby.">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Nombre del proceso" placeholder="Poligonal norte" />
              <Input
                label="Con ayuda"
                helperText="Máximo 120 caracteres."
                defaultValue="Levantamiento sector 3"
              />
              <Input
                label="Con error"
                error="El nombre es obligatorio."
                defaultValue=""
              />
              <Input label="Deshabilitado" disabled defaultValue="No editable" />
              <Select
                label="Orden del levantamiento"
                options={[
                  { value: "primer", label: "Primer orden" },
                  { value: "segundo", label: "Segundo orden" },
                  { value: "tercer", label: "Tercer orden" },
                ]}
              />
              <Select
                label="Con error"
                error="Seleccione un método."
                placeholder="Seleccione…"
                options={[
                  { value: "bowditch", label: "Bowditch" },
                  { value: "transito", label: "Tránsito" },
                  { value: "crandall", label: "Crandall" },
                ]}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Observaciones"
                  helperText="Notas de campo."
                  placeholder="Condiciones de la jornada…"
                />
              </div>
            </div>
          </Demo>

          <Demo titulo="DmsInput" nota="Grados, minutos y segundos en tres campos. Los ángulos nunca se capturan como decimal.">
            <DmsInputDemo />
          </Demo>

          <Demo titulo="Card · KpiCard" nota="">
            <div className="space-y-4">
              <Card
                title="Resultados del cierre"
                actions={<Button size="sm" variant="ghost">Exportar</Button>}
              >
                <p className="text-sm text-neutral-800">
                  Contenido de la tarjeta.
                </p>
              </Card>
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Perímetro" value="1 284.532 m" />
                <KpiCard
                  label="Precisión relativa"
                  value="1:8 421"
                  hint="Exigido 1:5000"
                />
                <KpiCard label="Error angular" value="12″" hint="Máximo 30″" />
              </div>
            </div>
          </Demo>

          <Demo titulo="Tabs · Breadcrumbs" nota="Ambos basados en enlaces: sin JS de cliente. Breadcrumbs se reduce al retorno en móvil.">
            <div className="space-y-6">
              <Breadcrumbs
                items={[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Puente Río Bogotá", href: "/design-system" },
                  { label: "Poligonal norte" },
                ]}
              />
              <Tabs
                items={[
                  { id: "processes", label: "Procesos" },
                  { id: "reports", label: "Informes" },
                  { id: "config", label: "Configuración" },
                ]}
                activeId="processes"
                basePath="/design-system"
              />
            </div>
          </Demo>

          <Demo titulo="EmptyState" nota="">
            <EmptyState
              title="Aún no hay procesos"
              description="Cree la primera poligonal para empezar a capturar estaciones."
              action={<Button>Nueva poligonal</Button>}
            />
          </Demo>

          <Demo titulo="Modal" nota="Cierre por Escape y por clic en el fondo.">
            <ModalDemo />
          </Demo>

          <Demo titulo="Logo · LogoMark" nota="Isotipo dimensionado en em: el tamaño deriva del contexto tipográfico.">
            <div className="flex flex-wrap items-end gap-8">
              <Logo />
              <Logo className="text-2xl" />
              <div className="rounded-md bg-primary-700 p-4">
                <Logo className="text-white" markClassName="text-white" />
              </div>
              <LogoMark className="h-10 w-10 text-primary-500" />
            </div>
          </Demo>
        </div>
      </Seccion>

      {/* ── Patrones ──────────────────────────────────────────────────── */}
      <Seccion
        id="patrones"
        titulo="Patrones canónicos"
        descripcion="Los casos que ya se repiten y donde las convenciones divergieron."
      >
        <div className="space-y-8">
          <Demo
            titulo="§ 4.1 Filtro excluyente — patrón vigente"
            nota="El filtro es navegación: se resuelve con <Link> y aria-current, no con botón y estado de cliente."
          >
            <FiltroComparacion />
          </Demo>

          <Demo
            titulo="§ 4.2 Foco visible — un solo sistema"
            nota="Recorra con el tabulador. Los cuatro controles usan el mismo outline de @layer base: ningún componente declara ya su propio ring."
          >
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="secondary">Botón</Button>
              <a
                href="#patrones"
                className="text-sm font-medium text-primary-600 underline"
              >
                Enlace
              </a>
              <button
                type="button"
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-500"
              >
                Chip
              </button>
              <Input aria-label="Campo de prueba" placeholder="Campo" />
            </div>
            <p className="mt-4 max-w-2xl text-sm text-neutral-500">
              El selector base es{" "}
              <code>
                :where(a, button, summary, input, select,
                textarea):focus-visible
              </code>
              , con especificidad cero. Al tabular por los cuatro controles el
              foco se ve idéntico: mismo <code>outline</code> de 2 px en{" "}
              <code>primary-500</code>. Que el selector use <code>:where()</code>{" "}
              es lo que permite que cada componente siga fijando su propio{" "}
              <code>border-radius</code> sin que la regla de foco compita por
              especificidad.
            </p>
          </Demo>

          <Demo titulo="§ 4.3 Estado de carga" nota="Se deshabilita el control y cambia su texto. Sin spinner decorativo.">
            <EstadoCargaDemo />
          </Demo>

          <Demo
            titulo="§ 4.5 Tabla en escritorio, tarjetas en móvil"
            nota="Punto de corte 768 px. Reduzca el ancho de la ventana. Los mismos campos y los mismos valores en ambos modos — ya falló una vez (43bc2fa)."
          >
            <TablaResponsivaDemo />
          </Demo>
        </div>
      </Seccion>

      {/* ── Decisiones ────────────────────────────────────────────────── */}
      <Seccion
        id="decisiones"
        titulo="Decisiones tomadas"
        descripcion="Lo que resolvió este plan de estabilización, y por qué."
      >
        <ol className="space-y-4">
          {[
            {
              t: "Foco: outline, no ring",
              d: "Se retiraron los ring propios de los componentes; queda un solo selector en @layer base, :where(a, button, summary, input, select, textarea):focus-visible, con especificidad cero. Cero mantenimiento y cubre también lo que nunca tuvo ring. La alternativa —ring en todo, quitar la regla base— seguía mejor el radio del borde, pero exigía repetirlo en cada componente nuevo. Ver § 4.2 arriba: los cuatro controles dan el mismo outline.",
            },
            {
              t: "Filtro excluyente: enlace, no botón",
              d: "Se convergió en <Link> + aria-current. Los chips del listado de procesos (process-list-toolbar.tsx) ya son enlaces: eso es lo que cambió. La persistencia en localStorage se conservó intacta, con sus dos useEffect (restauración y guardado) en el mismo orden — invertirlo reintroduce un bug ya corregido. Un botón con router.push exige \"use client\" y no se puede abrir en pestaña nueva ni compartir — coste que no se justifica cuando el control no necesita estado de cliente.",
            },
            {
              t: "Prueba de contraste: no se añade, la página es la verificación",
              d: "La tabla de parejas (pairings.ts) y las funciones puras de contrast.ts ya existen; /design-system las mide en vivo contra globals.css en cada carga. Convertirla en prueba de Vitest exigiría jsdom, que el proyecto no usa (environment: \"node\"). Al tocar la paleta o añadir una pareja, abrir la página es el paso de verificación — no hay gate automático en npm test.",
            },
            {
              t: "Semáforo de asentamientos: rellenos oscurecidos",
              d: "Se midieron los cuatro tokens: verde, amarillo y naranja fallaban como indicador gráfico (2.87, 1.66 y 2.85). Los cuatro se oscurecieron a #1e8e4e, #8a6d0b, #c25e08 y #d94436, y ahora cumplen 3:1. Deuda pendiente: los niveles contiguos quedan poco separados entre sí (1.18, 1.15, 1.01), por lo que el color solo no basta para distinguirlos — el módulo debe apoyarse en la etiqueta de texto, no en el matiz. La alternativa considerada, anillos oscuros sobre el mismo relleno claro, se descartó por ahora: exige un segundo canal gráfico (el anillo) además del texto, más costoso que oscurecer el relleno.",
            },
            {
              t: "Borde de los campos de formulario: neutral-400",
              d: "neutral-200 (1.43:1) no alcanzaba el 3:1 que exige WCAG 1.4.11 para el límite de un control. Input, Select y Textarea usan ahora neutral-400 (3.41:1 sobre blanco, 3.24:1 sobre neutral-50). Los bordes decorativos, que no delimitan un control interactivo, se quedan en neutral-200.",
            },
          ].map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-neutral-200 bg-white p-5"
            >
              <p className="font-semibold text-neutral-900">
                {i + 1}. {item.t}
              </p>
              <p className="mt-1 text-sm text-neutral-800">{item.d}</p>
            </li>
          ))}
        </ol>
      </Seccion>
    </div>
  );
}

// ── Piezas de la página ─────────────────────────────────────────────────

function Seccion({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <h2 className="border-b border-neutral-200 pb-2 text-2xl font-bold">
        {titulo}
      </h2>
      {descripcion && (
        <p className="mt-3 mb-6 max-w-2xl text-neutral-800">{descripcion}</p>
      )}
      <div className={descripcion ? "" : "mt-6"}>{children}</div>
    </section>
  );
}

function Demo({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="font-display text-base font-semibold text-primary-600">
        {titulo}
      </h3>
      {nota ? (
        <p className="mt-1 mb-4 max-w-2xl text-sm text-neutral-500">{nota}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </div>
  );
}

/**
 * Muestra del token. El fondo va en `style` con `var(--color-*)` porque
 * Tailwind v4 extrae las clases estáticamente del código fuente: una clase
 * construida como `bg-${token}` no existiría en el CSS generado.
 */
function Swatch({ token, hex }: { token: string; hex?: string }) {
  if (!hex) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div
        className="h-16 w-full"
        style={{ backgroundColor: `var(--color-${token})` }}
        aria-hidden
      />
      <div className="px-3 py-2">
        <p className="font-mono text-xs font-medium text-neutral-900">
          {token}
        </p>
        <p className="font-mono text-xs tabular-nums text-neutral-500">{hex}</p>
      </div>
    </div>
  );
}

function TablaMediciones({ filas }: { filas: Medicion[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Contraste medido de cada pareja de colores
        </caption>
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            <th scope="col" className="px-4 py-2 font-semibold">
              Muestra
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Pareja
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              Razón
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Veredicto
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Dónde
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((m, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-0">
              <td className="px-4 py-2">
                <span
                  className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold"
                  style={{ backgroundColor: m.bgHex, color: m.fgHex }}
                >
                  Aa 45°30′
                </span>
              </td>
              <td className="px-4 py-2">
                <code className="text-xs">{m.fg}</code>
                <span className="text-neutral-500"> / </span>
                <code className="text-xs">
                  {m.bg}
                  {m.bgAlpha !== undefined ? `/${m.bgAlpha * 100}` : ""}
                </code>
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {formatRatio(m.ratio)}
              </td>
              <td className="px-4 py-2">
                {m.informativo ? (
                  <Badge>Exento</Badge>
                ) : m.cumple ? (
                  <Badge tone="success">Cumple</Badge>
                ) : (
                  <Badge tone="danger">Falla</Badge>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-neutral-500">
                {m.donde}
                {m.exencion && (
                  <span className="mt-1 block italic">{m.exencion}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FILAS_DEMO = [
  { nombre: "Poligonal norte", tipo: "Cerrada", precision: "1:8 421", ok: true },
  { nombre: "Enlace sector 3", tipo: "Abierta", precision: "1:4 102", ok: false },
];

/** El patrón de § 4.5, con los mismos campos en los dos modos. */
function TablaResponsivaDemo() {
  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th scope="col" className="px-4 py-2 font-semibold">
                Proceso
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Precisión
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Tolerancia
              </th>
            </tr>
          </thead>
          <tbody>
            {FILAS_DEMO.map((f) => (
              <tr key={f.nombre} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {f.nombre}
                </td>
                <td className="px-4 py-2 text-neutral-800">{f.tipo}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {f.precision}
                </td>
                <td className="px-4 py-2">
                  <StatusIndicator
                    status={f.ok ? "ok" : "danger"}
                    label={f.ok ? "Cumple" : "No cumple"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: mismos campos, mismos valores. */}
      <ul className="space-y-3 md:hidden">
        {FILAS_DEMO.map((f) => (
          <li
            key={f.nombre}
            className="rounded-lg border border-neutral-200 p-4"
          >
            <p className="font-medium text-neutral-900">{f.nombre}</p>
            <p className="mt-0.5 text-sm text-neutral-800">{f.tipo}</p>
            <p className="mt-1 font-mono tabular-nums text-sm">{f.precision}</p>
            <div className="mt-2">
              <StatusIndicator
                status={f.ok ? "ok" : "danger"}
                label={f.ok ? "Cumple" : "No cumple"}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
