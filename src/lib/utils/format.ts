// Formateo de valores para la interfaz. Zona horaria America/Bogota e idioma
// español (Colombia), según CLAUDE.md.

/**
 * Precisión relativa como `1:X`, con separador de miles en es-CO.
 *
 * Es el **único** formateador de precisión del proyecto. Antes había uno por
 * pantalla y el listado no usaba ninguno: mostraba `relative_precision` tal
 * como el servidor la persiste —texto ya formateado, pero SIN separador— así
 * que el mismo proceso se leía `1:1001` en el listado y `1:1.001` en el
 * editor. Un informe que consolidara precisiones habría añadido una tercera
 * representación.
 *
 * Acepta número (lo que calcula el motor) y cadena (lo que hay en la base),
 * para que el listado pueda usarlo sin migrar la columna.
 */
export function formatPrecision(
  value: number | string | null | undefined,
): string {
  if (value == null || value === "") return "—";

  if (typeof value === "string") {
    if (value.includes("∞")) return "1:∞";
    // Se quitan los puntos de miles antes de reinterpretar: la cadena puede
    // venir con separadores o sin ellos según quién la escribiera.
    const digits = value.replace(/^1:/, "").replace(/\./g, "");
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? formatPrecision(parsed) : "—";
  }

  if (!Number.isFinite(value)) return "1:∞";
  return `1:${Math.round(value).toLocaleString("es-CO")}`;
}

/**
 * «Marca Modelo · s/n Serie», o "—" si no hay marca ni modelo.
 *
 * Compone el equipo tal como lo mostraba antes la portada del informe con
 * `project.equipment_*`. Desde la Fase 8 el equipo vive en cada proceso, no en
 * el proyecto, así que esto lo usan las secciones del informe y los libros de
 * `src/lib/export/` — sin introducir una segunda forma de combinar los tres
 * campos.
 */
export function formatEquipmentLine(
  brand: string | null | undefined,
  model: string | null | undefined,
  serial?: string | null,
): string {
  const combo = [brand, model].filter(Boolean).join(" ");
  if (combo === "") return "—";
  return serial ? `${combo} · s/n ${serial}` : combo;
}

/** «2.0″» (ISO 17123-3), o "—" si la estación total no tiene precisión angular registrada. */
export function formatAngularPrecision(
  seconds: number | string | null | undefined,
): string {
  if (seconds === null || seconds === undefined || seconds === "") return "—";
  const v = Number(seconds);
  return Number.isFinite(v) ? `${v}″` : "—";
}

/**
 * «3 mm + 2 ppm», los dos términos de la ISO 17123-4. "—" si falta cualquiera
 * de los dos: una precisión de distancia a medias no es un dato usable.
 */
export function formatDistancePrecision(
  mm: number | string | null | undefined,
  ppm: number | string | null | undefined,
): string {
  const m = mm === null || mm === undefined || mm === "" ? null : Number(mm);
  const p = ppm === null || ppm === undefined || ppm === "" ? null : Number(ppm);
  if (m === null || p === null || !Number.isFinite(m) || !Number.isFinite(p)) {
    return "—";
  }
  return `${m} mm + ${p} ppm`;
}

/** «1.5 mm/km» (ISO 17123-2, doble nivelación), o "—" si el nivel no la tiene registrada. */
export function formatKmPrecision(
  mmPerKm: number | string | null | undefined,
): string {
  if (mmPerKm === null || mmPerKm === undefined || mmPerKm === "") return "—";
  const v = Number(mmPerKm);
  return Number.isFinite(v) ? `${v} mm/km` : "—";
}

/** Formatea un timestamp ISO (timestamptz) como "21 de mayo de 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}

/**
 * Formatea una fecha sin hora ("YYYY-MM-DD", columnas DATE) como
 * "21 de mayo de 2026". No aplica zona horaria para no desplazar el día.
 */
