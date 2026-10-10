// Los menús de la ruta de la barra (Fase 44, HC2): saltar a otro proyecto o a
// otro proceso del proyecto sin pasar por el dashboard ni por el hub. Función
// pura: la consulta trae las filas y esto arma las entradas.

import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/types/project";

export interface RouteMenuEntry {
  label: string;
  href: string;
  /** El tipo del proceso, o «Archivado» en un proyecto archivado. */
  hint?: string;
  /** La entrada de la página en la que se está. */
  current?: boolean;
}

export interface RouteMenus {
  projects: RouteMenuEntry[];
  processes: RouteMenuEntry[];
}

interface Named {
  id: string;
  name: string;
}

export interface RouteMenuRows {
  projects: (Named & { status: string })[];
  polygonals: Named[];
  levelings: Named[];
  sites: Named[];
}

const byName = (a: Named, b: Named) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });

export function routeMenusOf(
  rows: RouteMenuRows,
  current: { projectId: string; processHref?: string },
): RouteMenus {
  const projects = [...rows.projects].sort(byName).map(
    (p): RouteMenuEntry => ({
      label: p.name,
      href: `/projects/${p.id}`,
      ...(p.status === "archived" && { hint: PROJECT_STATUS_LABELS[p.status as ProjectStatus] }),
      ...(p.id === current.projectId && { current: true }),
    }),
  );
  const base = `/projects/${current.projectId}`;
  const group = (items: Named[], path: string, hint: string) =>
    [...items].sort(byName).map((item): RouteMenuEntry => {
      const href = `${base}/${path}/${item.id}`;
      return { label: item.name, href, hint, ...(href === current.processHref && { current: true }) };
    });
  return {
    projects,
    processes: [
      ...group(rows.polygonals, "polygonal", "Poligonal"),
      ...group(rows.levelings, "leveling", "Nivelación"),
      ...group(rows.sites, "settlement", "Asentamientos"),
    ],
  };
}
