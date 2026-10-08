// Contenido del manual de usuario.
//
// Derivado de docs/manual/README.md, que es la fuente de la redacción. Al
// cambiar el texto aquí, refléjelo también allí — y viceversa. No hay
// generación automática entre los dos.
//
// Los datos viven separados de la maquetación (page.tsx) para que el texto se
// pueda revisar y comparar con el Markdown sin ruido de JSX.

/** Una captura de la aplicación real, generada por docs/manual/capturas.mjs. */
export interface Captura {
  /** Ruta servida desde public/. */
  src: string;
  /** Descripción para lectores de pantalla. Obligatoria: ninguna sin describir. */
  alt: string;
  /** Pie de foto visible. Opcional: solo cuando aporta algo que el alt no. */
  pie?: string;
  /** Dimensiones reales del PNG: reservan el espacio y evitan saltos de layout. */
  width: number;
  height: number;
  /** Captura de teléfono: no debe estirarse al ancho del contenedor. */
  angosta?: boolean;
}

export const CAPTURAS = {
  inicioSesion: {
    src: "/manual/01-inicio-sesion.png",
    alt: "Pantalla de inicio de sesión con los campos de correo y contraseña.",
    width: 2560,
    height: 1600,
  },
  dashboard: {
    src: "/manual/02-dashboard.png",
    alt: "Dashboard con los tres indicadores en la parte superior y las tarjetas de proyecto debajo.",
    width: 2560,
    height: 1600,
  },
  nuevoProyecto: {
    src: "/manual/03-nuevo-proyecto.png",
    alt: "Formulario de creación de proyecto: datos básicos, datum y proyección en una sola página, con el botón Crear proyecto.",
    width: 2560,
    height: 1664,
  },
  hubProyecto: {
    src: "/manual/04-hub-proyecto.png",
    alt: "Hub del proyecto: cabecera con el botón + Nuevo Proceso, las pestañas y el listado de poligonales, todas calculadas, con sus filtros —Todos, Borradores y Calculados— y sus acciones.",
    width: 2560,
    height: 2822,
  },
  configuracionProyecto: {
    src: "/manual/05-configuracion-proyecto.png",
    alt: "Pestaña de configuración del proyecto: la edición de datos, los puntos de referencia y la zona de peligro, con Archivar proyecto y Eliminar proyecto.",
    width: 2560,
    height: 3178,
  },
  nuevaPoligonal: {
    src: "/manual/06-nueva-poligonal.png",
    alt: "Popup Nueva poligonal: título, ubicación, responsable y su cargo, el tipo de poligonal con Cerrada elegida y la línea que explica cómo se verifica, el equipo plegado y opcional, la nota «El orden de precisión se detecta al ajustar» y el botón Crear y empezar.",
    width: 896,
    height: 1252,
  },
  datosPoligonal: {
    src: "/manual/07-datos-poligonal.png",
    alt: "Paso 1 · Datos de la poligonal V10, cartera TT4: la cabecera con Poligonal cerrada, Calculado y Tercer orden; los puntos de amarre —V10 con su Norte y su Este, y TT4 como 0° atrás con su azimut—; las mediciones «desde → hacia» con las marcas 0 atrás, cierre y cierre angular; el cierre angular, con los ángulos interiores detectados y un error de +12.0″, y a la derecha el dibujo sin ajustar.",
    width: 2560,
    height: 2736,
  },
  ordenAlcanzado: {
    src: "/manual/08-orden-alcanzado.png",
    alt: "Método de ajuste Brújula (Bowditch); las cuatro cifras —error angular +12.0″, error de cierre lineal 0.016 m, precisión relativa 1:7.045 y orden alcanzado Tercer orden— y «Por qué tercer orden» desplegado: cada orden con su tolerancia angular y su precisión mínima, y si la poligonal cumple cada una.",
    width: 1984,
    height: 838,
  },
  ajustePoligonal: {
    src: "/manual/09-ajuste-poligonal.png",
    alt: "Paso 2 · Ajuste de la cartera TT4: el selector de método con Brújula (Bowditch), las cuatro cifras con el orden alcanzado, la poligonal ajustada con la fila Σ, la corrección por método Brújula y, a la derecha, el dibujo ajustado con el botón Georreferenciar.",
    width: 2560,
    height: 2352,
  },
  correccionInforme: {
    src: "/manual/10-correccion-informe.png",
    alt: "Sección «3. Corrección por método Brújula (Bowditch)» del informe de la cartera TT4: el paso 1 reparte el error angular de 12.0″ entre los 7 ángulos, −1.71″ cada uno; el paso 2 reparte el error de cierre lineal en proporción a la longitud de cada lado, con sus fórmulas y la tabla de correcciones ΔN y ΔE por lado.",
    width: 1664,
    height: 1552,
  },
  nuevaNivelacion: {
    src: "/manual/11-nueva-nivelacion.png",
    alt: "Popup Nueva nivelación: el título, el tipo de recorrido con Abierta elegida y su dibujo, la casilla Con vuelta marcada, el BM de partida D1 con su cota 3288.5000, la ubicación, el responsable y el equipo plegados, la nota «El orden de precisión se detecta al compensar» y el botón Crear y empezar.",
    width: 896,
    height: 1308,
  },
  libretaNivelacion: {
    src: "/manual/12-libreta-nivelacion.png",
    alt: "Paso 1 · Libreta de El Verjón: la cabecera con Nivelación abierta con ida y vuelta, Calculado y Segundo orden; la tarjeta del BM de partida D1, 3288.5000 m; la tabla de la hoja de la ida —punto, V+, distancia, AI, V−, distancia, VI y cota— con los rótulos BM, intermedia y fin de la ida y un lápiz por fila; la comprobación aritmética, 26.583 m, cuadra, 384.3 m; y a la derecha el perfil de la ida con sus miras y visuales y la vuelta tenue.",
    width: 2560,
    height: 2274,
  },
  armadaNivelacion: {
    src: "/manual/32-armada-nivelacion.png",
    alt: "Popup Armada 2 · ida: el nivel entre C 1 y el punto siguiente; la vista atrás a C 1 con lectura 3.275 y distancia 28.1; la vista adelante a C 2 con lectura 0.224 y distancia 17.3, cada una con «+ Hilos superior e inferior (opcional)»; «+ Vista intermedia»; la altura del instrumento 3292.7160, la cota de C 2 3292.4920 y las dos distancias; y los botones Cancelar, Guardar y Guardar y seguir desde C 2.",
    width: 1344,
    height: 1536,
  },
  compensacionNivelacion: {
    src: "/manual/33-compensacion-nivelacion.png",
    alt: "Paso 2 · Compensación de El Verjón: corrección proporcional a la distancia; las cuatro cifras —discrepancia 5.0 mm, distancias 384.3 · 397.6 m, tolerancia de segundo orden 5.3 mm y Segundo orden— con «Por qué segundo orden» desplegado; la tabla de cotas compensadas y ajustadas con la cota de la ida y de la vuelta, su diferencia y las dos correcciones; el desnivel y la comprobación aritmética; y el gráfico de la ida, la vuelta y la ajustada con las diferencias ×1000.",
    width: 2560,
    height: 3842,
  },
  importarNivelacion: {
    src: "/manual/23-importar-nivelacion.png",
    alt: "Diálogo Importar libreta desde archivo con el crudo de un nivel digital Leica: 16 armadas, ida y vuelta con la vuelta en la armada 9, la elección de la cota del BM y la libreta de ida con los tipos de punto.",
    width: 1344,
    height: 2736,
  },
  nuevoLugar: {
    src: "/manual/13-nuevo-lugar.png",
    alt: "Popup Nuevo lugar: el nombre, el tipo de estructura con Edificio elegido y la nota de que precarga los umbrales, la descripción opcional, los umbrales del semáforo plegados con su resumen y el botón Crear lugar.",
    width: 896,
    height: 1172,
  },
  editorLugar: {
    src: "/manual/14-editor-lugar.png",
    alt: "Pestaña Puntos de Edificio Torre Central: el catálogo de puntos de control con su código, su ubicación, su cota C0 y su estado —vigente, dado de alta o de baja, con su motivo— y las acciones Editar, Dar de baja y Eliminar.",
    width: 2560,
    height: 1612,
  },
  panelAsentamientos: {
    src: "/manual/15-panel-asentamientos.png",
    alt: "Panel de la cartera real Control de asentamiento estructural: la franja de cinco indicadores, la tabla de las siete visitas con su promedio, su máximo, su mayor Δ y su alerta, al lado la tendencia del promedio con su banda y los umbrales, y los avisos de B10 en las visitas 3 y 4.",
    width: 2560,
    height: 2104,
  },
  nuevaVisita: {
    src: "/manual/25-nueva-visita.png",
    alt: "Popup Nueva visita de Torre Alameda: la fecha, el nivelador, la nota opcional, la nota de que la libreta llega armada como la de la visita anterior, el equipo plegado y opcional, y el botón Crear y empezar.",
    width: 896,
    height: 984,
  },
  importarLibretaVisita: {
    src: "/manual/26-importar-libreta-visita.png",
    alt: "Diálogo Importar la libreta de la visita con la plantilla CSV de la visita 12 de Torre Alameda: el formato, las armadas y visuales leídas, que sale de BM-1, el aviso de que la libreta de la visita se reemplazará y la libreta con los BM del lugar y los puntos de control marcados.",
    width: 1344,
    height: 2196,
  },
  vistaVisita: {
    src: "/manual/27-vista-visita.png",
    alt: "Paso 2 · Resultados de la visita 7 de la cartera real: la franja de indicadores —asentamiento máximo, promedio y su cambio frente a la visita 6, mayor movimiento y alerta—, la nota de la visita, la tabla de los dieciséis puntos con su cota, parcial, acumulado, velocidad, estado y tendencia, y al lado el gráfico Acumulado por punto.",
    width: 2560,
    height: 2556,
  },
  armadaVisita: {
    src: "/manual/34-armada-visita.png",
    alt: "Popup Armada 2 · visita 12 de Torre Alameda: la vista atrás desde CP-1, punto de cambio de la armada 1, con su lectura y su distancia opcional; las vistas a los puntos, cada una con su lectura, su cota y la marca de guardada; la vista adelante a BM-1 con el rótulo cierra en un BM; la altura del instrumento, el cierre de −1.6 mm y el orden alcanzado, segundo orden; y el pie con los puntos leídos y los botones Seguir después y Terminar armada.",
    width: 1344,
    height: 2496,
  },
  bmsLugar: {
    src: "/manual/35-bms-lugar.png",
    alt: "Pestaña BMs de Torre Alameda: los BM del lugar BM-1 y BM-2 con su cota, su descripción, su origen y en cuántas visitas arrancan un tramo, las acciones Editar y Eliminar, y los botones Importar BM y + BM.",
    width: 2560,
    height: 1600,
  },
  dibujoPoligonal: {
    src: "/manual/20-dibujo-poligonal.png",
    alt: "Dibujo de la poligonal V10 de la cartera TT4: la ajustada en trazo continuo y la sin compensar exagerada ×100 en trazo discontinuo, con el hueco de cierre junto al vértice V10.",
    width: 630,
    height: 728,
  },
  georreferenciar: {
    src: "/manual/22-georreferenciar.png",
    alt: "Diálogo Georreferenciar sobre la cartera Vivero en sistema local: D1 y D3 con sus coordenadas reales, rotación 35° 00′ 07.8″, factor de escala 1.000000 y la tabla de coordenadas actuales frente a reales.",
    width: 1344,
    height: 2036,
  },
  minimosCuadrados: {
    src: "/manual/21-minimos-cuadrados.png",
    alt: "Corrección por método Mínimos cuadrados de la cartera Vivero: la corrección de cada ángulo, en segundos, y de cada distancia, en milímetros, con la distancia ajustada —el ángulo de orientación en Famarena_5 no se corrige—, y σ₀ = 0.698 con su lectura.",
    width: 1216,
    height: 998,
  },
  precisionDeCadaPunto: {
    src: "/manual/36-precision-de-cada-punto.png",
    alt: "Precisión de cada punto de la cartera Vivero por mínimos cuadrados: σ N, σ E, los semiejes de la elipse al 95 % y el azimut del mayor de D1 a D4 —D1 con semieje menor 0, a lo largo del primer lado—, Famarena_5 fijo, y la nota con c = 4.37 y r = 3.",
    width: 1216,
    height: 862,
  },
  elipsesDeError: {
    src: "/manual/37-elipses-de-error.png",
    alt: "Dibujo de la cartera Vivero ajustada por mínimos cuadrados, con las elipses de error al 95 % en verde, exageradas ×500: plana en D1, a lo largo del primer lado, y mayor en D3.",
    width: 630,
    height: 768,
  },
  editorVisita: {
    src: "/manual/16-editor-visita.png",
    alt: "Paso 1 · Libreta de la visita 12 de Torre Alameda: la cabecera con 2 armadas, Segundo orden y Calculada; la tabla de la hoja con los rótulos BM del lugar, BM leído de paso, punto de cambio y cierra; y a la derecha las armadas, el tramo desde BM-1 que vuelve a BM-1 con su cierre y su orden, la comprobación de BM-2 y el movimiento de cada punto desde la visita anterior.",
    width: 2560,
    height: 2472,
  },
  temaOscuro: {
    src: "/manual/29-tema-oscuro.png",
    alt: "El panel de Torre Alameda en un teléfono con el tema oscuro: papel y tarjetas oscuras, y el menú de cuenta abierto, con Oscuro elegido entre Sistema, Claro y Oscuro.",
    pie: "El menú de cuenta elige el tema: aquí, Oscuro.",
    width: 780,
    height: 1688,
    angosta: true,
  },
  datosMovil: {
    src: "/manual/17-datos-movil.png",
    alt: "El paso de Datos de la cartera TT4 en un teléfono: la cabecera, los puntos de amarre, el selector Tabla | Dibujo con Tabla elegida, las mediciones con el azimut bajo cada punto y el cierre angular.",
    pie: "En el teléfono, el azimut va bajo cada punto: la tabla no se desplaza de lado.",
    width: 780,
    height: 3554,
    angosta: true,
  },
  equipos: {
    src: "/manual/31-equipos.png",
    alt: "Página Equipos: estaciones totales y niveles del catálogo, con su calibración —dos con el aviso de más de un año— y su precisión.",
    width: 2560,
    height: 1662,
  },
  informeDelProceso: {
    src: "/manual/30-informe-del-proceso.png",
    alt: "Paso 3 · Informe de la poligonal V10, cartera TT4: la cabecera con Exportar PDF y Exportar Excel; portada; resultado con el orden alcanzado, datos de campo, corrección por método Brújula (Bowditch), poligonal ajustada y coordenadas con el dibujo; resumen de precisión y observaciones.",
    width: 2560,
    height: 8412,
  },
} as const satisfies Record<string, Captura>;

