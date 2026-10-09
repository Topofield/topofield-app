import { describe, expect, it } from "vitest";
import {
  anotarTitulos,
  datosArchivo,
  imagenSola,
  lexear,
  resolverCaptura,
  resolverEnlace,
  slugGithub,
  textoPlano,
  type Titulo,
  type Token,
  type Tokens,
} from "./markdown";

describe("slugGithub", () => {
  it("conserva las tildes y quita la puntuación, como GitHub", () => {
    expect(slugGithub("1. Conceptos básicos")).toBe("1-conceptos-básicos");
    expect(slugGithub("7.13 Dar de baja y de alta un punto")).toBe(
      "713-dar-de-baja-y-de-alta-un-punto",
    );
    expect(slugGithub("Paso 1 · Datos")).toBe("paso-1--datos");
    expect(slugGithub("¿Qué es una armada?")).toBe("qué-es-una-armada");
    expect(slugGithub("Importar un archivo .L o CSV")).toBe("importar-un-archivo-l-o-csv");
  });
});

describe("anotarTitulos", () => {
  it("da a cada título su ancla y numera los repetidos", () => {
    const tokens = lexear("# Uno\n\n## Paso\n\n### Paso\n\n## Paso\n");
    const titulos = anotarTitulos(tokens);
    expect(titulos.map((t) => t.id)).toEqual(["uno", "paso", "paso-1", "paso-2"]);
    expect(titulos.map((t) => t.nivel)).toEqual([1, 2, 3, 2]);
    const h = tokens.find((t) => t.type === "heading") as Tokens.Heading & { id: string };
    expect(h.id).toBe("uno");
  });

  it("toma el texto sin formato", () => {
    const [t] = anotarTitulos(lexear("## El **amarre** y `V+`\n")) as [Titulo];
    expect(t.texto).toBe("El amarre y V+");
    expect(t.id).toBe("el-amarre-y-v");
  });
});

describe("textoPlano", () => {
  it("no escapa: lo que se escribe es lo que se lee", () => {
    const [p] = lexear("a < b & `c > d` y **e**\n") as [Tokens.Paragraph];
    expect(textoPlano(p.tokens)).toBe("a < b & c > d y e");
  });
});

describe("datosArchivo", () => {
  it("lee el número y el slug de un capítulo", () => {
    expect(datosArchivo("03-poligonal.md")).toEqual({ numero: 3, slug: "poligonal" });
    expect(datosArchivo("README.md")).toBeNull();
    expect(datosArchivo("3-poligonal.md")).toBeNull();
  });
});

describe("resolverEnlace", () => {
  it("lleva los enlaces entre archivos a rutas de la aplicación", () => {
    expect(resolverEnlace("03-poligonal.md#ajustar")).toMatchObject({
      tipo: "interno",
      href: "/manual/poligonal#ajustar",
      archivo: "03-poligonal.md",
      ancla: "ajustar",
    });
    expect(resolverEnlace("04-nivelacion.md")).toMatchObject({ href: "/manual/nivelacion" });
    expect(resolverEnlace("README.md")).toMatchObject({ tipo: "interno", href: "/manual" });
  });

  it("deja las anclas y los externos, y rechaza lo demás", () => {
    expect(resolverEnlace("#glosario")).toEqual({ tipo: "ancla", href: "#glosario", ancla: "glosario" });
    expect(resolverEnlace("https://example.org")).toEqual({ tipo: "externo", href: "https://example.org" });
    expect(resolverEnlace("http://example.org").tipo).toBe("invalido");
    expect(resolverEnlace("../tecnica/README.md").tipo).toBe("invalido");
  });
});

describe("resolverCaptura", () => {
  it("traduce la ruta relativa del Markdown a la pública", () => {
    expect(resolverCaptura("../../public/manual/poligonal/03-amarre.png")).toEqual({
      publica: "/manual/poligonal/03-amarre.png",
      clave: "poligonal/03-amarre.png",
      carpeta: "poligonal",
    });
  });

  it("rechaza lo que no es una captura del manual", () => {
    expect(resolverCaptura("/manual/x.png")).toBeNull();
    expect(resolverCaptura("../../public/manual/x.png")).toBeNull();
    expect(resolverCaptura("https://example.org/x.png")).toBeNull();
  });
});

describe("imagenSola", () => {
  it("reconoce el párrafo que es solo una imagen", () => {
    const [p] = lexear('![Alt](../../public/manual/a/01-x.png "Pie")\n') as [Token];
    const img = imagenSola(p);
    expect(img?.href).toBe("../../public/manual/a/01-x.png");
    expect(img?.title).toBe("Pie");
    expect(img?.text).toBe("Alt");
  });

  it("no confunde una imagen dentro de una frase", () => {
    const [p] = lexear("Mire ![Alt](../../public/manual/a/01-x.png) aquí\n") as [Token];
    expect(imagenSola(p)).toBeNull();
  });
});
