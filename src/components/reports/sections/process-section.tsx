import type { ReportSection } from "@/lib/reports/sections";
import { CANDIDATE_KIND_LABELS } from "@/types/report";
import { LevelingReportSection } from "./leveling-section";
import { PolygonalReportSection } from "./polygonal-section";
import { SettlementReportSection } from "./settlement-section";

interface ReportProcessSectionProps {
  section: ReportSection;
  /** Título de la sección; por omisión, el nombre del proceso. */
  title?: string;
}

/** La sección de un proceso en el informe: título, tipo y su cuerpo. */
export function ReportProcessSection({ section, title }: ReportProcessSectionProps) {
  return (
    <section className="report-section report-break">
      <h2>
        {title ?? section.entry.name}
        <span className="report-kind-tag">{CANDIDATE_KIND_LABELS[section.entry.type]}</span>
      </h2>

      {section.kind === "missing" && (
        <p className="report-missing">
          Este proceso ya no está disponible. Se emitió con el nombre «{section.entry.name}».
        </p>
      )}
      {section.kind === "polygonal" && <PolygonalReportSection data={section.data} />}
      {section.kind === "leveling" && <LevelingReportSection data={section.data} />}
      {section.kind === "site" && <SettlementReportSection data={section.data} />}
    </section>
  );
}