/** Las secciones del manual, en el orden en que se leen. */
export interface SeccionManual {
  /** Ancla de la URL. Debe ser única: dos iguales navegan mal, en silencio. */
  id: string;
  /** Título visible y etiqueta en el índice. */
  titulo: string;
}

export const SECCIONES: SeccionManual[] = [
  { id: "conceptos", titulo: "Conceptos básicos" },
  { id: "acceso", titulo: "Entrar a la aplicación" },
  { id: "dashboard", titulo: "El dashboard" },
  { id: "proyectos", titulo: "Proyectos" },
  { id: "poligonales", titulo: "Poligonales" },
  { id: "nivelacion", titulo: "Nivelación" },
  { id: "asentamientos", titulo: "Control de Asentamientos" },
  { id: "cierre", titulo: "Sin cierre" },
  { id: "campo", titulo: "Trabajo en campo" },
  { id: "informes", titulo: "El informe de cada proceso" },
  { id: "export", titulo: "Exportar a Excel" },
  { id: "equipos", titulo: "El catálogo de equipos" },
  { id: "faq", titulo: "Preguntas frecuentes" },
];

// --- § 1 Conceptos básicos ---

export const ESTADOS_PROCESO = [
  { estado: "Borrador", significado: "Creado, sin datos suficientes" },
  {
    estado: "En progreso",
    significado:
      "Con datos de campo, aún sin cálculo completo. En una visita se dice En medición",
  },
  {
    estado: "Calculado",
    significado: "Cálculo resuelto, listo para revisar y para un informe",
  },
];

