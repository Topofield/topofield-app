"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal, NumberInput } from "@/components/design-system";
import type { DraftSaveResult } from "@/components/process/use-process-draft";
import { validateLevelingBm } from "./leveling-details";
import { draftWithBm, type LevelingDraft } from "./leveling-save";

const text = (v: number | null) => (v == null ? "" : v.toFixed(4));

/**
 * El popup del BM (Fase 36, maqueta «BM»): el código y la cota del BM de
 * partida y, en una de enlace, los del de llegada. El BM se teclea: no hay
 * catálogo (decisión 2). Guarda al confirmar; si falla, el error queda aquí.
 */
export function BmDialog({
  draft,
  onSave,
  onClose,
}: {
  draft: LevelingDraft;
  onSave: (next: LevelingDraft) => Promise<DraftSaveResult>;
  onClose: () => void;
}) {
  const link = draft.details.type === "link";
  const [startCode, setStartCode] = useState(draft.bm.startCode);
  const [startElevation, setStartElevation] = useState(text(draft.bm.startElevation));
  const [endCode, setEndCode] = useState(draft.bm.endCode ?? "");
  const [endElevation, setEndElevation] = useState(text(draft.bm.endElevation));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const read = validateLevelingBm({
      type: draft.details.type,
      startBmCode: startCode,
      startBmElevation: startElevation,
      endBmCode: endCode,
      endBmElevation: endElevation,
    });
    if ("error" in read) return setError(read.error);
    setError(null);
    startTransition(async () => {
      const response = await onSave(draftWithBm(draft, read.bm));
      if (response.ok) onClose();
      else setError(response.error ?? "No se pudo guardar el BM.");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={link ? "BM de partida y de llegada" : "BM de partida"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p className="text-sm text-ink-2">El punto de cota conocida donde empieza la libreta.</p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Código" value={startCode} onChange={(e) => setStartCode(e.target.value)} />
          <NumberInput label="Cota conocida (m)" value={startElevation} onChange={(e) => setStartElevation(e.target.value)} />
        </div>
        {link ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">BM de llegada</legend>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Código" value={endCode} onChange={(e) => setEndCode(e.target.value)} />
              <NumberInput label="Cota conocida (m)" value={endElevation} onChange={(e) => setEndElevation(e.target.value)} />
            </div>
          </fieldset>
        ) : (
          <p className="rounded-md border border-dashed border-rule-strong px-3 py-2.5 text-sm text-ink-2">
            {draft.details.type === "closed"
              ? "Una nivelación cerrada vuelve a este mismo BM: no tiene BM de llegada."
              : "Una nivelación abierta termina en un punto sin cota conocida: no tiene BM de llegada."}
          </p>
        )}
        <p className="text-xs text-ink-2">Cambiar la cota del BM recalcula todas las cotas de la libreta.</p>
      </form>
    </Modal>
  );
}
