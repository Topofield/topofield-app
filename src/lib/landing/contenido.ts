// Lo que la página de presentación cuenta de cada proceso (Fase 45).
//
// Las capturas son las del manual (`public/manual/`): no hay una copia para la
// página. `capturas.test.ts` comprueba que siguen en `capturas.json`, que es
// lo que se rompería si un recorrido renombra una.

export interface ApartadoLanding {
  titulo: string;
  texto: string;
  /** Clave de `docs/manual/capturas.json`: `<capítulo>/<archivo>.png`. */
  captura: string;
  /** Qué se ve en la captura, para quien no la ve. */
  alt: string;
}

export const APARTADOS: ApartadoLanding[] = [
  {
    titulo: "Poligonal",
    texto:
      "Ángulos y distancias por estación, con el cierre a la vista mientras se captura. Se ajusta por Brújula, Tránsito, Crandall o mínimos cuadrados, y la aplicación dice qué orden de precisión alcanza y dibuja la ajustada sobre la medida.",
    captura: "poligonal/12-ajuste.png",
    alt: "Paso Ajuste de una poligonal cerrada: error angular, error lineal, precisión relativa y el orden alcanzado, sobre la tabla de la poligonal ajustada",
  },
  {
    titulo: "Nivelación",
    texto:
      "La libreta se captura por armadas o se importa del archivo de un nivel digital. Se compensa en proporción a la distancia, se compara la ida con la vuelta y queda dicho qué orden alcanza el cierre.",
    captura: "nivelacion/07-libreta.png",
    alt: "Libreta de una nivelación de ida y vuelta, con las lecturas de cada armada y el perfil del terreno al lado",
  },
  {
    titulo: "Asentamientos",
    texto:
      "Cada visita nivela los puntos de control desde los BM del lugar. El panel muestra cuánto ha bajado cada punto y a qué velocidad, la tendencia entre visitas y un semáforo frente a los umbrales de alerta.",
    captura: "asentamientos/13-panel.png",
    alt: "Panel de un control de asentamientos: asentamiento máximo, velocidad máxima, la lista de visitas con su alerta y la gráfica de tendencia",
  },
  {
    titulo: "Informe",
    texto:
      "Cada proceso tiene su informe, compuesto con los datos del momento. Sale en PDF y en un libro de Excel cuyas celdas llevan la fórmula y no solo el resultado, para que quien lo recibe pueda seguir el cálculo.",
    captura: "informe-y-excel/01-pagina-de-informe.png",
    alt: "Paso Informe de una poligonal, con los botones Exportar PDF y Exportar Excel sobre la portada del informe técnico",
  },
];