// --- § 5.5 Órdenes de precisión: el «Por qué» del orden alcanzado (la
// poligonal no lo declara: se detecta al calcularla, desde la Fase 35) ---

export const ORDENES_PRECISION = [
  {
    orden: "Primer orden",
    angular: "1″·√n",
    relativa: "1:100.000",
    uso: "Geodésico de alta precisión",
  },
  {
    orden: "Segundo orden",
    angular: "5″·√n",
    relativa: "1:20.000",
    uso: "Control urbano y catastral",
  },
  {
    orden: "Tercer orden",
    angular: "15″·√n",
    relativa: "1:5.000",
    uso: "Levantamiento topográfico común",
  },
  {
    orden: "Ordinario",
    angular: "30″·√n",
    relativa: "1:3.000",
    uso: "Levantamiento rural o reconocimiento",
  },
];

// --- § 4.3 Columnas del listado ---

export const COLUMNAS_LISTADO = [
  {
    columna: "Nombre",
    muestra: "Nombre y tipo (en asentamientos, el tipo de estructura y cuántas visitas tiene)",
  },
  {
    columna: "Estado",
    muestra: "Borrador, En progreso o Calculado. No aparece en asentamientos",
  },
  {
    columna: "Resultado",
    muestra:
      "La precisión relativa de una poligonal, el cierre de una nivelación (o su discrepancia, si es abierta con vuelta) o la alerta de un lugar",
  },
  {
    columna: "Cumple",
    muestra:
      "✓ si alcanza algún orden, ✕ si no, — si no aplica. No aparece en asentamientos",
  },
  { columna: "Última actividad", muestra: "Cuándo se modificó por última vez" },
];

