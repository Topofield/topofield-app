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
  editorMovil: {
    src: "/manual/11-editor-movil.png",
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
  { id: "cierre", titulo: "Cerrar un proceso" },
  { id: "campo", titulo: "Trabajo en campo" },
  { id: "pendientes", titulo: "Módulos pendientes" },
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

// --- § 8 Módulos pendientes ---

export interface ModuloPendiente {
  nombre: string;
  fase: number;
  descripcion: string;
}

export const MODULOS_PENDIENTES: ModuloPendiente[] = [
  {
    nombre: "Nivelación",
    fase: 4,
    descripcion:
      "Nivelación geométrica cerrada, de enlace e ida y vuelta, con corrección proporcional a la distancia y tolerancia K·√D.",
  },
  {
    nombre: "Asentamientos",
    fase: 5,
    descripcion:
      "Control de asentamientos por punto, cálculo de velocidades y semáforo de alertas por umbrales.",
  },
  {
    nombre: "Informes y exportación",
    fase: 6,
    descripcion:
      "Generación de informes en PDF, carteras de campo y exportación de coordenadas.",
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
    pregunta: "¿Otros usuarios pueden ver mis proyectos?",
    respuesta:
      "No. Cada usuario accede solo a los suyos; la restricción se aplica en la base de datos.",
  },
];
