import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad (hallazgo H-3 de `docs/auditoria-seguridad.md`).
 *
 * En producción no había ninguna: la app era enmarcable (clickjacking) y los
 * `.xlsx` de exportación quedaban expuestos a MIME-sniffing en clientes
 * antiguos. Se aplican a todas las rutas.
 */

/**
 * Content-Security-Policy.
 *
 * Lleva `'unsafe-inline'` en `script-src` y `style-src` a propósito: Next
 * inyecta el arranque de React y los estilos críticos en línea, y la app usa
 * `style={{…}}` en tres componentes. La alternativa —un nonce por petición—
 * obliga a generarlo en `src/proxy.ts`, propagarlo y volver dinámicas rutas
 * hoy estáticas; no compensa mientras no entre HTML de terceros. Queda
 * anotada como trabajo futuro en la doc técnica (§ 11).
 *
 * Lo que sí cierra esta política, y antes estaba abierto: `frame-ancestors`
 * (clickjacking, además de `X-Frame-Options` para clientes viejos),
 * `base-uri` (inyección de `<base>` para desviar rutas relativas),
 * `object-src` (plugins) y `form-action` (envío de formularios a un tercero).
 * `default-src 'self'` corta cualquier origen que no esté listado.
 *
 * `connect-src` abre `*.supabase.co` —API REST y Auth— y `wss:` hacia el
 * mismo dominio: hoy no se usa realtime, pero el cliente de Supabase abre el
 * socket en cuanto alguien llame a `.channel()`, y sin esto fallaría en
 * silencio. Las fuentes son de `next/font/google`, que las auto-aloja en el
 * build, así que `font-src 'self'` basta y no hace falta abrir Google.
 * `img-src` incluye `data:` y `blob:` por los PNG del manual y las gráficas.
 *
 * La descarga de los `.xlsx` no se ve afectada: es un `<a download>`, una
 * navegación normal, no una petición que la CSP filtre.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking: nadie puede enmarcar la app. Redundante con
  // `frame-ancestors`, se mantiene para clientes que no entiendan CSP.
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