// --- § 5.1 Tipos de poligonal ---

export const TIPOS_POLIGONAL = [
  {
    tipo: "Cerrada",
    descripcion: "Parte de un punto y regresa a él",
    verificacion: "Suma de ángulos + error de cierre lineal",
  },
  {
    tipo: "Abierta con control",
    descripcion: "Parte de un punto conocido y llega a otro conocido",
    verificacion: "Comparación contra las coordenadas del punto de llegada",
  },
  {
    tipo: "Abierta sin control",
    descripcion: "Parte de un punto conocido y no cierra",
    verificacion: "No tiene verificación de cierre",
  },
];

// --- § 5.5 Métodos de corrección ---

export const METODOS_CORRECCION = [
  {
    metodo: "Brújula (Bowditch)",
    reparte: "Proporcional a la longitud de cada lado. El más usado",
  },
  {
    metodo: "Tránsito",
    reparte:
      "Proporcional a las proyecciones. Útil si las distancias son menos fiables que los ángulos",
  },
  {
    metodo: "Crandall",
    reparte:
      "Mínimos cuadrados sobre las distancias, conservando los ángulos ajustados",
  },
  {
    metodo: "Mínimos cuadrados",
    reparte:
      "Ajusta a la vez ángulos y distancias según el peso que usted les da. Solo en cerrada y abierta con control",
  },
];

