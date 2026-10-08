// El pie de página del PDF (Fase 40): «Proyecto · Proceso» a la izquierda de
// cada página. La paginación, que es igual en todos, va en `globals.css`; este
// texto cambia por informe, así que el propio informe lo inyecta en un
// `<style>`.

/**
 * `value` como cadena CSS entre comillas. Escapa la barra invertida y las
 * comillas, convierte los saltos de línea en espacios y escribe `<` y `>`
 * como escapes CSS, para que el texto no pueda cerrar el `<style>`.
 */
export function cssString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .replace(/</g, "\\3c ")
    .replace(/>/g, "\\3e ");
  return `"${escaped}"`;
}

/** La regla `@page` con el pie izquierdo: el proyecto y el proceso. */
export function pageFooterCss(projectName: string, processName: string): string {
  const text = [projectName, processName].map((s) => s.trim()).filter(Boolean).join(" · ");
  return `@media print { @page { @bottom-left { content: ${cssString(text)}; } } }`;
}
