"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Equipment } from "@/types/equipment";

interface EquipmentCatalogValue {
  equipment: Equipment[];
  /** Hoy en Bogotá, `YYYY-MM-DD`, calculado en el servidor. */
  today: string;
}

const EquipmentCatalogContext = createContext<EquipmentCatalogValue>({
  equipment: [],
  today: "",
});

/**
 * El catálogo de equipos del usuario para los formularios de equipo (Fase
 * 25). Lo carga una vez el layout de las pantallas autenticadas, en vez de
 * pasarlo por seis páginas y dos componentes de configuración; las acciones
 * del catálogo revalidan el layout, así que no queda viejo. Fuera de él
 * (la galería del sistema de diseño) el catálogo está vacío.
 */
export function EquipmentCatalogProvider({
  equipment,
  today,
  children,
}: EquipmentCatalogValue & { children: ReactNode }) {
  return (
    <EquipmentCatalogContext.Provider value={{ equipment, today }}>
      {children}
    </EquipmentCatalogContext.Provider>
  );
}

export function useEquipmentCatalog(): EquipmentCatalogValue {
  return useContext(EquipmentCatalogContext);
}