// --- § 6.1 Tipos de nivelación ---

export const TIPOS_NIVELACION = [
  {
    tipo: "Cerrada",
    descripcion: "Sale de un BM y vuelve a ese mismo BM",
    verificacion: "Error de cierre contra la cota de partida",
  },
  {
    tipo: "De enlace",
    descripcion: "Va de un BM conocido a otro BM conocido distinto",
    verificacion: "Error de cierre contra la cota de llegada",
  },
  {
    tipo: "Abierta",
    descripcion: "Termina en un punto sin cota conocida",
    verificacion: "Sin vuelta, ninguna; con vuelta, la discrepancia entre ida y vuelta",
  },
];

// --- § 6.3 Tipos de punto de nivelación ---

export const TIPOS_PUNTO_NIVELACION = [
  {
    tipo: "BM",
    hace: "Banco de nivel, de cota conocida. Ancla el recorrido",
    lecturas:
      "La primera fila solo lleva V+; la última, si es BM, solo lleva V−",
  },
  {
    tipo: "Punto de cambio",
    hace: "Transmite la cota de una armada a la siguiente",
    lecturas: "V+ y V− (salvo en los extremos)",
  },
  {
    tipo: "Intermedio (radiación)",
    hace: "Solo se lee para conocer su cota, sin continuar el recorrido a través de él",
    lecturas: "Solo V−",
  },
];

