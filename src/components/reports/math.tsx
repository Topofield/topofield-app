// Piezas mínimas para escribir fórmulas en MathML nativo (Fase 35, decisión 16):
// el navegador las compone con notación matemática, en pantalla y en el PDF,
// sin librerías ni JavaScript. Sirven en Server Components.

import type { ReactNode } from "react";

type Children = { children?: ReactNode };

/** Un bloque de fórmulas, cada hijo en su línea, con una leyenda opcional. */
export function Formula({ children, caption }: Children & { caption?: string }) {
  return (
    <div className="report-formula">
      {children}
      {caption && <p className="report-formula-caption">{caption}</p>}
    </div>
  );
}

/** Una línea de la fórmula. */
export function MathLine({ children, label }: Children & { label?: string }) {
  return (
    <math display="block" aria-label={label}>
      {children}
    </math>
  );
}

/**
 * Un identificador. Una letra griega sola va recta: el navegador la pasaría a
 * la cursiva matemática (U+1D6FC…), que muchas fuentes no tienen.
 */
export const Mi = ({ children }: Children) =>
  typeof children === "string" && /^[\u0370-\u03FF]$/.test(children) ? (
    <mi mathvariant="normal">{children}</mi>
  ) : (
    <mi>{children}</mi>
  );
export const Mn = ({ children }: Children) => <mn>{children}</mn>;
export const Mo = ({ children }: Children) => <mo>{children}</mo>;
export const Mtext = ({ children }: Children) => <mtext>{children}</mtext>;
export const Row = ({ children }: Children) => <mrow>{children}</mrow>;
/** Espacio entre dos fórmulas de la misma línea. */
export const Gap = () => <mspace width="1.2em" />;
/** Espacio fino, entre una función y su argumento: «cos Az». */
export const Thin = () => <mspace width="0.17em" />;
/** Un acento circunflejo encima: «l̂», lo ajustado (Fase 39). */
export function Hat({ children }: Children) {
  return (
    <mover accent="true">
      {children}
      <mo>^</mo>
    </mover>
  );
}

export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <mfrac>
      <mrow>{num}</mrow>
      <mrow>{den}</mrow>
    </mfrac>
  );
}

export function Sub({ base, sub }: { base: ReactNode; sub: ReactNode }) {
  return (
    <msub>
      <mrow>{base}</mrow>
      <mrow>{sub}</mrow>
    </msub>
  );
}

export function Sup({ base, sup }: { base: ReactNode; sup: ReactNode }) {
  return (
    <msup>
      <mrow>{base}</mrow>
      <mrow>{sup}</mrow>
    </msup>
  );
}

export function SubSup({ base, sub, sup }: { base: ReactNode; sub: ReactNode; sup: ReactNode }) {
  return (
    <msubsup>
      <mrow>{base}</mrow>
      <mrow>{sub}</mrow>
      <mrow>{sup}</mrow>
    </msubsup>
  );
}

export const Sqrt = ({ children }: Children) => <msqrt>{children}</msqrt>;

/** Sumatoria, con el índice debajo si se da. */
export function Sum({ under }: { under?: ReactNode }) {
  if (under === undefined) return <mo>∑</mo>;
  return (
    <munder>
      <mo>∑</mo>
      <mrow>{under}</mrow>
    </munder>
  );
}

/** Una matriz entre corchetes. */
export function Matrix({ rows }: { rows: ReactNode[][] }) {
  return (
    <mrow>
      <mo>[</mo>
      <mtable>
        {rows.map((cells, i) => (
          <mtr key={i}>
            {cells.map((cell, j) => (
              <mtd key={j}>
                <mrow>{cell}</mrow>
              </mtd>
            ))}
          </mtr>
        ))}
      </mtable>
      <mo>]</mo>
    </mrow>
  );
}

/** Un número con signo y los decimales dados, para una fórmula: «−1.71». */
export function Num({ value, decimals, sign = false }: { value: number; decimals: number; sign?: boolean }) {
  const rounded = Number(value.toFixed(decimals));
  const text = Math.abs(rounded).toFixed(decimals);
  if (rounded < 0) return (
    <>
      <mo>−</mo>
      <mn>{text}</mn>
    </>
  );
  return sign && rounded > 0 ? (
    <>
      <mo>+</mo>
      <mn>{text}</mn>
    </>
  ) : (
    <mn>{text}</mn>
  );
}
