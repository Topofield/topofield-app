import { cn } from "@/lib/utils/cn";
import type { Captura as DatosCaptura } from "../manual-data";

/**
 * Captura de la aplicación real, servida desde `public/manual/`.
 *
 * Se usa `<img>` plano y no `next/image`: son activos estáticos ya generados
 * al tamaño correcto por `docs/manual/capturas.mjs`, no imágenes subidas por
 * el usuario ni servidas desde un CDN, así que la optimización en tiempo de
 * ejecución no aporta nada que compense su coste.
 *
 * `width` y `height` llevan las dimensiones reales del PNG: el navegador
 * reserva el espacio antes de descargar la imagen y la página no da un salto
 * cuando entra. El tamaño que se ve lo decide el CSS.
 */
export function Captura({
  src,
  alt,
  pie,
  width,
  height,
  angosta,
  prioridad,
}: DatosCaptura & { prioridad?: boolean }) {
  return (
    <figure className="my-2">
      {/* eslint-disable-next-line @next/next/no-img-element --
          Decisión deliberada: son PNG estáticos ya generados al tamaño
          correcto, versionados en public/. next/image optimizaría en tiempo de
          ejecución imágenes que no lo necesitan, y su coste se factura por uso.
          El riesgo real de <img> —el salto de layout— se evita con width/height. */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        // Solo la primera captura de la página se carga de inmediato; las
        // otras diez suman 2,8 MB y no se ven hasta que se baja.
        loading={prioridad ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-auto w-full rounded-lg border border-neutral-200 bg-white shadow-sm",
          // La captura de teléfono es muy estrecha y alta: estirarla al ancho
          // del contenedor en escritorio la dejaría enorme y borrosa.
          angosta && "mx-auto max-w-xs",
        )}
      />
      {pie && (
        <figcaption className="mt-2 text-sm text-neutral-500">{pie}</figcaption>
      )}
    </figure>
  );
}