// --- § 6.7 Tolerancia K·√D de nivelación ---

export const TOLERANCIA_NIVELACION = [
  { orden: "Primer orden", k: "3" },
  { orden: "Segundo orden", k: "6" },
  { orden: "Tercer orden", k: "12" },
  { orden: "Ordinario", k: "24" },
];

// --- § 7.9 Verificación de un tramo de la visita ---

export const VERIFICACION_TRAMO = [
  {
    tramo: "Vuelve a su BM",
    dice: "Su cierre, en mm, y el orden alcanzado, con su tolerancia",
  },
  {
    tramo: "Llega a otro BM del lugar",
    dice: "Su llegada, en mm, y el orden alcanzado",
  },
  {
    tramo: "Termina en sus puntos",
    dice: "Sin verificación: no termina en un BM del lugar",
  },
  {
    tramo: "No tiene distancias",
    dice: "Sin distancias: el cierre no da orden",
  },
  {
    tramo: "Supera la tolerancia de todos los órdenes",
    dice: "Fuera de los órdenes: queda sin verificación",
  },
];

// --- § 7.11 Indicadores del panel del lugar ---

export const INDICADORES_LUGAR = [
  {
    indicador: "Asentamiento máximo",
    muestra:
      "El acumulado de mayor magnitud en la última visita, con su punto. Un levantamiento también cuenta",
  },
  {
    indicador: "Promedio actual",
    muestra: "El promedio encadenado de la última visita (ver abajo)",
  },
  {
    indicador: "Velocidad máxima",
    muestra: "La de mayor magnitud en la última visita, en mm/mes, con su punto",
  },
  {
    indicador: "Visitas en alerta",
    muestra: "Cuántas visitas, de todas, tienen algún punto en precaución o más",
  },
  {
    indicador: "Umbrales",
    muestra: "Los tres de acumulado, en mm, y los tres de velocidad, en mm/mes",
  },
];

// --- § 7.11 Niveles del semáforo de asentamientos ---

export const NIVELES_SEMAFORO = [
  {
    nivel: "Normal",
    significado: "Dentro de todos los umbrales",
    forma: "● círculo",
  },
  {
    nivel: "Precaución",
    significado: "Supera el primer umbral; vigile la tendencia",
    forma: "■ cuadrado",
  },
  {
    nivel: "Alerta",
    significado: "Supera el segundo umbral; revise el punto",
    forma: "◆ rombo",
  },
  {
    nivel: "Alarma",
    significado: "Supera el umbral más alto; requiere atención inmediata",
    forma: "▲ triángulo",
  },
];

// --- § 11 Exportar a Excel ---

/** Una hoja del libro de Excel de un módulo. */
export interface HojaExcel {
  hoja: string;
  contiene: string;
}

