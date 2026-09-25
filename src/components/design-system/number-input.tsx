"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type RefObject,
} from "react";
import { isInvalidNumber } from "@/lib/utils/parse";
import { Input } from "./input";

/** Mensaje de una celda cuyo texto no es un número (Fase 20, UI2). */
export const NOT_A_NUMBER = "No es un número.";

type Report = (id: string, invalid: boolean) => void;

/**
 * Los editores que guardan con un botón —no con `<form>`— no se enteran de la
 * validez nativa. Envolviendo su contenido en este contexto saben cuántas
 * celdas numéricas tienen texto inválido, y no guardan mientras haya alguna:
 * `parseNumber` convierte ese texto en `null`, y en una celda opcional se
 * perdería sin aviso.
 */
export const InvalidNumbersContext = createContext<Report | null>(null);

/**
 * Marca o desmarca una celda en el conjunto de las inválidas. Devuelve el
 * mismo conjunto si no cambia, para que React no vuelva a renderizar.
 */
export function withInvalidMark(
  prev: ReadonlySet<string>,
  id: string,
  invalid: boolean,
): ReadonlySet<string> {
  if (prev.has(id) === invalid) return prev;
  const next = new Set(prev);
  if (invalid) next.add(id);
  else next.delete(id);
  return next;
}

/** Para el editor: el contador y la función que le pasa al contexto. */
export function useInvalidNumbers(): { count: number; report: Report } {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const report = useCallback<Report>((id, invalid) => {
    setIds((prev) => withInvalidMark(prev, id, invalid));
  }, []);
  return { count: ids.size, report };
}

/**
 * La validez de una celda numérica: la marca para el navegador
 * (`setCustomValidity`, que bloquea el envío de un `<form>`) y la comunica al
 * contexto del editor, si lo hay. Al desmontarse —una fila borrada— la retira.
 */
export function useNumberValidity(
  value: string,
  ref: RefObject<HTMLInputElement | null>,
): boolean {
  const invalid = isInvalidNumber(value);
  const report = useContext(InvalidNumbersContext);
  const id = useId();

  useEffect(() => {
    ref.current?.setCustomValidity(invalid ? NOT_A_NUMBER : "");
  }, [invalid, ref]);

  useEffect(() => {
    if (!report) return;
    report(id, invalid);
    return () => report(id, false);
  }, [report, id, invalid]);

  return invalid;
}

type NumberInputProps = Omit<
  ComponentPropsWithRef<typeof Input>,
  "type" | "inputMode" | "value" | "ref"
> & {
  value: string;
  /** Sin decimales: el teclado del teléfono no ofrece separador. */
  integer?: boolean;
};

/**
 * Celda numérica. `type="text"` con `inputMode="decimal"` y no
 * `type="number"`, que rechaza la coma decimal que teclea un usuario en
 * español (UI2). El texto se respeta tal cual; lo lee `parseNumber`, con coma
 * o con punto. Si no es un número, la celda lo dice —«No es un número»— en vez
 * del error del validador, que solo vería una celda vacía.
 */
export function NumberInput({ value, integer = false, error, ...rest }: NumberInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const invalid = useNumberValidity(value, ref);
  return (
    <Input
      {...rest}
      ref={ref}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      spellCheck={false}
      value={value}
      error={invalid ? NOT_A_NUMBER : error}
    />
  );
}
