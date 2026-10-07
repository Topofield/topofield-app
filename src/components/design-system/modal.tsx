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
  const scrolls = size === "lg" || fullOnPhone;
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
          "relative w-full rounded-lg border border-rule bg-card shadow-lg",
          // Solo el grande limita su alto y desplaza el cuerpo: los diálogos
          // de formulario quedan como estaban, sin recortar nada.
          fullOnPhone
            ? "flex h-dvh flex-col rounded-none border-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-lg sm:border"
            : size === "lg"
              ? "flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col"
              : "max-w-md",
        )}
      >
        <header className="border-b border-rule px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        {/* En el grande, el cuerpo desplaza si no cabe: cabecera y pie quedan a la vista. */}
        <div className={cn("px-6 py-4", scrolls && "overflow-y-auto", fullOnPhone && "flex-1 px-4 sm:flex-initial sm:px-6")}>
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
