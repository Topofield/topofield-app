import { Badge } from "@/components/design-system";
import { ANGLE_TYPE_LABELS, type AngleInputFormat, type AngleType, type PolygonalInput, type PolygonalResult } from "@/types/polygonal";
import { formatAngle, formatSeconds } from "./angle-format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5 last:border-b-0">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * El cierre angular sin ajustar, debajo de la tabla (Fase 35): en la cerrada,
 * vértices, tipo de ángulo detectado, sumas, error y corrección por ángulo; en
 * la abierta con control, el error contra el azimut de llegada.
 */
export function AngularClosureSummary({
  input,
  result,
  angleType,
  angleFormat,
  startCode,
}: {
  input: PolygonalInput;
  result: PolygonalResult;
  angleType: AngleType;
  angleFormat: AngleInputFormat;
  startCode: string;
}) {
  const count = result.angularConditionCount;
  const error = result.angularError;
  const perAngle = error !== null && count ? -error / count : null;

  if (input.type === "open_uncontrolled") {
    return <p className="text-sm text-ink-2">Sin cierre angular: la abierta sin control no llega a un punto conocido.</p>;
  }

  if (input.type === "open_controlled") {
    if (error === null || !count) {
      return (
        <p className="text-sm text-ink-2">
          Sin cierre angular: hace falta el azimut de llegada y la deflexión en el punto de llegada.
        </p>
      );
    }
    return (
      <dl className="text-sm">
        <Row label="Deflexiones en la condición">{count}</Row>
        <Row label="Error contra el azimut de llegada">{formatSeconds(error)}</Row>
        <Row label="Corrección por deflexión">{formatSeconds(perAngle, 2)}</Row>
      </dl>
    );
  }

  if (error === null || !count) {
    return (
      <p className="text-sm text-ink-2">
        El cierre angular aparece cuando la poligonal vuelve a {startCode || "la estación de partida"} y se mide su
        cierre angular.
      </p>
    );
  }
  const vertices = input.hasOrientation ? input.stations.length - 1 : input.stations.length;
  return (
    <dl className="text-sm">
      <Row label="N.º de vértices">{vertices}</Row>
      <Row label="Tipo de ángulo">
        {ANGLE_TYPE_LABELS[angleType]} <Badge className="ml-1">detectado</Badge>
      </Row>
      <Row label="Ángulos en la condición">{count}</Row>
      <Row label="Suma observada">{formatAngle(result.angleSum, angleFormat)}</Row>
      <Row label="Suma teórica">{formatAngle(result.theoreticalSum, angleFormat)}</Row>
      <Row label="Error angular">{formatSeconds(error)}</Row>
      <Row label="Corrección por ángulo">{formatSeconds(perAngle, 2)}</Row>
    </dl>
  );
}