/** Las hojas del libro de Excel de cada módulo (Fase 38). */
export const HOJAS_EXCEL: Record<"nivelacion" | "poligonal" | "asentamientos", HojaExcel[]> = {
  nivelacion: [
    {
      hoja: "Nivelación",
      contiene:
        "La ida: PUNTO · TIPO · V+ · AI · V− · VI · COTA · DIST. V+ (m) · DIST. V− (m) · ACUM. (km) · CORRECCIÓN (m) · COTA AJUSTADA · CLAVE, y debajo el bloque «Cierre»",
    },
    {
      hoja: "Contranivelación",
      contiene: "La vuelta, si la hay, con la misma forma",
    },
    {
      hoja: "Cotas ajustadas",
      contiene:
        "Solo si la nivelación se compensó: una fila por punto, con la cota conocida en los BM y, en los demás, el promedio de sus cotas ajustadas en la ida y en la vuelta",
    },
    {
      hoja: "Resumen",
      contiene: "Los datos del proyecto y del proceso, el equipo y las notas",
    },
  ],
  poligonal: [
    {
      hoja: "BRÚJULA, TRÁNSITO, CRANDALL o MÍNIMOS CUADRADOS",
      contiene:
        "Una sola, con el nombre del método —ABIERTA SIN CONTROL en una abierta sin control—: la tabla de la poligonal, con su fila SUMATORIA, y debajo los bloques de cierre",
    },
    {
      hoja: "Resumen",
      contiene: "Los datos del proyecto y del proceso, el equipo y las notas",
    },
  ],
  asentamientos: [
    {
      hoja: "Libretas",
      contiene:
        "Un bloque por visita, con su título —«Visita N · fecha»—, el nivelador, el equipo y la nota, y las columnas PUNTO · V+ · AI · V− · VI · COTA · DIST. V+ (m) · DIST. V− (m)",
    },
    {
      hoja: "Comparación",
      contiene:
        "La «Diferencia observada» de la cartera: arriba, los umbrales del lugar; una fila por punto de control —PUNTO, UBICACIÓN y C0— y, por cada visita, COTA · ACUM. (mm) · PARCIAL (mm) · VEL. (mm/mes) · SEMÁFORO; al pie, «Avisos de tendencia»",
    },
    {
      hoja: "Resumen",
      contiene: "Los datos del proyecto, el lugar y sus BM",
    },
  ],
};

// --- § 13 Preguntas frecuentes ---

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

