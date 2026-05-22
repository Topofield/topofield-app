import { Card } from "@/components/design-system";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectEditForm } from "./project-edit-form";
import { ReferencePointsManager } from "./reference-points-manager";
import type { Project, ReferencePoint } from "@/types/project";

interface ProjectConfigTabProps {
  project: Project;
  referencePoints: ReferencePoint[];
}

export function ProjectConfigTab({
  project,
  referencePoints,
}: ProjectConfigTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card title="Datos del proyecto">
        <ProjectEditForm project={project} />
      </Card>
      <ReferencePointsManager
        projectId={project.id}
        points={referencePoints}
      />
      <Card title="Zona de peligro">
        <DeleteProjectDialog project={project} />
      </Card>
    </div>
  );
}
