"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/design-system";

interface AnchorInfo {
  /** `href` absoluto, tal como lo resuelve el navegador. */
  href: string;
  target: string;
  hasDownload: boolean;
  /** El enlace (o un ancestro) lleva `data-unsaved-guard-skip`. */
  skip: boolean;
}

interface ClickInfo {
  button: number;
  /** Ctrl, Cmd, Mayús o Alt: abre en otra pestaña o ventana. */
  modified: boolean;
}

interface Location {
  origin: string;
  pathname: string;
  search: string;
}

/**
 * Destino que la guarda debe detener, o `null` si el clic no saca de la
 * página. No se detienen: los clics que abren otra pestaña, las descargas
 * (Exportar a Excel), los enlaces externos y los que solo cambian el ancla.
 * Función pura.
 */
export function guardedHref(
  anchor: AnchorInfo,
  click: ClickInfo,
  current: Location,
): string | null {
  if (click.button !== 0 || click.modified) return null;
  if (anchor.skip || anchor.hasDownload) return null;
  if (anchor.target !== "" && anchor.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(anchor.href, current.origin);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Guarda de cambios sin guardar (Fase 22). Con `dirty`:
 *
 * - al recargar o cerrar la pestaña, el navegador pregunta con su diálogo
 *   propio (`beforeunload`; su texto no se puede cambiar);
 * - al pulsar un enlace interno —migas, pestañas, cabecera—, se detiene la
 *   navegación y se pregunta aquí.
 *
 * El clic se intercepta en fase de captura en `document`, antes de que llegue
 * al manejador de `next/link` en la raíz de React. Los botones atrás y
 * adelante del navegador no pasan por aquí: el App Router no ofrece cómo
 * detenerlos.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Algunos navegadores aún exigen `returnValue` para mostrar el diálogo.
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = guardedHref(
        {
          href: anchor.href,
          target: anchor.target,
          hasDownload: anchor.hasAttribute("download"),
          skip: anchor.closest("[data-unsaved-guard-skip]") !== null,
        },
        {
          button: event.button,
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        window.location,
      );
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(href);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const leave = () => {
    const href = pending;
    setPending(null);
    if (href) router.push(href);
  };

  return (
    <Modal
      open={pending !== null}
      onClose={() => setPending(null)}
      title="Tienes cambios sin guardar"
      footer={
        <>
          <Button variant="secondary" onClick={() => setPending(null)}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={leave}>
            Salir sin guardar
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        Si sales ahora, se pierden los cambios que no has guardado.
      </p>
    </Modal>
  );
}
