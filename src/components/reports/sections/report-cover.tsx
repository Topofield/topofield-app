import { formatDate } from "@/lib/utils/format";
import type { ReportCoverData } from "@/types/report";

interface ReportCoverProps {
  title: string;
  /** Los datos del proyecto, en vivo (`coverOf`). */
  cover: ReportCoverData;
  dateLabel?: string;
  date: string | null;
}

/** Portada del informe: título y datos del proyecto (§ 4.7). */
export function ReportCover({
  title,
  cover,
  dateLabel = "Fecha del informe",
  date,
}: ReportCoverProps) {
  return (
    <section className="report-cover">
      <p className="report-kicker">Informe técnico</p>
      <h1 className="report-title">{title}</h1>
      <dl className="report-cover-grid">
        <dt>Proyecto</dt>
        <dd>{cover.name}</dd>
        {cover.client && (
          <>
            <dt>Cliente</dt>
            <dd>{cover.client}</dd>
          </>
        )}
        {cover.location && (
          <>
            <dt>Ubicación</dt>
            <dd>{cover.location}</dd>
          </>
        )}
        {cover.datum && (
          <>
            <dt>Datum / proyección</dt>
            <dd>
              {cover.datum}
              {cover.projection ? ` · ${cover.projection}` : ""}
            </dd>
          </>
        )}
        <dt>{dateLabel}</dt>
        <dd>{date ? formatDate(date) : "—"}</dd>
      </dl>
    </section>
  );
}
