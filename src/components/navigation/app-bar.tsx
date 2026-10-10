import Link from "next/link";
import { Logo, LogoMark } from "@/components/design-system";
import type { ThemeChoice } from "@/lib/theme";
import { AccountMenu } from "./account-menu";
import { AppBarLink } from "./app-bar-link";

/**
 * Barra superior de las pantallas autenticadas (Fase 33): fija arriba, de
 * `--barra-alto` (48 px) y a todo el ancho de la ventana. A la izquierda el
 * logo, que lleva al dashboard; a la derecha el Manual y el menú de cuenta
 * (Equipos salió con el catálogo en la Fase 44). El hueco del centro es para
 * la ruta de la página.
 *
 * Fija porque es la navegación: la ruta, el manual y la cuenta tienen que
 * estar a mano también al final de una libreta larga. Hasta la Fase 33 medía
 * 61 px y se iba con el scroll.
 */
export function AppBar({
  email,
  theme,
  signOut,
}: {
  email: string;
  theme: ThemeChoice;
  signOut: () => Promise<void>;
}) {
  return (
    // El alto va en el <header>, con el borde dentro (border-box): la barra
    // mide 48 px justos, y el título de la página empieza en 72.
    <header className="sticky top-0 z-40 h-(--barra-alto) border-b border-rule bg-card/90 backdrop-blur-md">
      <div className="flex h-full items-center gap-3 px-4">
        {/* En el teléfono, solo el isotipo, como desde la Fase 25. */}
        <Link
          href="/dashboard"
          aria-label="TopoField — ir al dashboard"
          className="shrink-0 rounded-md transition-opacity hover:opacity-80"
        >
          <LogoMark className="h-6 w-6 text-mira-strong sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </Link>
        <div className="min-w-0 flex-1" />
        <nav aria-label="Aplicación" className="flex items-center gap-0.5">
          {/* Visible también en el teléfono: la ayuda hace falta sobre todo en
              campo. */}
          <AppBarLink href="/manual" icon={<BookIcon />} label="Manual" />
        </nav>
        <AccountMenu email={email} theme={theme} signOut={signOut} />
      </div>
    </header>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Un libro abierto: el manual. */
function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 6.5C10.5 5.2 8.3 4.5 4 4.5v13c4.3 0 6.5.7 8 2 1.5-1.3 3.7-2 8-2v-13c-4.3 0-6.5.7-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}
