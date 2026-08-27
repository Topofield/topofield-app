import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad (hallazgo H-3 de `docs/auditoria-seguridad.md`).
 *
 * En producción no había ninguna: la app era enmarcable (clickjacking) y los
 * `.xlsx` de exportación quedaban expuestos a MIME-sniffing en clientes
 * antiguos. Se aplican a todas las rutas.
 *
 * La CSP se deja fuera a propósito y queda pendiente de decisión: la app usa
 * `style={{…}}` en tres componentes y Next inyecta estilos y scripts en línea,
 * así que una CSP estricta exige `'unsafe-inline'` en `style-src` o un nonce
 * por petición, y hay que verificar que no rompe el visor de Excel ni los
 * estilos. Mientras tanto, `frame-ancestors` queda cubierto por
 * `X-Frame-Options: DENY`.
 */
const securityHeaders = [
  // Clickjacking: nadie puede enmarcar la app.
  { key: "X-Frame-Options", value: "DENY" },
  // MIME-sniffing: relevante para los .xlsx que sirven las rutas de export.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la ruta completa (lleva ids de proyecto y proceso) a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni geolocalización.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // No anunciar el framework ni su presencia (`x-powered-by: Next.js`).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
