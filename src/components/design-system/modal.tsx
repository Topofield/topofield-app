"use client";

import { useEffect, type ReactNode } from "react";
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

  return (
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
          "relative w-full rounded-lg border border-rule bg-card shadow-lg",
          // Solo el grande limita su alto y desplaza el cuerpo: los diálogos
          // de formulario quedan como estaban, sin recortar nada.
          size === "lg" ? "flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col" : "max-w-md",
        )}
      >
        <header className="border-b border-rule px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        {/* En el grande, el cuerpo desplaza si no cabe: cabecera y pie quedan a la vista. */}
        <div className={cn("px-6 py-4", size === "lg" && "overflow-y-auto")}>{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-rule px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
