import type { ReactNode } from "react";
import { Badge } from "@/components/design-system";
import { formatDate, formatDateOnly } from "@/lib/utils/format";
import {
  PRECISION_ORDER_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
} from "@/types/project";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value || "—"}</dd>
    </div>
  );
}

export function ProjectHeader({ project }: { project: Project }) {
  const coordinates =
    project.latitude != null && project.longitude != null
      ? `${project.latitude}, ${project.longitude}`
      : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{project.client}</p>
        </div>
        <Badge tone={project.status === "active" ? "success" : "neutral"}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </div>

      {project.description && (
        <p className="mt-3 text-sm text-neutral-700">{project.description}</p>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Ubicación" value={project.location} />
        <Field label="Coordenadas" value={coordinates} />
        <Field label="Fecha de creación" value={formatDate(project.created_at)} />
        <Field label="Datum" value={project.datum} />
        <Field label="Proyección" value={project.projection} />
        <Field
          label="Orden de precisión"
          value={PRECISION_ORDER_LABELS[project.precision_order]}
        />
        <Field
          label="Equipo"
          value={`${project.equipment_brand} ${project.equipment_model}`}
        />
        <Field label="Serie" value={project.equipment_serial} />
        <Field
          label="Calibración"
          value={formatDateOnly(project.equipment_calibration_date)}
        />
        <Field
          label="Precisión angular"
          value={`${project.angular_precision_seconds}″`}
        />
        <Field label="Precisión lineal" value={project.linear_precision} />
      </dl>
    </div>
  );
}
