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
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
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
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border border-rule bg-card shadow-lg",
          size === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <header className="border-b border-rule px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        {/* El cuerpo desplaza si no cabe: cabecera y pie quedan a la vista. */}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-rule px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
