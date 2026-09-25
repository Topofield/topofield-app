import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import { themeAttribute } from "@/lib/theme";
import { readThemeChoice } from "@/lib/theme-server";
import "./globals.css";

// La identidad del prototipo de asentamientos (Fase 20): Barlow para el
// cuerpo y Barlow Semi Condensed para los títulos. `next/font` las auto-aloja
// en el build, así que la CSP (`font-src 'self'`) no cambia. El 700 se carga
// porque la app usa `font-bold`; sin él, el navegador lo sintetizaría.
const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-src",
  display: "swap",
});

const display = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TopoField",
  description:
    "Plataforma para gestión de procesos topográficos: poligonales, nivelación y asentamientos.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El tema elegido llega en una cookie: con él en `<html>` desde el servidor,
  // la página se pinta ya con el tema correcto. Sin cookie no hay atributo y
  // decide el sistema operativo.
  const theme = themeAttribute(await readThemeChoice());
  return (
    <html
      lang="es-CO"
      data-theme={theme}
      className={`h-full ${sans.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
