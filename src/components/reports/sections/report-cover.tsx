import { formatDate } from "@/lib/utils/format";
import type { Project } from "@/types/project";

interface ReportCoverProps {
  title: string;
  project: Project;
  /** Etiqueta de la fecha: «Fecha de emisión» en un informe emitido. */
  dateLabel?: string;
  date: string | null;
}

/** Portada del informe: título y datos del proyecto (§ 4.7). */
export function ReportCover({
  title,
  project,
  dateLabel = "Fecha de emisión",
  date,
}: ReportCoverProps) {
  return (
    <section className="report-cover">
      <p className="report-kicker">TopoField — Informe técnico</p>
      <h1 className="report-title">{title}</h1>
      <dl className="report-cover-grid">
        <dt>Proyecto</dt>
        <dd>{project.name}</dd>
        {project.client && (
          <>
            <dt>Cliente</dt>
            <dd>{project.client}</dd>
          </>
        )}
        {project.location && (
          <>
            <dt>Ubicación</dt>
            <dd>{project.location}</dd>
          </>
        )}
        {project.datum && (
          <>
            <dt>Datum / proyección</dt>
            <dd>
              {project.datum}
              {project.projection ? ` · ${project.projection}` : ""}
            </dd>
          </>
        )}
        <dt>{dateLabel}</dt>
        <dd>{date ? formatDate(date) : "—"}</dd>
      </dl>
    </section>
  );
}
