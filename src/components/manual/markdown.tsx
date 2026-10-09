import Link from "next/link";
import type { ReactNode } from "react";
import {
  imagenSola,
  resolverCaptura,
  resolverEnlace,
  type TituloConId,
  type Token,
  type Tokens,
} from "@/lib/manual/markdown";
import { tamanoEnPantalla } from "@/lib/manual/png";
import type { Manual } from "@/lib/manual/manual";

/**
 * Pinta el Markdown del manual con el sistema de diseño (Fase 42).
 *
 * Recorre los tokens de `marked` y devuelve React: sin HTML en cadena, sin
 * JavaScript de cliente. Lo que el manual no usa —HTML crudo, imágenes que no
 * son capturas, enlaces que no resuelven— lanza un error: lo atrapan las
 * pruebas antes de que llegue a la pantalla.
 */
export function Markdown({
  tokens,
  capturas,
}: {
  tokens: Token[];
  capturas: Manual["capturas"];
}) {
  const ctx: Contexto = { capturas, imagenes: 0 };
  return <>{bloques(tokens, ctx)}</>;
}

interface Contexto {
  capturas: Manual["capturas"];
  /** Cuántas capturas van pintadas: la primera se carga de inmediato. */
  imagenes: number;
}

function bloques(tokens: Token[], ctx: Contexto): ReactNode[] {
  return tokens.map((t, i) => bloque(t, ctx, i)).filter((n) => n !== null);
}

function bloque(t: Token, ctx: Contexto, key: number): ReactNode {
  switch (t.type) {
    case "space":
      return null;
    case "heading":
      return titulo(t as TituloConId, ctx, key);
    case "paragraph": {
      const img = imagenSola(t);
      if (img) return figura(img, ctx, key);
      return (
        <p key={key} className="leading-relaxed">
          {enLinea((t as Tokens.Paragraph).tokens, ctx)}
        </p>
      );
    }
    case "text": {
      // Los ítems de una lista compacta traen `text` en vez de `paragraph`.
      const img = imagenSola(t);
      if (img) return figura(img, ctx, key);
      const texto = t as Tokens.Text;
      return (
        <p key={key} className="leading-relaxed">
          {texto.tokens ? enLinea(texto.tokens, ctx) : texto.text}
        </p>
      );
    }
    case "list":
      return lista(t as Tokens.List, ctx, key);
    case "blockquote":
      return (
        <aside
          key={key}
          className="flex flex-col gap-2 rounded-md border-l-4 border-mira-strong bg-mira-bg px-4 py-3 text-sm text-ink"
        >
          {bloques((t as Tokens.Blockquote).tokens, ctx)}
        </aside>
      );
    case "table":
      return tabla(t as Tokens.Table, ctx, key);
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-md border border-rule bg-card px-4 py-3 font-mono text-sm"
        >
          <code>{(t as Tokens.Code).text}</code>
        </pre>
      );
    case "hr":
      return <hr key={key} className="border-rule" />;
    default:
      throw new Error(`El manual no admite «${t.type}»: ${t.raw.slice(0, 60)}`);
  }
}

function titulo(t: TituloConId, ctx: Contexto, key: number): ReactNode {
  const contenido = enLinea(t.tokens, ctx);
  switch (t.depth) {
    case 2:
      return (
        <h2 key={key} id={t.id} className="mt-6 border-b border-rule pb-2 text-xl font-bold">
          {contenido}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} id={t.id} className="mt-3 text-lg font-semibold">
          {contenido}
        </h3>
      );
    case 4:
      return (
        <h4 key={key} id={t.id} className="font-semibold">
          {contenido}
        </h4>
      );
    default:
      throw new Error(`Título de nivel ${t.depth} dentro de un capítulo: ${t.text}`);
  }
}

/** Una lista numerada es una secuencia de pasos; una con viñetas, una enumeración. */
function lista(t: Tokens.List, ctx: Contexto, key: number): ReactNode {
  if (!t.ordered) {
    return (
      <ul key={key} className="flex list-disc flex-col gap-2 pl-6">
        {t.items.map((item, i) => (
          <li key={i} className="pl-1">
            <div className="flex flex-col gap-2">{bloques(item.tokens, ctx)}</div>
          </li>
        ))}
      </ul>
    );
  }
  const inicio = typeof t.start === "number" ? t.start : 1;
  return (
    <ol key={key} className="flex flex-col gap-5" start={inicio}>
      {t.items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-mira text-sm font-semibold text-on-mira">
            {inicio + i}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">{bloques(item.tokens, ctx)}</div>
        </li>
      ))}
    </ol>
  );
}

