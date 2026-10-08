// Elementos MathML en JSX (Fase 35): las fórmulas del informe se escriben en
// MathML nativo, que el navegador compone sin librerías. `@types/react` 19 no
// los declara todavía.
import "react";

type MathMLProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  display?: "block" | "inline";
  mathvariant?: string;
  width?: string;
  stretchy?: "true" | "false";
  /** `mover`: el elemento de encima es un acento (Fase 39, «l̂»). */
  accent?: "true" | "false";
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLProps;
      mi: MathMLProps;
      mn: MathMLProps;
      mo: MathMLProps;
      mtext: MathMLProps;
      mrow: MathMLProps;
      mfrac: MathMLProps;
      msub: MathMLProps;
      msup: MathMLProps;
      msubsup: MathMLProps;
      msqrt: MathMLProps;
      munder: MathMLProps;
      mover: MathMLProps;
      mspace: MathMLProps;
      mtable: MathMLProps;
      mtr: MathMLProps;
      mtd: MathMLProps;
    }
  }
}
