import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopoField",
  description:
    "Plataforma para gestión de procesos topográficos: poligonales, nivelación y asentamientos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
