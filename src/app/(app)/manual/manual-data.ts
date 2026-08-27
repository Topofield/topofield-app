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
    alt: "Formulario de creación de proyecto, en su primer paso de datos básicos.",
    width: 2560,
    height: 1600,
  },
  hubProyecto: {
    src: "/manual/04-hub-proyecto.png",
    alt: "Hub del proyecto: ficha de datos arriba y la pestaña de procesos con su listado.",
    width: 2560,
    height: 2618,
  },
  configuracionProyecto: {
    src: "/manual/05-configuracion-proyecto.png",
    alt: "Pestaña de configuración del proyecto, con la edición de datos y los puntos de referencia.",
    width: 2560,
    height: 4338,
  },
  nuevaPoligonal: {
    src: "/manual/06-nueva-poligonal.png",
    alt: "Formulario de nueva poligonal, con el tipo y el punto de partida.",
    width: 2560,
    height: 1600,
  },
  editor: {
    src: "/manual/07-editor-no-cumple.png",
    alt: "Editor de poligonal completo: veredicto, configuración, tabla de estaciones y resultados.",
    pie: "El editor de una poligonal que no alcanza la precisión exigida.",
    width: 2560,
    height: 2980,
  },
  veredicto: {
    src: "/manual/08-veredicto.png",
    alt: "Banda del veredicto de cierre, con la precisión alcanzada frente a la requerida.",
    width: 1984,
    height: 262,
  },
  procesoCerrado: {
    src: "/manual/09-proceso-cerrado.png",
    alt: "Editor de un proceso cerrado, en solo lectura y sin botones de guardado.",
    width: 2560,
    height: 2904,
  },
  procesoRechazado: {
    src: "/manual/10-proceso-rechazado.png",
    alt: "Editor de un proceso rechazado, también en solo lectura.",
    width: 2560,
    height: 2904,
  },
  nuevaNivelacion: {
    src: "/manual/11-nueva-nivelacion.png",
    alt: "Formulario de nuevo proceso de nivelación, con el tipo y el BM de partida.",
    width: 2560,
    height: 1600,
  },
  editorNivelacion: {
    src: "/manual/12-editor-nivelacion.png",
    alt: "Editor de nivelación completo: libreta, comprobación aritmética, cierre y cotas corregidas.",
    pie: "Circuito cerrado que cumple la tolerancia: el BM final corrige exacto a su cota conocida.",
    width: 2560,
    height: 2774,
  },
  nuevoLugar: {
    src: "/manual/13-nuevo-lugar.png",
    alt: "Formulario de nuevo lugar, con el tipo de estructura y los umbrales de alerta.",
    width: 2560,
    height: 1600,
  },
  editorLugar: {
    src: "/manual/14-editor-lugar.png",
    alt: "Editor del lugar: datos generales, umbrales y catálogo de puntos de control.",
    width: 2560,
    height: 2916,
  },
  panelAsentamientos: {
    src: "/manual/15-panel-asentamientos.png",
    alt: "Panel de análisis: lista de visitas, semáforo por punto, diferenciales y gráfica de evolución.",
    width: 2560,
    height: 4958,
  },
  editorVisita: {
    src: "/manual/16-editor-visita.png",
    alt: "Editor de visita con la tabla de lecturas y el cálculo en vivo de parcial, acumulado, velocidad y semáforo.",
    width: 2560,
    height: 2184,
  },
  nuevoInforme: {
    src: "/manual/18-nuevo-informe.png",
    alt: "Formulario de alta de informe con el título, la lista de procesos cerrados a incluir y el orden de las secciones.",
    width: 2560,
    height: 1600,
  },
  informeImprimible: {
    src: "/manual/19-informe-imprimible.png",
    alt: "Informe maquetado para imprimir: portada con los datos del proyecto, índice, sección del proceso con sus resultados, resumen consolidado y registro de cierre.",
    width: 2560,
    height: 3460,
  },
  editorMovil: {
    src: "/manual/17-editor-movil.png",
    alt: "El editor en un teléfono: la tabla de estaciones se convierte en tarjetas apiladas.",
    pie: "En pantalla pequeña cada estación es una tarjeta, sin desplazamiento lateral.",
    width: 780,
    height: 5242,
    angosta: true,
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
  { id: "cierre", titulo: "Cerrar un proceso" },
  { id: "campo", titulo: "Trabajo en campo" },
  { id: "informes", titulo: "Informes" },
  { id: "export", titulo: "Exportar a Excel" },
  { id: "faq", titulo: "Preguntas frecuentes" },
];

// --- § 1 Conceptos básicos ---

export const ESTADOS_PROCESO = [
  { estado: "Borrador", significado: "Creado, sin datos suficientes" },
  {
    estado: "En progreso",
    significado: "Con datos de campo, aún sin cálculo completo",
  },
  {
    estado: "Calculado",
    significado: "Cálculo resuelto; se puede revisar y cerrar",
  },
  { estado: "Cerrado", significado: "Terminado y conforme. Inmutable" },
  {
    estado: "Rechazado",
    significado: "Terminado pero fuera de tolerancia. Inmutable",
  },
];

