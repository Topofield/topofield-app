"use client";

import { Button, Card } from "@/components/design-system";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { formatCoordinate } from "@/lib/utils/format";
import type { AngleInputFormat } from "@/types/polygonal";
import { formatAngle } from "./angle-format";
import type { Dms3, PolygonalDraft } from "./polygonal-save";

const angleOf = (d: Dms3 | null, format: AngleInputFormat) =>
  formatAngle(d ? dmsToDecimal(d.deg, d.min, d.sec) : null, format);

/**
 * La tarjeta del amarre en el paso de datos (Fase 35): vacía, invita a empezar
 * por él o a medir en coordenadas locales; llena, resume la partida, el 0 atrás
 * y, en la abierta con control, la llegada.
 */
export function AmarreCard({
  draft,
  referenceLabel,
  angleFormat,
  pending,
  onEdit,
  onLocal,
}: {
  draft: PolygonalDraft;
  referenceLabel: string | null;
  angleFormat: AngleInputFormat;
  pending: boolean;
  onEdit: () => void;
  onLocal: () => void;
}) {
  const a = draft.amarre;
  if (a.startCode.trim() === "") {
    return (
      <Card title="Puntos de amarre">
        <div className="flex flex-col items-start gap-3">
          <p className="font-semibold">Empieza por el amarre</p>
          <p className="text-sm text-ink-2">
            La estación de partida y la referencia a la que pones 0° atrás. Con ellos, cada medición sale con su
            azimut.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onEdit}>
              Ingresar puntos de amarre
            </Button>
            {draft.details.type !== "open_controlled" && (
              <button
                type="button"
                className="min-h-11 text-sm font-medium text-mira-ink underline underline-offset-2 disabled:opacity-50"
                onClick={onLocal}
                disabled={pending}
              >
                Medir sin amarre, en coordenadas locales
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const oriented = a.referencePointId !== null || a.referenceCode !== null;
  return (
    <Card
      title="Puntos de amarre"
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Editar amarre
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-2">Estación de partida</dt>
        <dd>
          <span className="font-semibold">{a.startCode}</span> · N {formatCoordinate(a.startNorth)} · E{" "}
          {formatCoordinate(a.startEast)}
        </dd>
        <dt className="text-ink-2">{oriented ? "0° atrás" : "Sin 0 atrás"}</dt>
        <dd>
          {oriented ? (
            <>
              <span className="font-semibold">{referenceLabel}</span> · azimut {angleOf(a.startAzimuth, angleFormat)}
            </>
          ) : (
            <>Azimut del primer lado {angleOf(a.startAzimuth, angleFormat)}</>
          )}
        </dd>
        {draft.details.type === "open_controlled" && (
          <>
            <dt className="text-ink-2">Llegada</dt>
            <dd>
              {a.endCode ? (
                <>
                  <span className="font-semibold">{a.endCode}</span> · N {formatCoordinate(a.endNorth)} · E{" "}
                  {formatCoordinate(a.endEast)}
                  {a.endAzimuth && <> · azimut de llegada {angleOf(a.endAzimuth, angleFormat)}</>}
                </>
              ) : (
                <span className="text-warning">Falta el punto de llegada.</span>
              )}
            </dd>
          </>
        )}
      </dl>
    </Card>
  );
}
