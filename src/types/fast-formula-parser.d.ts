declare module "fast-formula-parser" {
  interface CellRef { sheet: string; row: number; col: number }
  interface RangeRef { sheet: string; from: { row: number; col: number }; to: { row: number; col: number } }
  interface Options {
    onCell?: (ref: CellRef) => unknown;
    onRange?: (ref: RangeRef) => unknown[][];
    functions?: Record<string, (...args: unknown[]) => unknown>;
  }
  export default class FormulaParser {
    constructor(options?: Options);
    parse(formula: string, position: CellRef, allowReturnArray?: boolean): unknown;
  }
  export const FormulaHelpers: { accept(value: unknown, type?: number): unknown };
  export const Types: Record<string, number>;
  export class FormulaError { error: string }
}
