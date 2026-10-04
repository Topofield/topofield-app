import { ThemeSelect } from "@/components/design-system";
import type { ThemeChoice } from "@/lib/theme";

/** La primera letra o cifra del correo, en mayúscula, para el botón de cuenta. */
export function accountInitial(email: string): string {
  const match = email.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "?";
}

/**
 * Menú de cuenta de la barra (Fase 33): el correo, el tema y «Cerrar sesión»,
 * que antes iban sueltos en la cabecera.
 *
 * Sin JavaScript propio: el panel usa el atributo `popover` de HTML, que lo
 * abre y lo cierra con el botón, lo cierra al tocar fuera o con Esc y lo pinta
 * por encima de todo. Como el botón siempre está arriba a la derecha, el panel
 * se coloca con CSS justo debajo de la barra.
 */
export function AccountMenu({
  email,
  theme,
  signOut,
}: {
  email: string;
  theme: ThemeChoice;
  signOut: () => Promise<void>;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Cuenta"
        title={email}
        popoverTarget="cuenta"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-paper font-display text-sm font-semibold text-ink transition-colors hover:border-ink-2"
      >
        {accountInitial(email)}
      </button>
      <div
        id="cuenta"
        popover="auto"
        className="fixed inset-auto top-[calc(var(--barra-alto)+0.375rem)] right-3 m-0 w-64 rounded-lg border border-rule bg-card p-0 text-ink shadow-lg"
      >
        <div className="border-b border-rule px-4 py-3">
          <p className="text-xs text-ink-2">Sesión iniciada como</p>
          <p data-user-email className="truncate text-sm font-medium">
            {email}
          </p>
        </div>
        <div className="border-b border-rule px-4 py-3">
          <p className="mb-2 text-xs text-ink-2">Tema</p>
          <ThemeSelect initial={theme} />
        </div>
        <form action={signOut} className="p-2">
          <button
            type="submit"
            className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-sel"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );
}
