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
    alt: "Pestaña de configuración del proyecto, con la edición de datos y los puntos de referencia.",
    width: 2560,
    height: 3170,
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
    alt: "Formulario de nuevo proceso de nivelación, con el tipo y el BM de partida.",
    width: 2560,
    height: 1600,
  },
  importarNivelacion: {
    src: "/manual/23-importar-nivelacion.png",
    alt: "Diálogo Importar libreta desde archivo con el crudo de un nivel digital Leica: 16 armadas, ida y vuelta con la vuelta en la armada 9, la elección de la cota del BM y la libreta de ida con los tipos de punto.",
    width: 1344,
    height: 2736,
  },
  puntosHomologos: {
    src: "/manual/24-puntos-homologos.png",
    alt: "Tabla de puntos homólogos del crudo de nivel digital leído como ida y vuelta: los residuos crecen hasta −5.2 mm a mitad del recorrido y vuelven a −0.4 mm, la discrepancia.",
    width: 1984,
    height: 1082,
  },
  editorNivelacion: {
    src: "/manual/12-editor-nivelacion.png",
    alt: "Editor de nivelación completo: veredicto, libreta, perfil, comprobación aritmética, cierre, cotas corregidas y cotas adoptadas.",
    pie: "Circuito cerrado que cumple la tolerancia: el BM final corrige exacto a su cota conocida.",
    width: 2560,
    height: 4890,
  },
  nuevoLugar: {
    src: "/manual/13-nuevo-lugar.png",
    alt: "Formulario de nuevo lugar, con el tipo de estructura y los umbrales de alerta.",
    width: 2560,
    height: 1600,
  },
  editorLugar: {
    src: "/manual/14-editor-lugar.png",
    alt: "Pestaña Puntos y lugar: datos generales, umbrales y catálogo de puntos de control.",
    width: 2560,
    height: 2948,
  },
  panelAsentamientos: {
    src: "/manual/15-panel-asentamientos.png",
    alt: "Panel del lugar Torre Alameda: los cinco indicadores, la tabla de visitas con los cierres fuera de tolerancia marcados con ⚠ y el ⚠ junto al amarre de la visita 13, donde BM-2 no nivela con BM-1, la tendencia del promedio con su banda y los umbrales, la evolución por punto con sus chips y el semáforo de la última visita.",
    width: 2560,
    height: 5322,
  },
  nuevaVisita: {
    src: "/manual/25-nueva-visita.png",
    alt: "Formulario Nueva visita: fecha, nivelador, captura «Digitar la libreta de nivelación», BM de amarre BM-1 con cota 100.0000, orden de precisión y equipo tomados de la visita anterior.",
    width: 1344,
    height: 2340,
  },
  importarLibretaVisita: {
    src: "/manual/26-importar-libreta-visita.png",
    alt: "Diálogo Importar la libreta de la visita con la plantilla CSV: dos armadas y trece visuales, BM de amarre BM-1, el aviso de que la libreta actual se reemplazará y la libreta con los puntos de control marcados.",
    width: 1344,
    height: 2236,
  },
  vistaVisita: {
    src: "/manual/27-vista-visita.png",
    alt: "Vista de la visita 12 de Torre Alameda: los seis indicadores, la tabla de puntos de control con TA-07 seleccionado, su historial con la nota «Le faltan 21.3 mm para el umbral de alerta» y las barras de acumulado y de movimiento por punto.",
    width: 2560,
    height: 2820,
  },
  registroNivelacion: {
    src: "/manual/28-registro-nivelacion.png",
    alt: "Panel lateral Registro de nivelación de la visita 12: la libreta en dos armadas con las vistas intermedias de los puntos de control resaltadas, ΣV+, ΣV−, error de cierre de −1.6 mm dentro de la tolerancia de ±4.0 mm, y la comprobación de BM-2, que nivela con BM-1.",
    width: 1536,
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
  editorVisita: {
    src: "/manual/16-editor-visita.png",
    alt: "Editor de la visita: cabecera con la captura en libreta y el BM de amarre, la libreta de nivelación con las filas de punto de control y de BM de amarre marcadas, su resumen de cierre y la comprobación de BM-2, y debajo las cotas de los puntos de control que salen de ella.",
    width: 2560,
    height: 6194,
  },
  nuevoInforme: {
    src: "/manual/18-nuevo-informe.png",
    alt: "Formulario Nuevo informe: el título, los procesos a incluir —las poligonales calculadas del proyecto y una nivelación cerrada— y las observaciones generales.",
    width: 2560,
    height: 2068,
  },
  informeImprimible: {
    src: "/manual/19-informe-imprimible.png",
    alt: "Informe consolidado de una nivelación, maquetado para imprimir: portada con los datos del proyecto, índice, sección del proceso con sus resultados y su equipo, resumen consolidado de precisiones, observaciones y registro de cierre.",
    width: 2560,
    height: 3734,
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
    alt: "Paso 3 · Informe de la poligonal V10, cartera TT4: portada; resultado con el orden alcanzado, datos de campo, corrección por método Brújula (Bowditch), poligonal ajustada y coordenadas con el dibujo; resumen de precisión y observaciones, y debajo el botón para generar un informe consolidado con ella.",
    width: 2560,
    height: 8776,
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
  { id: "equipos", titulo: "El catálogo de equipos" },
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
    significado: "Cálculo resuelto; se puede revisar y, salvo una poligonal, cerrar",
  },
  {
    estado: "Cerrado",
    significado: "Terminado y conforme. Inmutable mientras siga cerrado",
  },
  {
    estado: "Rechazado",
    significado: "Terminado pero fuera de tolerancia. Inmutable mientras siga cerrado",
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
    muestra:
      "Borrador, Calculado, Cerrado o Rechazado; Borrador o Calculado en una poligonal; Activo o Cerrado en un lugar",
  },
  {
    columna: "Resultado",
    muestra:
      "La precisión relativa de una poligonal, el cierre de una nivelación (o su discrepancia, si es abierta con vuelta) o la alerta de un lugar",
  },
  {
    columna: "Cumple",
    muestra:
      "✓ si cumple su tolerancia —una poligonal, si alcanza algún orden—, ✕ si no, — si no aplica. No aparece en asentamientos",
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
    descripcion: "No cierra contra ningún BM",
    verificacion: "Sin vuelta, ninguno; con vuelta, la discrepancia entre ida y vuelta",
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

// --- § 6.5 Tolerancia K·√D de nivelación ---

export const TOLERANCIA_NIVELACION = [
  { orden: "Primer orden", k: "3" },
  { orden: "Segundo orden", k: "6" },
  { orden: "Tercer orden", k: "12" },
  { orden: "Ordinario", k: "24" },
];

// --- § 7.3 Avisos de la libreta de la visita ---

export const AVISOS_LIBRETA = [
  {
    situacion: "El cierre supera la tolerancia",
    ocurre:
      "Solo avisa. La visita se guarda y se cierra igual, con sus cotas sin compensar",
  },
  {
    situacion: "Otro BM del catálogo no nivela con el amarre",
    ocurre: "Solo avisa: ver «Comprobar los BM», abajo",
  },
  {
    situacion: "Faltan las distancias por visual",
    ocurre: "Avisa: sin distancias no se evalúa la tolerancia ni se compensa",
  },
  {
    situacion: "Todavía no se leyó el amarre de cierre",
    ocurre: "«Libreta incompleta»: aún no hay error de cierre",
  },
  {
    situacion: "La primera o la última fila no es el BM de amarre",
    ocurre: "No se puede guardar",
  },
  {
    situacion: "Un punto de control sin vista menos",
    ocurre: "Avisa: el punto queda sin cota",
  },
  {
    situacion: "Un punto que no está vigente en la fecha",
    ocurre: "Avisa: su lectura no se usa",
  },
  {
    situacion: "El mismo punto con vista menos en dos filas",
    ocurre: "No se puede guardar hasta dejar una",
  },
  {
    situacion: "La comprobación aritmética no cuadra",
    ocurre: "No se puede cerrar la visita (§ 7.6)",
  },
];

// --- § 7.4 Indicadores del panel del lugar ---

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
    muestra: "Cuántas visitas tienen algún punto en precaución o más",
  },
  {
    indicador: "Visitas",
    muestra: "El total, con la fecha de la lectura base y la de la última",
  },
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

// --- § 8 Desenlaces del cierre de una nivelación ---

export const DESENLACES_CIERRE = [
  { situacion: "Cumple la tolerancia", ocurre: "Se cierra como Cerrado" },
  {
    situacion: "No alcanza la tolerancia",
    ocurre: "Solo se puede cerrar como Rechazado",
  },
  {
    situacion:
      "La comprobación aritmética no cuadra, o hay errores de captura",
    ocurre: "No se puede cerrar. Corrija la libreta",
  },
];

// --- § 10 Informes y § 11 Exportar a Excel ---

/** Campos del formulario de alta de informe. */
export const CAMPOS_INFORME = [
  { campo: "Título", para: "Encabeza la portada del documento" },
  {
    campo: "Procesos a incluir",
    para:
      "Marque los que quiera; aparecen las poligonales calculadas y los procesos cerrados",
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
    contiene:
      "Equipo, método, precisión, tolerancia, estado y trazabilidad. En una poligonal, la ubicación, el responsable, y el orden alcanzado y el tipo de ángulo detectados",
  },
];

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
    pregunta: "Cerré un proceso por error. ¿Puedo reabrirlo?",
    respuesta:
      "Sí: con Reabrir, en la cabecera del proceso (§ 8). Vuelve a ser editable y se cierra otra vez cuando esté listo.",
  },
  {
    pregunta: "¿Cómo cierro una poligonal?",
    respuesta:
      "No se cierra: queda calculada y se corrige cuando haga falta. El paso de Ajuste y su informe dicen qué orden de precisión alcanzó (§ 5.5); si no alcanza ninguno, el informe lo alerta. Un informe consolidado la incluye calculada.",
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
      "En cada proceso, no en el proyecto. Cada nivelación y cada visita de asentamiento declara su orden y su equipo en su propia configuración. Una poligonal declara su equipo en el alta, y su orden no se declara: se detecta al calcularla (§ 5.5). Si el equipo es el de siempre, tómelo del catálogo de equipos (§ 12).",
  },
  {
    pregunta:
      "Cambié el orden de precisión de una nivelación abierta. ¿Se recalcula?",
    respuesta:
      "Sí, al recalcularla. Una cerrada conserva su veredicto original, porque es inmutable.",
  },
  {
    pregunta:
      "Levanté una poligonal en un sistema local. ¿Puedo pasarla a coordenadas reales?",
    respuesta:
      "Sí: Georreferenciar (§ 5.6), con dos estaciones de coordenadas conocidas, o editando el amarre con las coordenadas reales de la partida y la referencia. El orden alcanzado no cambia.",
  },
  {
    pregunta: "¿Qué pasa si el equipo que declaro no alcanza el orden que elegí?",
    respuesta:
      "En una nivelación o una visita, la aplicación no lo juzga: registra el equipo para el informe, y lo que dice si el trabajo cumple es el cierre contra la tolerancia del orden. Si el equipo no da para el orden, lo más probable es que el cierre no cumpla. Una poligonal no elige orden: alcanza el que su cierre permite.",
  },
  {
    pregunta:
      "Mi nivelación cuadra en la comprobación aritmética. ¿Ya sé que la medición está bien?",
    respuesta:
      "No. La comprobación aritmética (ΣV+ − ΣV− = desnivel total) solo valida que las cuentas de gabinete están bien hechas: cuadra igual con un nivel descolimado. La calidad de la medición la juzga el error de cierre contra la tolerancia K·√D.",
  },
  {
    pregunta: "¿Por qué una fila de mi libreta de nivelación no admite corrección?",
    respuesta:
      "Le falta la distancia a alguna de sus miras. Es obligatoria en los puntos BM y de cambio: sin ella el recorrido no acumula, la distancia total sale menor de la real y el punto de cierre queda mal corregido. La distancia acumulada no se teclea — la calcula la aplicación sumando las distancias por visual.",
  },
  {
    pregunta:
      "La libreta de una visita salió fuera de tolerancia. ¿Puedo cerrarla?",
    respuesta:
      "Sí. Fuera de tolerancia solo avisa: la visita se guarda y se cierra con sus cotas sin compensar, y el aviso queda en la columna Cierre del panel y en la vista de la visita. Lo que sí impide cerrarla es una comprobación aritmética que no cuadra, porque indica un error en la libreta.",
  },
  {
    pregunta: "¿Por qué no puedo teclear la cota de un punto en la visita?",
    respuesta:
      "Porque la visita se captura con libreta: la cota sale de la vista menos del punto en la libreta. Si nivelaron y calcularon fuera de la aplicación, cambie Captura de las cotas a Cotas directas.",
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
    pregunta: "¿Puedo eliminar un proyecto?",
    respuesta:
      "Si no tiene nada cerrado, sí, desde Configuración. Si tiene algún proceso, lugar o visita cerrados, no: esos registros no se borran. Archívelo para ocultarlo de la lista activa (§ 4.2).",
  },
  {
    pregunta: "Salí de un editor y perdí lo que había tecleado.",
    respuesta:
      "Si pulsó un enlace de la aplicación o recargó la página, la aplicación o el navegador le preguntó antes. Los botones atrás y adelante del navegador no preguntan: guarde antes de usarlos (§ 4.4). En una poligonal no hay qué perder: cada popup guarda al confirmar.",
  },
  {
    pregunta: "¿Otros usuarios pueden ver mis proyectos?",
    respuesta:
      "No. Cada usuario accede solo a los suyos; la restricción se aplica en la base de datos.",
  },
];
