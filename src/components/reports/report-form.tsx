"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Textarea,
} from "@/components/design-system";
import { createReportAction } from "@/app/(app)/projects/[id]/reports/actions";
import type { EligibleCandidate } from "@/lib/reports/eligibility";
import { CANDIDATE_KIND_LABELS } from "@/types/report";

interface ReportFormProps {
  projectId: string;
  /** Trabajos cerrados del proyecto; ya filtrados por elegibilidad. */
  candidates: EligibleCandidate[];
}

function claveDe(c: { kind: string; id: string }): string {
  return `${c.kind}:${c.id}`;
}

/**
 * Alta de un informe (§ 4.7): elegir procesos cerrados, ordenarlos, poner
 * título y observaciones.
 *
 * El orden se maneja con botones «subir/bajar» y no con arrastrar y soltar,
 * que es lo que sugería el § 4.7: el drag & drop exigiría una librería —el
 * proyecto no usa ninguna— y es difícil de operar con teclado. Las flechas
 * dan el mismo control y son accesibles sin trabajo extra.
 */
export function ReportForm({ projectId, candidates }: ReportFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [observations, setObservations] = useState("");
  /** Claves elegidas, EN ORDEN: la posición en el array es el orden final. */
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const porClave = new Map(candidates.map((c) => [claveDe(c), c]));

  function toggle(clave: string) {
    setSelected((prev) =>
      prev.includes(clave)
        ? prev.filter((k) => k !== clave)
        : [...prev, clave],
    );
  }

  function mover(index: number, delta: number) {
    setSelected((prev) => {
      const destino = index + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(index, 1);
      if (item === undefined) return prev;
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim() === "") {
      setError("El informe necesita un título.");
      return;
    }
    if (selected.length === 0) {
      setError("Elige al menos un proceso cerrado.");
      return;
    }

    startTransition(async () => {
      const response = await createReportAction({
        projectId,
        title,
        observations: observations.trim() === "" ? null : observations,
        selected: selected.map((clave) => {
          const c = porClave.get(clave)!;
          return { kind: c.kind, id: c.id };
        }),
      });
      if (response.ok && response.reportId) {
        router.push(`/projects/${projectId}/reports/${response.reportId}`);
      } else {
        setError(response.error ?? "No se pudo generar el informe.");
      }
    });
  }

  // Un proyecto sin nada cerrado no puede informar. Se dice explícitamente en
  // vez de mostrar un formulario vacío que no llevaría a ninguna parte.
  if (candidates.length === 0) {
    return (
      <Card title="Nuevo informe">
        <EmptyState
          title="Todavía no hay procesos cerrados"
          description="Un informe solo puede incluir procesos cerrados, porque son los únicos cuyos datos ya no cambian. Cierra una poligonal, una nivelación o un lugar de control para poder generarlo."
        />
      </Card>
    );
  }

  return (
    <Card title="Nuevo informe">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          placeholder="Informe de cierre — etapa 1"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-800">
            Procesos cerrados a incluir
          </legend>
          <div className="flex flex-col gap-1">
            {candidates.map((c) => {
              const clave = claveDe(c);
              return (
                <label
                  key={clave}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(clave)}
                    onChange={() => toggle(clave)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-500"
                  />
                  <span className="text-neutral-500">
                    {CANDIDATE_KIND_LABELS[c.kind]}
                  </span>
                  <span>{c.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {selected.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-neutral-800">
              Orden de las secciones
            </legend>
            <ol className="flex flex-col gap-1">
              {selected.map((clave, i) => {
                const c = porClave.get(clave);
                if (!c) return null;
                return (
                  <li
                    key={clave}
                    className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-2 tabular-nums text-neutral-500">
                        {i + 1}.
                      </span>
                      {c.name}
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0 || isPending}
                        aria-label={`Subir ${c.name}`}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => mover(i, 1)}
                        disabled={i === selected.length - 1 || isPending}
                        aria-label={`Bajar ${c.name}`}
                      >
                        ↓
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        )}

        <Textarea
          label="Observaciones generales"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          disabled={isPending}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Generando…" : "Generar informe"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