export function formatDateOnly(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Fecha relativa en español («hoy», «hace 3 días», «hace 2 meses»).
 *
 * Comunica la recencia mejor que una fecha absoluta en un listado. La fecha
 * exacta debe quedar disponible en el atributo `title` de quien la muestre.
 *
 * `now` se inyecta para poder testear de forma determinista. Las fechas
 * futuras (`iso` posterior a `now`) también devuelven «hoy»: `updated_at` lo
 * escribe la base de datos y puede ir unos segundos por delante del reloj
 * del cliente, así que tratar ese desfase como «hoy» es intencional.
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const dias = Math.floor(
    (now.getTime() - new Date(iso).getTime()) / 86_400_000,
  );

  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;

  if (dias < 28) {
    const semanas = Math.floor(dias / 7);
    return `hace ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }

  if (dias < 360) {
    const meses = Math.max(1, Math.floor(dias / 30));
    return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  }

  const años = Math.max(1, Math.floor(dias / 365));
  return `hace ${años} ${años === 1 ? "año" : "años"}`;
}

/**
 * Código de un punto de asentamiento con su estado (Fase 11), para las
 * gráficas del panel y del informe. Un punto de baja sigue en la gráfica —su
 * serie es historia válida— y la marca explica por qué su línea termina. Uno
 * de alta empieza en 0 a mitad del eje: la fecha dice desde cuándo cuenta su
 * acumulado.
 */
export function settlementPointLabel(point: {
  code: string;
  activeFrom: string | null;
  retiredOn: string | null;
}): string {
  if (point.retiredOn !== null) return `${point.code} (de baja)`;
  if (point.activeFrom !== null) {
    return `${point.code} (alta ${formatDateOnly(point.activeFrom)})`;
  }
  return point.code;
}

/** mm con un decimal, en es-CO, sin signo. */
function mmAbs(value: number): string {
  return Math.abs(value).toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Mensaje del aviso de lectura fuera de tendencia (Fase 12). Dice qué se
 * esperaba y qué se midió, para que quien verifica sepa qué buscar en la
 * libreta.
 */
export function formatTrendDeviation(deviation: {
  kind: "contrary" | "excessive";
  partialMm: number;
  previousVelocity: number;
  expectedMm: number;
}): string {
  const moves = (mm: number) => (mm > 0 ? "subir" : "bajar");
  if (deviation.kind === "contrary") {
    // Con velocidad previa 0 la regla trata el punto como «bajando» (d = −1),
    // pero decirlo así sería falso: el punto estaba quieto.
    const venia =
      deviation.previousVelocity === 0
        ? "estable"
        : `${deviation.previousVelocity > 0 ? "subiendo" : "bajando"} ${mmAbs(deviation.previousVelocity)} mm/mes`;
    return `Se sale de la tendencia: el punto venía ${venia} y esta lectura lo hace ${moves(deviation.partialMm)} ${mmAbs(deviation.partialMm)} mm. Verifica la lectura.`;
  }
  const verbo = deviation.partialMm > 0 ? "sube" : "baja";
  return `Se sale de la tendencia: ${verbo} ${mmAbs(deviation.partialMm)} mm cuando su ritmo anterior preveía unos ${mmAbs(deviation.expectedMm)} mm. Verifica la lectura.`;
}

/** «7 ene 2025»: la fecha corta de tablas y ejes (Fase 18). Sin zona horaria. */
export function formatDateShort(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day)
    .toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

/** Milímetros con signo explícito: «+1.3», «-2.0», «0.0»; «—» sin valor. */
export function formatSignedMm(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = value.toFixed(decimals);
  if (Number(text) === 0) return (0).toFixed(decimals);
  return value > 0 ? `+${text}` : text;
}

/**
 * El cierre de la libreta de una visita en palabras (Fase 18): el error y su
 * veredicto frente a la tolerancia. Fuera de tolerancia es un aviso, no un
 * bloqueo (decisión 5), así que el texto no dice «rechazada».
 */
export function formatBookClosure(
  closureErrorMm: number | null | undefined,
  toleranceMm: number | null | undefined,
  meetsTolerance: boolean | null | undefined,
): { value: string; detail: string; status: "ok" | "out" | "unknown" } {
  if (closureErrorMm == null) {
    return { value: "—", detail: "Libreta incompleta: falta cerrar en el amarre", status: "unknown" };
  }
  const value = `${formatSignedMm(closureErrorMm)} mm`;
  if (toleranceMm == null || meetsTolerance == null) {
    return { value, detail: "Sin tolerancia: faltan distancias", status: "unknown" };
  }
  return meetsTolerance
    ? { value, detail: `Dentro de tolerancia (±${toleranceMm.toFixed(1)} mm)`, status: "ok" }
    : { value, detail: `Fuera de tolerancia (±${toleranceMm.toFixed(1)} mm)`, status: "out" };
}
