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
        className="absolute inset-0 cursor-default bg-neutral-900/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border border-neutral-200 bg-white shadow-lg",
          size === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <header className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        {/* El cuerpo desplaza si no cabe: cabecera y pie quedan a la vista. */}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-neutral-100 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
