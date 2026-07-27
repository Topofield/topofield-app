import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TopoField",
  description:
    "Plataforma para gestión de procesos topográficos: poligonales, nivelación y asentamientos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-CO"
      className={`h-full ${display.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
