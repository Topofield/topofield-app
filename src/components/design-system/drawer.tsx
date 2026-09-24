"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";
import { buttonClasses } from "./button";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Subtítulo bajo el título; también lo anuncia el lector de pantalla. */
  description?: string;
  children: ReactNode;
  /** Acciones del pie (p. ej. botones Cancelar / Guardar). */
  footer?: ReactNode;
  /** «md» para formularios; por defecto, «lg» para tablas y gráficas. */
  size?: "md" | "lg";
}

/** Lo que puede recibir foco con Tab dentro del panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Separado del de Escape: si dependiera de `onClose`, un padre que lo
  // recrea en cada render devolvería el foco y lo volvería a robar.
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      // El foco vuelve a quien abrió el panel (p. ej. la fila de la tabla).
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // aria-modal promete que el foco no sale del panel: Tab da la vuelta.
  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    const first = focusables[0];
    const last = focusables.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Cerrado no se monta: nada del panel queda en el orden de tabulación.
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Fondo como <button> para que el cierre por clic sea accesible. Fuera
          del orden de Tab: con teclado se cierra con Esc o con «Cerrar». */}
      <button
        type="button"
        aria-label="Cerrar panel"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-900/50 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={trapTab}
        className={cn(
          // `starting:` (@starting-style) anima la entrada sin estado extra;
          // la salida es inmediata porque el panel se desmonta al cerrar.
          "absolute top-0 right-0 flex h-dvh w-full flex-col border-l border-neutral-200 bg-white pr-[env(safe-area-inset-right)] shadow-lg transition-transform duration-200 ease-out starting:translate-x-full motion-reduce:transition-none",
          size === "lg" ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-neutral-500">
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "shrink-0" })}
          >
            Cerrar
          </button>
        </header>
        {/* El cuerpo desplaza por su cuenta: cabecera y pie quedan a la vista. */}
        <div
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6",
            footer ? "pb-4" : "pb-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
