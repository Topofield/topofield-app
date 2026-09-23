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