export const PREGUNTAS: Pregunta[] = [
  {
    pregunta: "La aplicación se ve oscura (o clara). ¿Cómo la cambio?",
    respuesta:
      "En el menú de cuenta —el círculo con su inicial, arriba a la derecha—: Sistema, Claro u Oscuro (§ 2). Con Sistema, sigue la configuración del teléfono o del computador.",
  },
  {
    pregunta: "¿Cómo cierro un proceso?",
    respuesta:
      "No se cierra (§ 8): ni la poligonal, ni la nivelación, ni el lugar o la visita de asentamientos. Quedan calculados y se corrigen cuando haga falta. El paso de Ajuste o de Compensación, la verificación de cada visita y su informe dicen qué orden de precisión alcanzaron (§ 5.5, § 6.7 y § 7.9); si no alcanzan ninguno, el informe lo alerta.",
  },
  {
    pregunta: "¿Dónde exporto el PDF o el Excel de un proceso?",
    respuesta:
      "En su página de informe: el paso Informe de la poligonal o de la nivelación, o la pestaña Informe del lugar de asentamientos. Allí la cabecera trae Exportar PDF y Exportar Excel (§ 10 y § 11); los demás pasos y pestañas no exportan.",
  },
  {
    pregunta: "¿Por qué una poligonal muestra «Sin verificación de cierre»?",
    respuesta:
      "Es de tipo abierta sin control: no regresa al punto de partida ni llega a un punto conocido, así que no hay nada contra qué contrastar el resultado. Las coordenadas se calculan, pero su exactitud no se puede verificar.",
  },
  {
    pregunta: "¿Qué significa una precisión de 1:∞?",
    respuesta:
      "Que el cierre fue exacto: el error lineal es cero o despreciable. Ocurre con datos teóricos o levantamientos muy precisos.",
  },
  {
    pregunta: "¿Dónde declaro el equipo y el orden de precisión que usé?",
    respuesta:
      "El equipo, en cada proceso y no en el proyecto: una poligonal o una nivelación lo declara en su alta, y cada visita de asentamiento en la suya. El orden no se declara en ninguno: se detecta al calcular (§ 5.5, § 6.7 y § 7.9). Si el equipo es el de siempre, tómelo del catálogo de equipos (§ 12).",
  },
  {
    pregunta: "Mi nivelación no alcanza ningún orden. ¿Por qué se compensó?",
    respuesta:
      "Porque la nivelación compensa siempre que haya contra qué cerrar, y avisa: en la práctica, un trabajo fuera de tolerancia se repite (§ 6.7). Una visita de asentamientos, en cambio, no compensa nunca: su cierre solo comprueba (§ 7.9).",
  },
  {
    pregunta:
      "Levanté una poligonal en un sistema local. ¿Puedo pasarla a coordenadas reales?",
    respuesta:
      "Sí: Georreferenciar (§ 5.6), con dos estaciones de coordenadas conocidas, o editando el amarre con las coordenadas reales de la partida y la referencia. El orden alcanzado no cambia.",
  },
  {
    pregunta: "¿La aplicación juzga si mi equipo da para el orden que necesito?",
    respuesta:
      "No: registra el equipo para el informe. Lo que dice si el trabajo cumple es su cierre contra la tolerancia de cada orden: ningún proceso elige orden, alcanza el que su cierre permite. Si el equipo no da para el orden que necesita, lo más probable es que el cierre no lo alcance.",
  },
  {
    pregunta:
      "Mi nivelación cuadra en la comprobación aritmética. ¿Ya sé que la medición está bien?",
    respuesta:
      "No. La comprobación aritmética (ΣV+ − ΣV− = desnivel total) solo valida que las cuentas de gabinete están bien hechas: cuadra igual con un nivel descolimado. La calidad de la medición la juzga el error de cierre contra la tolerancia K·√D, en el paso de Compensación (§ 6.7).",
  },
  {
    pregunta: "¿Por qué mi nivelación dice «Sin compensación todavía»?",
    respuesta:
      "Porque la libreta no ha llegado a su BM: falta marcar la casilla de fin en la última armada —«Llega al BM», «Llega a …» o «Fin de la ida»—, o terminar la vuelta. El paso de Compensación dice qué falta (§ 6.7).",
  },
  {
    pregunta: "Un punto quedó en alarma. ¿Puedo seguir midiendo?",
    respuesta:
      "Sí. El semáforo es un diagnóstico, no un bloqueo: un punto en alerta o alarma se guarda igual que cualquier otro. Es justamente el dato que el control de asentamientos busca detectar y dejar documentado.",
  },
  {
    pregunta: "Un tramo de mi visita no alcanza ningún orden. ¿Qué pasa?",
    respuesta:
      "Nada se bloquea: la visita queda calculada con las cotas de la medida, y el tramo y la visita dicen Sin verificación (§ 7.9). Conviene revisar la libreta o repetir la nivelación.",
  },
  {
    pregunta: "¿Por qué no puedo teclear la cota de un punto en la visita?",
    respuesta:
      "Porque toda visita se mide con libreta: la cota sale de la lectura del punto, AI − lectura (§ 7.9). Si nivelaron con un nivel digital, importe su archivo .L o la plantilla CSV (§ 7.8).",
  },
  {
    pregunta: "La medición de una visita quedó a medias. ¿Perdí algo?",
    respuesta:
      "No: cada lectura se guarda al escribirla. La visita queda En medición, y Retomar medición abre la armada en la primera lectura que falta (§ 7.6).",
  },
  {
    pregunta:
      "¿Por qué la velocidad de dos visitas mensuales no me da el mismo número?",
    respuesta:
      "Porque se calcula con los días reales entre las dos fechas, no con «un mes» fijo. Un intervalo de 28 días y uno de 31 producen velocidades distintas aunque el asentamiento parcial fuera idéntico.",
  },
  {
    pregunta: "¿Puedo eliminar un proyecto?",
    respuesta:
      "Sí, desde Configuración: se borra con todo lo que contiene, de forma permanente. Para ocultarlo de la lista activa sin borrarlo, archívelo (§ 4.2).",
  },
  {
    pregunta: "Salí de una pantalla y perdí lo que había tecleado.",
    respuesta:
      "Ninguna pantalla de proceso tiene botón Guardar: la poligonal y la nivelación guardan cada popup al confirmar, y la visita de asentamientos cada lectura al salir del campo o con Enter (§ 4.4). Solo se pierde lo tecleado en un popup que se cierra sin confirmar.",
  },
  {
    pregunta: "¿Otros usuarios pueden ver mis proyectos?",
    respuesta:
      "No. Cada usuario accede solo a los suyos; la restricción se aplica en la base de datos.",
  },
];
