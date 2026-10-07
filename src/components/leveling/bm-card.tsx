import { Badge, Button } from "@/components/design-system";
import { formatElevation } from "@/lib/utils/format";
import { runEnded } from "./armadas";
import type { LevelingDraft } from "./leveling-save";

/** Hacia dónde va la nivelación desde el BM de partida, según el tipo. */
function arrivalOf(draft: LevelingDraft): string {
  const { type } = draft.details;
  if (type === "closed") return `circuito: vuelve a ${draft.bm.startCode}`;
  if (type === "link") return `→ ${draft.bm.endCode ?? "…"} · ${formatElevation(draft.bm.endElevation)} m`;
  return runEnded(draft.forward) ? `→ ${draft.forward.at(-1)!.pointCode}, sin cota conocida` : "llegada sin cota conocida";
}

/**
 * El BM de la libreta (Fase 36, libreta B): el código y la cota de partida, la
 * llegada —el de enlace, con su cota— y «Editar», que abre su popup.
 */
export function BmCard({ draft, onEdit }: { draft: LevelingDraft; onEdit: () => void }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-rule bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-base font-semibold">{draft.bm.startCode}</span>
        <Badge tone="primary">BM de partida</Badge>
        <span className="text-sm text-ink-2 tabular-nums">{formatElevation(draft.bm.startElevation)} m</span>
        <span className="text-sm text-ink-2 tabular-nums">{arrivalOf(draft)}</span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>
    </section>
  );
}
