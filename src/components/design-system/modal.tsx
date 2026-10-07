"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Acciones del pie (p. ej. botones Cancelar / Confirmar). */
  footer?: ReactNode;
  /** «lg» para diálogos con tablas; por defecto, el ancho de un formulario. */
  size?: "md" | "lg";
  /**
   * En el teléfono ocupa la pantalla, con el pie fijo abajo (Fase 37, la
   * armada en campo). Desde `sm`, como «lg».
   */
  fullOnPhone?: boolean;
}

export function Modal({ open, onClose, title, children, footer, size = "md", fullOnPhone = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // En un portal sobre <body> (Fase 33): un antecesor con su propio contexto
  // de apilamiento —la barra de acciones, `sticky z-20`— dejaba el diálogo de
  // cierre por debajo de la barra superior fija, y sus enlaces se podían
  // pulsar con el diálogo abierto. Ningún diálogo se abre en el servidor.
  return createPortal(
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center", fullOnPhone ? "sm:px-4" : "px-4")}>
      {/* Backdrop como <button> para que el cierre por clic sea accesible. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // Todos limitan su alto: un formulario que crece —el equipo de la
          // poligonal al desplegarse— se salía por arriba y por abajo de la
          // pantalla, sin desplazar, y el pie con sus botones quedaba fuera.
          // En el teléfono, el de la armada ocupa la pantalla (Fase 37).
          "relative flex w-full flex-col border-rule bg-card shadow-lg",
          fullOnPhone
            ? "h-dvh rounded-none border-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-lg sm:border"
            : cn("max-h-[calc(100dvh-2rem)] rounded-lg border", size === "lg" ? "max-w-2xl" : "max-w-md"),
        )}
      >
        <header className="border-b border-rule px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        {/* El cuerpo desplaza si no cabe: cabecera y pie quedan a la vista. */}
        <div className={cn("overflow-y-auto px-6 py-4", fullOnPhone && "flex-1 px-4 sm:flex-initial sm:px-6")}>
          {children}
        </div>
        {footer && (
          <footer className={cn("flex justify-end gap-2 border-t border-rule px-6 py-4", fullOnPhone && "px-4 sm:px-6")}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
