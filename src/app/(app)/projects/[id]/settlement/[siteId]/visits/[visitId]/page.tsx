import { EmptyState } from "@/components/design-system";
import { ProcessSteps } from "@/components/process/process-steps";
import { visitArmadaSpans } from "@/components/settlement/visit-armadas";
import type { VisitData } from "@/components/settlement/visit-dialog-form";
import { VisitHeader } from "@/components/settlement/visit-header";
import { VisitImportButton } from "@/components/settlement/visit-import-dialog";
import { VisitLibretaTab } from "@/components/settlement/visit-libreta-tab";
import { pointInputOf } from "@/lib/calculations/settlement";
import { bookRowInputOf, bookVerification, computeBook } from "@/lib/calculations/settlement-book";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { formatDateOnly, formatEquipmentLine } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { loadVisitData } from "./visit-data";

interface VisitPageProps {
  params: Promise<{ id: string; siteId: string; visitId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const STEPS = [
  { id: "libreta", label: "Libreta" },
  { id: "resultados", label: "Resultados" },
] as const;

/**
 * Una visita por pasos (Fase 37, decisión 6): 1 · Libreta —sus armadas, que
 * se guardan lectura por lectura— y 2 · Resultados. La cabecera lleva «Editar
 * datos», ← → y eliminar; la visita no se cierra.
 */
export default async function VisitPage({ params, searchParams }: VisitPageProps) {
  const { id, siteId, visitId } = await params;
  const { tab } = await searchParams;
  const active = tab === "resultados" ? "resultados" : "libreta";
  const data = await loadVisitData(id, siteId, visitId);
  const { project, site, visit, points, allVisits, visitInputs, book, benchmarks } = data;

  const siteHref = `/projects/${project.id}/settlement/${site.id}`;
  const basePath = `${siteHref}/visits/${visit.id}`;
  const index = allVisits.findIndex((v) => v.id === visit.id);
  const prev = index > 0 ? allVisits[index - 1] : null;
  const next = allVisits[index + 1] ?? null;

  const inputs = book.map(bookRowInputOf);
  const verification =
    book.length === 0
      ? null
      : (() => {
          const v = bookVerification(computeBook(inputs, benchmarks));
          return v.verified && v.order ? PRECISION_ORDER_LABELS[v.order] : "Sin verificación";
        })();
  const equipment = formatEquipmentLine(visit.equipment_brand, visit.equipment_model);
  const visitData: VisitData = {
    date: visit.date,
    operator: visit.operator,
    notes: visit.notes,
    equipmentBrand: visit.equipment_brand,
    equipmentModel: visit.equipment_model,
    equipmentSerial: visit.equipment_serial,
  };
  const pointInputs = points.map(pointInputOf);
  const benchmarkInputs = benchmarks.map((b) => ({ code: b.code, elevation: b.elevation }));

  return (
    <div className="flex flex-col gap-4">
      <VisitHeader
        projectId={project.id}
        projectName={project.name}
        siteId={site.id}
        siteName={site.name}
        visitId={visit.id}
        visitNumber={visit.visit_number}
        dateLabel={formatDateOnly(visit.date)}
        operator={visit.operator}
        equipment={equipment === "—" ? null : equipment}
        updatedAt={visit.updated_at}
        armadas={visitArmadaSpans(book).length}
        verification={verification}
        status={visit.status}
        prevHref={prev ? `${siteHref}/visits/${prev.id}?tab=${active}` : null}
        nextHref={next ? `${siteHref}/visits/${next.id}?tab=${active}` : null}
        initial={{
          date: visit.date,
          operator: visit.operator ?? "",
          notes: visit.notes ?? "",
          brand: visit.equipment_brand ?? "",
          model: visit.equipment_model ?? "",
          serial: visit.equipment_serial ?? "",
        }}
        book={book}
      />
      <ProcessSteps
        steps={STEPS}
        active={active}
        basePath={basePath}
        trailing={
          benchmarks.length > 0 ? (
            <VisitImportButton
              projectId={project.id}
              siteId={site.id}
              visitId={visit.id}
              visit={visitData}
              benchmarkCodes={benchmarks.map((b) => b.code)}
              pointCodes={points.map((p) => p.code)}
              hasReadings={book.some((r) => r.backsight != null || r.foresight != null)}
            />
          ) : undefined
        }
      />
      {active === "libreta" ? (
        <VisitLibretaTab
          projectId={project.id}
          siteId={site.id}
          visitId={visit.id}
          visitNumber={visit.visit_number}
          visit={visitData}
          updatedAt={visit.updated_at}
          book={book}
          benchmarks={benchmarkInputs}
          points={pointInputs}
          others={visitInputs.filter((v) => v.id !== visit.id)}
          thresholds={thresholdsOf(site)}
        />
      ) : (
        // Tarea 13: los resultados.
        <EmptyState title="Resultados" description="Los resultados de la visita." />
      )}
    </div>
  );
}
