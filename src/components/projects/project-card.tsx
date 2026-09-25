import Link from "next/link";
import { Badge } from "@/components/design-system";
import { formatDate } from "@/lib/utils/format";
import { PROJECT_STATUS_LABELS, type Project } from "@/types/project";

export function ProjectCard({
  project,
  processCount,
}: {
  project: Project;
  processCount: number;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-rule bg-card p-5 shadow-sm transition-colors hover:border-rule-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{project.name}</h3>
        <Badge tone={project.status === "active" ? "success" : "neutral"}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-ink-2">{project.client}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-2">
        <span className="truncate">{project.location}</span>
        <span className="shrink-0">{formatDate(project.created_at)}</span>
      </div>
      <p className="mt-2 text-xs text-ink-2">
        <span className="tabular-nums">{processCount}</span>{" "}
        {processCount === 1 ? "proceso" : "procesos"}
      </p>
    </Link>
  );
}