// --- § 4.1 Órdenes de precisión ---

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
  { columna: "Proceso", muestra: "Nombre y tipo de poligonal" },
  { columna: "Estado", muestra: "Borrador, Calculado, Cerrado o Rechazado" },
  { columna: "Precisión", muestra: "La precisión relativa alcanzada" },
  {
    columna: "Cumple",
    muestra: "✓ si alcanza el orden del proyecto, ✕ si no, — si no aplica",
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

// --- § 5.3 Métodos de corrección ---

export const METODOS_CORRECCION = [
  {
    metodo: "Bowditch (brújula)",
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
    tipo: "Abierta sin control",
    descripcion: "No cierra contra ningún BM",
    verificacion: "No tiene verificación de cierre",
  },
];

// --- § 6.3 Tipos de punto de nivelación ---

export const TIPOS_PUNTO_NIVELACION = [
  {
    tipo: "BM",
    hace: "Banco de nivel, de cota conocida. Ancla el recorrido",
    lecturas:
      "La primera fila solo lleva atrás; la última, si es BM, solo lleva adelante",
  },
  {
    tipo: "Punto de cambio",
    hace: "Transmite la cota de una armada a la siguiente",
    lecturas: "Atrás y adelante (salvo en los extremos)",
  },
  {
    tipo: "Intermedio (radiación)",
    hace: "Solo se lee para conocer su cota, sin continuar el recorrido a través de él",
    lecturas: "Solo adelante",
  },
];

// --- § 6.5 Tolerancia K·√D de nivelación ---

export const TOLERANCIA_NIVELACION = [
  { orden: "Primer orden", k: "3" },
  { orden: "Segundo orden", k: "6" },
  { orden: "Tercer orden", k: "12" },
  { orden: "Ordinario", k: "24" },
];

// --- § 7.4 Niveles del semáforo de asentamientos ---

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

// --- § 6 Desenlaces del cierre ---

export const DESENLACES_CIERRE = [
  { situacion: "Cumple las tolerancias", ocurre: "Se cierra como Cerrado" },
  {
    situacion: "El error angular supera la tolerancia",
    ocurre: "No se puede cerrar. Corrija las mediciones",
  },
  {
    situacion: "Cumple en ángulos pero la precisión relativa no alcanza",
    ocurre: "Solo se puede cerrar como Rechazado",
  },
  {
    situacion: "Hay errores de captura pendientes",
    ocurre: "No se puede cerrar. Corrija las celdas marcadas",
  },
];

// --- § 10 Informes y § 11 Exportar a Excel ---

// --- § 10 Informes y § 11 Exportar a Excel ---

/** Campos del formulario de alta de informe. */
export const CAMPOS_INFORME = [
  { campo: "Título", para: "Encabeza la portada del documento" },
  {
    campo: "Procesos a incluir",
    para: "Marque los que quiera; solo aparecen los cerrados",
  },
  {
    campo: "Orden de las secciones",
    para: "Con las flechas ↑ ↓ ordena cómo saldrán",
  },
  { campo: "Observaciones", para: "Texto libre que se imprime al final" },
];

/** Las tres hojas del libro de Excel. */
export const HOJAS_EXCEL = [
  {
    hoja: "Datos Crudos",
    contiene: "Las lecturas de campo tal como se capturaron, sin modificar",
  },
  {
    hoja: "Cálculos",
    contiene: "Lo que la aplicación derivó: cotas, coordenadas, correcciones",
  },
  {
    hoja: "Resumen",
    contiene: "Método, precisión, tolerancia, estado y trazabilidad",
  },
];

// --- § 9 Preguntas frecuentes ---

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

export const PREGUNTAS: Pregunta[] = [
  {
    pregunta: "Cerré un proceso por error. ¿Puedo reabrirlo?",
    respuesta:
      "No. El cierre es definitivo por diseño: es lo que da valor probatorio al registro. Cree un proceso nuevo con los datos corregidos.",
  },
  {
    pregunta: "¿Por qué mi poligonal no me deja cerrar?",
    respuesta:
      "Revise el veredicto en la parte superior del editor. Si el error angular supera la tolerancia, hay un problema en la medición de ángulos que debe corregir. Si solo falla la precisión relativa, podrá cerrarla como rechazada.",
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
    pregunta:
      "Cambié el orden de precisión del proyecto. ¿Se recalculan los procesos?",
    respuesta:
      "Los procesos abiertos se reevalúan contra el orden nuevo al recalcularlos. Los cerrados conservan su veredicto original, porque son inmutables.",
  },
  {
    pregunta:
      "Mi nivelación cuadra en la comprobación aritmética. ¿Ya sé que la medición está bien?",
    respuesta:
      "No. La comprobación aritmética (ΣL.Atrás − ΣL.Adelante = desnivel total) solo valida que las cuentas de gabinete están bien hechas: cuadra igual con un nivel descolimado. La calidad de la medición la juzga el error de cierre contra la tolerancia K·√D.",
  },
  {
    pregunta: "¿Por qué una fila de mi libreta de nivelación no admite corrección?",
    respuesta:
      "Le falta la distancia acumulada. Es obligatoria en los puntos BM y de cambio: sin ella la aplicación no sabe a qué distancia del origen está el punto y no puede repartirle su parte del error de cierre.",
  },
  {
    pregunta:
      "Un punto quedó en alarma. ¿Puedo seguir guardando y cerrando la visita?",
    respuesta:
      "Sí. El semáforo es un diagnóstico, no un bloqueo: un punto en alerta o alarma se guarda y se cierra igual que cualquier otro. Es justamente el dato que el control de asentamientos busca detectar y dejar documentado.",
  },
  {
    pregunta:
      "¿Por qué la velocidad de dos visitas mensuales no me da el mismo número?",
    respuesta:
      "Porque se calcula con los días reales entre las dos fechas, no con «un mes» fijo. Un intervalo de 28 días y uno de 31 producen velocidades distintas aunque el asentamiento parcial fuera idéntico.",
  },
  {
    pregunta: "¿Otros usuarios pueden ver mis proyectos?",
    respuesta:
      "No. Cada usuario accede solo a los suyos; la restricción se aplica en la base de datos.",
  },
];