function tabla(t: Tokens.Table, ctx: Contexto, key: number): ReactNode {
  const alinear = (a: Tokens.Table["align"][number] | undefined) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
  return (
    <div key={key} className="overflow-x-auto rounded-lg border border-rule bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule">
            {t.header.map((celda, i) => (
              <th key={i} scope="col" className={`px-4 py-2 font-semibold ${alinear(t.align[i])}`}>
                {enLinea(celda.tokens, ctx)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((fila, f) => (
            <tr key={f} className="border-b border-rule last:border-0">
              {fila.map((celda, c) => (
                <td key={c} className={`px-4 py-2 align-top ${alinear(t.align[c])}`}>
                  {enLinea(celda.tokens, ctx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Una captura. Es una función y no un componente: lleva la cuenta de las
 * capturas pintadas (la primera se carga de inmediato), y un componente no
 * puede modificar lo que recibe.
 */
function figura(imagen: Tokens.Image, ctx: Contexto, key: number): ReactNode {
  const captura = resolverCaptura(imagen.href);
  if (!captura) throw new Error(`La imagen no es una captura del manual: ${imagen.href}`);
  const medidas = ctx.capturas[captura.clave];
  if (!medidas) throw new Error(`La captura no está en capturas.json: ${captura.clave}`);
  const { width, height } = tamanoEnPantalla({ ancho: medidas[0], alto: medidas[1] });
  const primera = ctx.imagenes === 0;
  ctx.imagenes += 1;
  return (
    <figure key={key} className="my-1 break-inside-avoid">
      <a href={captura.publica} className="block w-fit max-w-full" title="Ver la captura a tamaño completo">
        {/* eslint-disable-next-line @next/next/no-img-element --
            PNG estáticos ya generados al tamaño correcto: no necesitan la
            optimización en tiempo de ejecución de next/image. */}
        <img
          src={captura.publica}
          alt={imagen.text}
          width={width}
          height={height}
          loading={primera ? "eager" : "lazy"}
          decoding="async"
          className="h-auto max-w-full rounded-lg border border-rule bg-card shadow-sm"
        />
      </a>
      {imagen.title && <figcaption className="mt-2 text-sm text-ink-2">{imagen.title}</figcaption>}
    </figure>
  );
}

function enLinea(tokens: Token[] | undefined, ctx: Contexto): ReactNode[] {
  if (!tokens) return [];
  return tokens.map((t, i) => {
    switch (t.type) {
      case "text":
      case "escape": {
        const texto = t as Tokens.Text;
        return texto.tokens ? <span key={i}>{enLinea(texto.tokens, ctx)}</span> : texto.text;
      }
      case "strong":
        return (
          <strong key={i} className="font-semibold">
            {enLinea((t as Tokens.Strong).tokens, ctx)}
          </strong>
        );
      case "em":
        return <em key={i}>{enLinea((t as Tokens.Em).tokens, ctx)}</em>;
      case "del":
        return <del key={i}>{enLinea((t as Tokens.Del).tokens, ctx)}</del>;
      case "codespan":
        return (
          <code key={i} className="rounded bg-sel px-1 py-0.5 font-mono text-[0.9em]">
            {(t as Tokens.Codespan).text}
          </code>
        );
      case "br":
        return <br key={i} />;
      case "link":
        return enlace(t as Tokens.Link, ctx, i);
      default:
        throw new Error(`El manual no admite «${t.type}» en una frase: ${t.raw.slice(0, 60)}`);
    }
  });
}

const CLASE_ENLACE = "font-medium text-ink underline decoration-mira-strong underline-offset-2 hover:decoration-2";

function enlace(t: Tokens.Link, ctx: Contexto, key: number): ReactNode {
  const destino = resolverEnlace(t.href);
  const contenido = enLinea(t.tokens, ctx);
  switch (destino.tipo) {
    case "interno":
      return (
        <Link key={key} href={destino.href} className={CLASE_ENLACE}>
          {contenido}
        </Link>
      );
    case "ancla":
      return (
        <a key={key} href={destino.href} className={CLASE_ENLACE}>
          {contenido}
        </a>
      );
    case "externo":
      return (
        <a key={key} href={destino.href} className={CLASE_ENLACE} rel="noopener noreferrer">
          {contenido}
        </a>
      );
    default:
      throw new Error(`Enlace que no resuelve en el manual: ${t.href}`);
  }
}
