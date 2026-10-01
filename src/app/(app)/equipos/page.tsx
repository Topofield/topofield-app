import { PageHeader } from "@/components/design-system";
import { EquipmentCatalog } from "@/components/equipment/equipment-catalog";
import { createClient } from "@/lib/supabase/server";
import { getEquipment } from "@/lib/supabase/queries";
import { todayInBogota } from "@/lib/utils/format";

/**
 * El catálogo de equipos del usuario (Fase 25): estaciones totales y niveles
 * que se eligen en los formularios de cada proceso.
 */
export default async function EquipmentPage() {
  const supabase = await createClient();
  const equipment = await getEquipment(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Equipos" }]}
        title="Equipos"
        subtitle="Sus estaciones totales y niveles. Elija uno en cada proceso y sus datos se copian al formulario; corregir el catálogo no cambia lo ya medido."
      />
      <EquipmentCatalog equipment={equipment} today={todayInBogota()} />
    </div>
  );
}
