import Link from "next/link";
import { Card } from "@/components/design-system";
import { computeLevelingDetected, samePointCode } from "@/lib/calculations/leveling";
import { formatSignedMm } from "@/lib/utils/format";
import type { LevelingProcess, LevelingReading, LevelingResult, RunType } from "@/types/leveling";
import { AdjustedTable } from "./adjusted-table";
import { ArithmeticCheck } from "./arithmetic-check";
import { ComparisonChart } from "./comparison-chart";
import { comparisonData, compensationRows } from "./comparison-data";
import { arithmeticOf } from "./libreta-rows";
import { levelingDraftOf, levelingInputOf, type LevelingDraft } from "./leveling-save";
import { OrderVerdict } from "./order-verdict";

/** Por qué aún no hay compensación: el recorrido que la libreta no termina. */
function pendingMessage(draft: LevelingDraft, run: RunType): string {
  const { type, hasReturnRun } = draft.details;
  const { startCode, endCode } = draft.bm;
  if (run === "return") return `La vuelta aún no llega a ${startCode}: marca «Llega a ${startCode}» en su última armada.`;
  if (!draft.forward.some((r, i) => i > 0 && r.foresight != null)) return "La libreta aún no tiene armadas.";
  if (type === "closed") return `La ida aún no vuelve a ${startCode}: marca «Llega al BM» en su última armada.`;
  if (type === "link") return `La ida aún no llega a ${endCode ?? "su BM de llegada"}: marca «Llega a ${endCode ?? "…"}» en su última armada.`;
  return hasReturnRun
    ? "La ida aún no termina: marca «Fin de la ida» en su última armada y sigue con la vuelta."
    : "La libreta aún no tiene armadas.";
}

/** La frase del método, según el tipo. */
function methodSentence(draft: LevelingDraft, withReturn: boolean): string {
  const { type } = draft.details;
  if (type === "open") return "El error del circuito ida + vuelta se reparte según la distancia recorrida hasta cada punto.";
  const base =
    type === "closed"
      ? "El error de cierre se reparte según la distancia recorrida hasta cada punto; el BM conserva su cota."
      : `El error de llegada a ${draft.bm.endCode ?? "el BM de llegada"} se reparte según la distancia recorrida hasta cada punto; los dos BM conservan su cota.`;
  return withReturn ? `${base} La vuelta se compensa con su propio cierre.` : base;
}

