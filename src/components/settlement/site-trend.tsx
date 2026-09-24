"use client";

import { useRouter } from "next/navigation";
import {
  TrendChart,
  type ChartThresholds,
  type TrendVisit,
} from "@/components/settlement/charts/trend-chart";

/**
 * La tendencia del panel del lugar, con la navegación: un clic en una visita
 * la abre. Existe porque la página es un Server Component y no puede pasar
 * una función a la gráfica.
 */
export function SiteTrend({
  visits,
  thresholds,
  hrefBase,
}: {
  visits: TrendVisit[];
  thresholds: ChartThresholds;
  hrefBase: string;
}) {
  const router = useRouter();
  return (
    <TrendChart
      visits={visits}
      thresholds={thresholds}
      onSelectVisit={(visitId) => router.push(`${hrefBase}/${visitId}`)}
    />
  );
}
