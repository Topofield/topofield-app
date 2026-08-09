import type { ReactNode } from "react";

/**
 * Tabla del manual. El contenedor desplaza en horizontal para que una tabla
 * ancha no desborde la página en el teléfono.
 *
 * `caption` describe la tabla para lectores de pantalla; se muestra también en
 * pantalla porque en un manual el título de la tabla es información útil, no
 * ruido.
 */
export function Tabla({
  caption,
  columnas,
  children,
}: {
  caption: string;
  columnas: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <caption className="px-4 pt-3 text-left text-sm font-medium text-neutral-800">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="px-4 py-2 font-semibold">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Fila de la tabla. La primera celda es encabezado de fila. */
export function Fila({ celdas }: { celdas: ReactNode[] }) {
  const [primera, ...resto] = celdas;
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <th scope="row" className="px-4 py-2 text-left font-medium text-neutral-900">
        {primera}
      </th>
      {resto.map((celda, i) => (
        <td key={i} className="px-4 py-2 text-neutral-800">
          {celda}
        </td>
      ))}
    </tr>
  );
}