function closureCaption(result: LevelingResult, draft: LevelingDraft): string | null {
  const km = (v: number) => `${(v * 1000).toFixed(1)} m`;
  if (draft.details.type === "open") {
    if (result.circuitClosureMm == null || !result.return) return null;
    return `Cierre del circuito ${formatSignedMm(result.circuitClosureMm)} mm en ${km(result.forward.distanceKm + result.return.distanceKm)}`;
  }
  if (result.closureErrorMm == null) return null;
  const what = draft.details.type === "closed" ? "Cierre" : `Llegada a ${draft.bm.endCode ?? "…"}`;
  return `${what} ${formatSignedMm(result.closureErrorMm)} mm en ${km(result.forward.distanceKm)}`;
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-2">{label}</div>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}

const meters = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(4)} m`;

/**
 * Paso 2 · Compensación (Fase 36, maqueta «Compensación»): el método en una
 * frase, el orden alcanzado con su «Por qué» y el aviso si no alcanza ninguno,
 * la tabla de cotas medidas, correcciones y cota ajustada, y el gráfico único.
 * La abierta sin vuelta no se compensa: muestra la comprobación aritmética.
 */
export function CompensacionTab({ process, readings }: { process: LevelingProcess; readings: LevelingReading[] }) {
  const draft = levelingDraftOf(process, readings);
  const input = levelingInputOf(draft);
  const { result, order, pending } = computeLevelingDetected(input);
  const libretaHref = `/projects/${process.project_id}/leveling/${process.id}?tab=libreta`;

  if (pending) {
    return (
      <Card title="Sin compensación todavía">
        <p className="text-sm">{pendingMessage(draft, pending)}</p>
        <p className="mt-2 text-sm text-ink-2">
          La compensación se calcula cuando la libreta llega a su BM.{" "}
          <Link href={libretaHref} className="font-medium text-mira-ink underline underline-offset-2">
            Ir a la libreta
          </Link>
        </p>
      </Card>
    );
  }

  if (!result.compensated) {
    const open = draft.details.type === "open" && !draft.details.hasReturnRun;
    return (
      <div className="flex flex-col gap-4">
        <Card title="Sin compensación">
          <p className="text-sm text-ink-2">
            {open
              ? "Sin vuelta ni BM de llegada no hay error que repartir: las cotas son las medidas y el informe dice que no tiene verificación."
              : "Sin las distancias de la libreta no hay tolerancia ni corrección proporcional: las cotas son las medidas."}
          </p>
        </Card>
        <ArithmeticCheck check={arithmeticOf(result.forward)} label="ida" />
      </div>
    );
  }

  const withReturn = result.return != null;
  const rows = compensationRows(result, input);
  const chart = comparisonData(result, input);
  const caption = closureCaption(result, draft);
  const adjusted = rows.filter((r) => r.distanceM != null && r.adjusted != null);
  const from = adjusted[0];
  const to = adjusted.at(-1);
  const checks = [arithmeticOf(result.forward), ...(result.return ? [arithmeticOf(result.return)] : [])];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">Corrección proporcional a la distancia</h2>
          <p className="text-sm text-ink-2">{methodSentence(draft, withReturn)}</p>
        </div>
        <OrderVerdict result={result} type={draft.details.type} order={order} />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[5_1_640px] flex-col gap-4">
          <section className="rounded-lg border border-rule bg-card shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
              <h2 className="text-lg font-semibold">{withReturn ? "Cotas compensadas y ajustadas" : "Cotas compensadas"}</h2>
              {caption && <span className="text-sm text-ink-2 tabular-nums">{caption}</span>}
            </header>
            <AdjustedTable rows={rows} withReturn={withReturn} />
          </section>
          <section className="grid grid-cols-1 gap-x-5 gap-y-3 rounded-lg border border-rule bg-card px-4 py-3.5 shadow-sm sm:grid-cols-3">
            <Figure label={withReturn ? "Desnivel ida · vuelta" : "Desnivel medido"}>
              {meters(result.forward.heightDifference)}
              {result.return && <> · {meters(result.return.heightDifference)}</>}
            </Figure>
            {from && to && !samePointCode(from.code, to.code) && (
              <Figure label={`Desnivel ajustado ${from.code} → ${to.code}`}>{meters(to.adjusted! - from.adjusted!)}</Figure>
            )}
            <Figure label="Comprobación aritmética">
              {checks.every((c) => c.ok)
                ? withReturn
                  ? "cuadra en la ida y en la vuelta"
                  : "cuadra"
                : `no cuadra en ${checks[0]!.ok ? "la vuelta" : "la ida"}`}
            </Figure>
          </section>
        </div>
        {chart && (
          <section className="min-w-0 flex-[3_1_360px] rounded-lg border border-rule bg-card shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-rule px-4 py-3">
              <h2 className="text-lg font-semibold">{withReturn ? "Ida, vuelta y ajustada" : "Medida y ajustada"}</h2>
              <span className="text-sm text-ink-2">diferencias ×1000</span>
            </header>
            <div className="px-4 py-4">
              <ComparisonChart data={chart} />
            </div>
          </section>
        )}
      </div>
      <p className="text-xs text-ink-2">
        Las cotas medidas son las de la libreta, sin compensar. <Link href={libretaHref} className="underline underline-offset-2">Ver la libreta</Link>
      </p>
    </div>
  );
}
