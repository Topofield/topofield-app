// Genera docs/templates/poligonales.xlsx con tres hojas (cerrada, abierta con
// control, abierta sin control), cada una precargada con un caso de ejemplo y
// con fórmulas equivalentes a las de src/lib/calculations/polygonal.ts.
//
// Convención del libro (la misma que la app):
//   * startAzimuth es el azimut del PRIMER LADO (no una dirección de referencia).
//   * stations[i].distance es la distancia del lado SALIENDO de la estación i.
//   * Cerrada: Az_i = MOD(Az_{i-1} + 180 − α corregido_i, 360).
//   * Abierta sin control: Az_i = MOD(Az_{i-1} + 180 + α_i, 360).
//   * Abierta con control: Az_i = MOD(Az_{i-1} + dir·deflexión_i, 360), dir=+1
//     para derecha (D) y −1 para izquierda (I).
//
// Correr: node scripts/build-poligonal-excel.mjs

import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../docs/templates/poligonales.xlsx");
const TITLE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F3F4" } };
const ACCENT = "FF0B3D5C";

function styleTitle(cell) {
  cell.font = { bold: true, size: 14, color: { argb: ACCENT } };
}
function styleSection(cell) {
  cell.font = { bold: true, size: 11, color: { argb: ACCENT } };
}
function styleHeader(cell) {
  cell.font = { bold: true };
  cell.fill = HEADER_FILL;
  cell.border = { bottom: { style: "thin", color: { argb: "FFB0B0B0" } } };
  cell.alignment = { vertical: "middle" };
}
function num(cell, decimals) {
  cell.numFmt = decimals === 4 ? "0.0000" : decimals === 3 ? "0.000" : "0.00";
}
function setHeaders(sheet, row, labels) {
  labels.forEach((label, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = label;
    styleHeader(cell);
  });
}

// ----------------------------------------------------------------------------
// Hoja CERRADA — pentágono (caso 1 del marco teórico)
// ----------------------------------------------------------------------------

function buildClosed(wb) {
  const s = wb.addWorksheet("Cerrada");
  s.columns = [
    { width: 12 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 },
  ];

  s.getCell("A1").value =
    "Poligonal cerrada — Caso 1 del marco teórico (pentágono de 5 vértices)";
  styleTitle(s.getCell("A1"));
  s.mergeCells("A1:J1");
  s.getRow(1).fill = TITLE_FILL;

  s.getCell("A3").value = "Punto de partida y orden";
  styleSection(s.getCell("A3"));
  setHeaders(s, 4, [
    "Código", "Norte", "Este", "Az°", "Az'", "Az\"", "Az dec", "Orden", "K (″)", "1:X mín.",
  ]);
  const start = s.getRow(5);
  start.values = ["A", 1000, 1000, 45, 0, 0,
    { formula: "D5+E5/60+F5/3600" },
    "tercer_orden", 15, 5000];
  num(s.getCell("G5"), 4);

  s.getCell("A7").value = "Estaciones (campo) y cálculo base";
  styleSection(s.getCell("A7"));
  setHeaders(s, 8, ["Est", "α°", "α'", "α\"", "α dec", "α corr", "d (m)", "Az° dec", "ΔN", "ΔE"]);

  const angles = [[95, 30, 0], [108, 15, 0], [112, 0, 0], [87, 45, 0], [136, 30, 0]];
  const dists = [120.5, 98.75, 135.2, 110.3, 89.6];
  const codes = ["A", "B", "C", "D", "E"];

  const baseStart = 9;
  for (let i = 0; i < 5; i++) {
    const r = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = angles[i][0];
    s.getCell(`C${r}`).value = angles[i][1];
    s.getCell(`D${r}`).value = angles[i][2];
    s.getCell(`E${r}`).value = { formula: `B${r}+C${r}/60+D${r}/3600` };
    s.getCell(`F${r}`).value = { formula: `E${r}+$B$17` };
    s.getCell(`G${r}`).value = dists[i];
    s.getCell(`H${r}`).value =
      i === 0
        ? { formula: "$G$5" }
        : { formula: `MOD(H${r - 1}+180-F${r},360)` };
    s.getCell(`I${r}`).value = { formula: `G${r}*COS(RADIANS(H${r}))` };
    s.getCell(`J${r}`).value = { formula: `G${r}*SIN(RADIANS(H${r}))` };
    for (const c of ["E", "F", "H", "I", "J"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`G${r}`), 3);
  }
  // Σ
  const sumRow = baseStart + 5; // 14
  s.getCell(`A${sumRow}`).value = "Σ";
  s.getCell(`A${sumRow}`).font = { bold: true };
  s.getCell(`E${sumRow}`).value = { formula: `SUM(E${baseStart}:E${sumRow - 1})` };
  s.getCell(`G${sumRow}`).value = { formula: `SUM(G${baseStart}:G${sumRow - 1})` };
  s.getCell(`I${sumRow}`).value = { formula: `SUM(I${baseStart}:I${sumRow - 1})` };
  s.getCell(`J${sumRow}`).value = { formula: `SUM(J${baseStart}:J${sumRow - 1})` };
  for (const c of ["E", "G", "I", "J"]) {
    num(s.getCell(`${c}${sumRow}`), 4);
    s.getCell(`${c}${sumRow}`).font = { bold: true };
  }

  // Cierre angular
  s.getCell("A16").value = "Verificación angular";
  styleSection(s.getCell("A16"));
  s.getCell("A17").value = "Corr. por ángulo (deg)";
  s.getCell("B17").value = { formula: `-(E${sumRow}-540)/5` };
  num(s.getCell("B17"), 6);
  s.getCell("D17").value = "Σ medida";
  s.getCell("E17").value = { formula: `E${sumRow}` };
  num(s.getCell("E17"), 4);
  s.getCell("F17").value = "Teórica";
  s.getCell("G17").value = 540;
  s.getCell("A18").value = "Error angular (″)";
  s.getCell("B18").value = { formula: `(E${sumRow}-540)*3600` };
  num(s.getCell("B18"), 2);
  s.getCell("D18").value = "Tolerancia (″)";
  s.getCell("E18").value = { formula: "I5*SQRT(5)" };
  num(s.getCell("E18"), 2);
  s.getCell("F18").value = "¿cumple?";
  s.getCell("G18").value = { formula: "IF(ABS(B18)<=E18,\"sí\",\"no\")" };

  // Cierre lineal
  s.getCell("A20").value = "Cierre lineal";
  styleSection(s.getCell("A20"));
  s.getCell("A21").value = "Error_N";
  s.getCell("B21").value = { formula: `I${sumRow}` };
  num(s.getCell("B21"), 4);
  s.getCell("D21").value = "Error_E";
  s.getCell("E21").value = { formula: `J${sumRow}` };
  num(s.getCell("E21"), 4);
  s.getCell("A22").value = "Error lineal";
  s.getCell("B22").value = { formula: "SQRT(B21^2+E21^2)" };
  num(s.getCell("B22"), 4);
  s.getCell("D22").value = "Perímetro";
  s.getCell("E22").value = { formula: `G${sumRow}` };
  num(s.getCell("E22"), 3);
  s.getCell("A23").value = "Precisión 1:X";
  s.getCell("B23").value = { formula: "IF(B22>0,E22/B22,0)" };
  num(s.getCell("B23"), 0);
  s.getCell("D23").value = "Mínima";
  s.getCell("E23").value = { formula: "J5" };
  s.getCell("F23").value = "¿cumple?";
  s.getCell("G23").value = { formula: "IF(B23>=E23,\"sí\",\"no\")" };

  // Bowditch
  s.getCell("A25").value = "Método Bowditch — Corr_ΔN = −Error_N · d/P";
  styleSection(s.getCell("A25"));
  setHeaders(s, 26, ["Est", "Corr ΔN", "Corr ΔE", "ΔN corr", "ΔE corr", "Norte", "Este"]);
  for (let i = 0; i < 5; i++) {
    const r = 27 + i;
    const base = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = { formula: `-$B$21*G${base}/$E$22` };
    s.getCell(`C${r}`).value = { formula: `-$E$21*G${base}/$E$22` };
    s.getCell(`D${r}`).value = { formula: `I${base}+B${r}` };
    s.getCell(`E${r}`).value = { formula: `J${base}+C${r}` };
    if (i === 0) {
      s.getCell(`F${r}`).value = { formula: "$B$5" };
      s.getCell(`G${r}`).value = { formula: "$C$5" };
    } else {
      s.getCell(`F${r}`).value = { formula: `F${r - 1}+D${r - 1}` };
      s.getCell(`G${r}`).value = { formula: `G${r - 1}+E${r - 1}` };
    }
    for (const c of ["B", "C", "D", "E"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`F${r}`), 3);
    num(s.getCell(`G${r}`), 3);
  }

  // Tránsito
  s.getCell("A33").value = "Método Tránsito — Corr_ΔN = −Error_N · |ΔN| / Σ|ΔN|";
  styleSection(s.getCell("A33"));
  setHeaders(s, 34, ["Est", "Corr ΔN", "Corr ΔE", "ΔN corr", "ΔE corr", "Norte", "Este"]);
  // Sumas auxiliares para Tránsito
  s.getCell("I33").value = "Σ|ΔN|";
  s.getCell("J33").value = { formula: `SUMPRODUCT(ABS(I${baseStart}:I${sumRow - 1}))` };
  num(s.getCell("J33"), 4);
  s.getCell("I34").value = "Σ|ΔE|";
  s.getCell("J34").value = { formula: `SUMPRODUCT(ABS(J${baseStart}:J${sumRow - 1}))` };
  num(s.getCell("J34"), 4);
  for (let i = 0; i < 5; i++) {
    const r = 35 + i;
    const base = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = { formula: `IF($J$33>0,-$B$21*ABS(I${base})/$J$33,0)` };
    s.getCell(`C${r}`).value = { formula: `IF($J$34>0,-$E$21*ABS(J${base})/$J$34,0)` };
    s.getCell(`D${r}`).value = { formula: `I${base}+B${r}` };
    s.getCell(`E${r}`).value = { formula: `J${base}+C${r}` };
    if (i === 0) {
      s.getCell(`F${r}`).value = { formula: "$B$5" };
      s.getCell(`G${r}`).value = { formula: "$C$5" };
    } else {
      s.getCell(`F${r}`).value = { formula: `F${r - 1}+D${r - 1}` };
      s.getCell(`G${r}`).value = { formula: `G${r - 1}+E${r - 1}` };
    }
    for (const c of ["B", "C", "D", "E"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`F${r}`), 3);
    num(s.getCell(`G${r}`), 3);
  }

  // Crandall
  s.getCell("A41").value =
    "Método Crandall — ángulos fijos, ajusta distancias por mínimos cuadrados ponderados";
  styleSection(s.getCell("A41"));
  s.getCell("A42").value = "a₁₁ = Σ d·cos²(Az)";
  s.getCell("B42").value = {
    formula: `SUMPRODUCT(G${baseStart}:G${sumRow - 1}, COS(RADIANS(H${baseStart}:H${sumRow - 1}))^2)`,
  };
  num(s.getCell("B42"), 4);
  s.getCell("A43").value = "a₂₂ = Σ d·sin²(Az)";
  s.getCell("B43").value = {
    formula: `SUMPRODUCT(G${baseStart}:G${sumRow - 1}, SIN(RADIANS(H${baseStart}:H${sumRow - 1}))^2)`,
  };
  num(s.getCell("B43"), 4);
  s.getCell("A44").value = "a₁₂ = Σ d·cos·sin";
  s.getCell("B44").value = {
    formula: `SUMPRODUCT(G${baseStart}:G${sumRow - 1}, COS(RADIANS(H${baseStart}:H${sumRow - 1})), SIN(RADIANS(H${baseStart}:H${sumRow - 1})))`,
  };
  num(s.getCell("B44"), 4);
  s.getCell("A45").value = "det";
  s.getCell("B45").value = { formula: "B42*B43 - B44^2" };
  num(s.getCell("B45"), 4);
  s.getCell("A46").value = "λ₁";
  s.getCell("B46").value = { formula: "IF(B45<>0,(B43*-B21 - B44*-E21)/B45,0)" };
  num(s.getCell("B46"), 8);
  s.getCell("A47").value = "λ₂";
  s.getCell("B47").value = { formula: "IF(B45<>0,(-B44*-B21 + B42*-E21)/B45,0)" };
  num(s.getCell("B47"), 8);

  setHeaders(s, 49, ["Est", "δd", "ΔN corr", "ΔE corr", "Norte", "Este"]);
  for (let i = 0; i < 5; i++) {
    const r = 50 + i;
    const base = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = {
      formula: `G${base}*($B$46*COS(RADIANS(H${base}))+$B$47*SIN(RADIANS(H${base})))`,
    };
    s.getCell(`C${r}`).value = { formula: `I${base}+B${r}*COS(RADIANS(H${base}))` };
    s.getCell(`D${r}`).value = { formula: `J${base}+B${r}*SIN(RADIANS(H${base}))` };
    if (i === 0) {
      s.getCell(`E${r}`).value = { formula: "$B$5" };
      s.getCell(`F${r}`).value = { formula: "$C$5" };
    } else {
      s.getCell(`E${r}`).value = { formula: `E${r - 1}+C${r - 1}` };
      s.getCell(`F${r}`).value = { formula: `F${r - 1}+D${r - 1}` };
    }
    for (const c of ["B", "C", "D"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`E${r}`), 3);
    num(s.getCell(`F${r}`), 3);
  }
}

// ----------------------------------------------------------------------------
// Hoja ABIERTA CON CONTROL — ejemplo simple en la convención de la app
// ----------------------------------------------------------------------------

function buildOpenControlled(wb) {
  const s = wb.addWorksheet("Abierta con control");
  s.columns = [
    { width: 12 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 12 }, { width: 9 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 },
  ];

  s.getCell("A1").value =
    "Poligonal abierta con control — ejemplo (convención de TopoField)";
  styleTitle(s.getCell("A1"));
  s.mergeCells("A1:J1");
  s.getRow(1).fill = TITLE_FILL;

  s.getCell("A3").value = "Punto de partida y de llegada conocidos";
  styleSection(s.getCell("A3"));
  setHeaders(s, 4, ["", "Norte", "Este", "Az°", "Az'", "Az\"", "Az dec"]);
  s.getCell("A5").value = "Partida";
  s.getCell("B5").value = 0;
  s.getCell("C5").value = 0;
  s.getCell("D5").value = 90;
  s.getCell("E5").value = 0;
  s.getCell("F5").value = 0;
  s.getCell("G5").value = { formula: "D5+E5/60+F5/3600" };
  num(s.getCell("G5"), 4);
  s.getCell("A6").value = "Llegada";
  s.getCell("B6").value = -50;
  s.getCell("C6").value = 186.60254;
  s.getCell("D6").value = "";
  s.getCell("A7").value = "Orden";
  s.getCell("B7").value = "tercer_orden (K=15, 1:5000)";

  s.getCell("A9").value = "Estaciones — α = deflexión en la estación, d = lado SALIENDO";
  styleSection(s.getCell("A9"));
  setHeaders(s, 10, ["Est", "α°", "α'", "α\"", "α dec", "Sentido", "d (m)", "Az° dec", "ΔN", "ΔE"]);

  const codes = ["P1", "P2", "P3"];
  const data = [
    [0, 0, 0, "", 100],            // P1: sin deflexión, distancia P1→P2 = 100
    [30, 0, 0, "D", 100],           // P2: deflexión 30°D, distancia P2→P3 = 100
    [0, 0, 0, "", 0],               // P3: estación final, sin distancia
  ];

  const baseStart = 11;
  for (let i = 0; i < 3; i++) {
    const r = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = data[i][0];
    s.getCell(`C${r}`).value = data[i][1];
    s.getCell(`D${r}`).value = data[i][2];
    s.getCell(`E${r}`).value = { formula: `B${r}+C${r}/60+D${r}/3600` };
    s.getCell(`F${r}`).value = data[i][3];
    s.getCell(`G${r}`).value = data[i][4];
    if (i === 0) {
      // Lado 0 = startAz directamente (la primera estación no tiene deflexión)
      s.getCell(`H${r}`).value = { formula: "$G$5" };
    } else if (i < 2) {
      // Lado i (i >= 1) = lado i-1 + dir·α_i
      s.getCell(`H${r}`).value = {
        formula: `MOD(H${r - 1}+IF(F${r}="I",-1,1)*E${r},360)`,
      };
    } else {
      // Última estación: no tiene lado saliendo
      s.getCell(`H${r}`).value = "";
    }
    if (i < 2) {
      s.getCell(`I${r}`).value = { formula: `G${r}*COS(RADIANS(H${r}))` };
      s.getCell(`J${r}`).value = { formula: `G${r}*SIN(RADIANS(H${r}))` };
    }
    for (const c of ["E", "H", "I", "J"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`G${r}`), 3);
  }

  // Sumas y cierre
  s.getCell("A15").value = "Cierre lineal";
  styleSection(s.getCell("A15"));
  s.getCell("A16").value = "Σ ΔN";
  s.getCell("B16").value = { formula: `SUM(I${baseStart}:I${baseStart + 1})` };
  num(s.getCell("B16"), 4);
  s.getCell("A17").value = "Σ ΔE";
  s.getCell("B17").value = { formula: `SUM(J${baseStart}:J${baseStart + 1})` };
  num(s.getCell("B17"), 4);
  s.getCell("A18").value = "N calculado final";
  s.getCell("B18").value = { formula: `$B$5+B16` };
  num(s.getCell("B18"), 4);
  s.getCell("A19").value = "E calculado final";
  s.getCell("B19").value = { formula: `$C$5+B17` };
  num(s.getCell("B19"), 4);
  s.getCell("A20").value = "Error_N";
  s.getCell("B20").value = { formula: "B18-$B$6" };
  num(s.getCell("B20"), 4);
  s.getCell("A21").value = "Error_E";
  s.getCell("B21").value = { formula: "B19-$C$6" };
  num(s.getCell("B21"), 4);
  s.getCell("A22").value = "Error lineal";
  s.getCell("B22").value = { formula: "SQRT(B20^2+B21^2)" };
  num(s.getCell("B22"), 4);
  s.getCell("A23").value = "Perímetro";
  s.getCell("B23").value = { formula: `SUM(G${baseStart}:G${baseStart + 1})` };
  num(s.getCell("B23"), 3);
  s.getCell("A24").value = "Precisión 1:X";
  s.getCell("B24").value = { formula: "IF(B22>0,B23/B22,0)" };
  num(s.getCell("B24"), 0);

  // Bowditch corrección y coords
  s.getCell("A26").value = "Método Bowditch";
  styleSection(s.getCell("A26"));
  setHeaders(s, 27, ["Est", "Corr ΔN", "Corr ΔE", "ΔN corr", "ΔE corr", "Norte", "Este"]);
  for (let i = 0; i < 3; i++) {
    const r = 28 + i;
    const base = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    if (i < 2) {
      s.getCell(`B${r}`).value = { formula: `-$B$20*G${base}/$B$23` };
      s.getCell(`C${r}`).value = { formula: `-$B$21*G${base}/$B$23` };
      s.getCell(`D${r}`).value = { formula: `I${base}+B${r}` };
      s.getCell(`E${r}`).value = { formula: `J${base}+C${r}` };
    }
    if (i === 0) {
      s.getCell(`F${r}`).value = { formula: "$B$5" };
      s.getCell(`G${r}`).value = { formula: "$C$5" };
    } else {
      s.getCell(`F${r}`).value = { formula: `F${r - 1}+D${r - 1}` };
      s.getCell(`G${r}`).value = { formula: `G${r - 1}+E${r - 1}` };
    }
    for (const c of ["B", "C", "D", "E"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`F${r}`), 3);
    num(s.getCell(`G${r}`), 3);
  }

  // Nota
  s.getCell("A32").value =
    "Tránsito y Crandall siguen las mismas fórmulas que en la hoja Cerrada. Para usar este libro como verificación, reemplaza los datos de campo (filas " +
    baseStart + "–" + (baseStart + 2) + ") por los del caso real.";
  s.mergeCells("A32:J32");
  s.getCell("A32").alignment = { wrapText: true };
  s.getCell("A32").font = { italic: true, color: { argb: "FF5D6D7E" } };
}

// ----------------------------------------------------------------------------
// Hoja ABIERTA SIN CONTROL — caso 3 (reconocimiento)
// ----------------------------------------------------------------------------

function buildOpenUncontrolled(wb) {
  const s = wb.addWorksheet("Abierta sin control");
  s.columns = [
    { width: 12 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
  ];

  s.getCell("A1").value =
    "Poligonal abierta sin control — Caso 3 (reconocimiento, sin cierre)";
  styleTitle(s.getCell("A1"));
  s.mergeCells("A1:I1");
  s.getRow(1).fill = TITLE_FILL;

  s.getCell("A3").value = "Punto de partida";
  styleSection(s.getCell("A3"));
  setHeaders(s, 4, ["Código", "Norte", "Este", "Az°", "Az'", "Az\"", "Az dec"]);
  s.getRow(5).values = ["E1", 1000, 1000, 150, 0, 0,
    { formula: "D5+E5/60+F5/3600" }];
  num(s.getCell("G5"), 4);

  s.getCell("A7").value = "Estaciones — α = ángulo horizontal, d = lado SALIENDO";
  styleSection(s.getCell("A7"));
  setHeaders(s, 8, ["Est", "α°", "α'", "α\"", "α dec", "d (m)", "Az° dec", "ΔN", "ΔE"]);

  const codes = ["E1", "E2", "E3", "E4"];
  // En la convención de TopoField: stations[0].distance = lado E1→E2.
  // El doc Caso 3 muestra esa distancia en la fila E2; aquí se desplaza una
  // fila hacia arriba para coincidir con la app.
  const data = [
    [0, 0, 0, 45.8],         // E1: sin ángulo (es el origen), d = E1→E2
    [175, 30, 0, 62.3],       // E2: ángulo medido aquí, d = E2→E3
    [192, 15, 0, 38.5],       // E3: ángulo, d = E3→E4
    [168, 0, 0, 0],           // E4: estación final, sin d
  ];

  const baseStart = 9;
  for (let i = 0; i < 4; i++) {
    const r = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    s.getCell(`B${r}`).value = data[i][0];
    s.getCell(`C${r}`).value = data[i][1];
    s.getCell(`D${r}`).value = data[i][2];
    s.getCell(`E${r}`).value = { formula: `B${r}+C${r}/60+D${r}/3600` };
    s.getCell(`F${r}`).value = data[i][3];
    if (i === 0) {
      s.getCell(`G${r}`).value = { formula: "$G$5" };
    } else if (i < 3) {
      s.getCell(`G${r}`).value = { formula: `MOD(G${r - 1}+180+E${r},360)` };
    } else {
      s.getCell(`G${r}`).value = "";
    }
    if (i < 3) {
      s.getCell(`H${r}`).value = { formula: `F${r}*COS(RADIANS(G${r}))` };
      s.getCell(`I${r}`).value = { formula: `F${r}*SIN(RADIANS(G${r}))` };
    }
    for (const c of ["E", "G", "H", "I"]) num(s.getCell(`${c}${r}`), 4);
    num(s.getCell(`F${r}`), 3);
  }

  s.getCell("A14").value = "Coordenadas (sin corrección — la poligonal sin control no la admite)";
  styleSection(s.getCell("A14"));
  setHeaders(s, 15, ["Est", "Norte", "Este"]);
  for (let i = 0; i < 4; i++) {
    const r = 16 + i;
    const base = baseStart + i;
    s.getCell(`A${r}`).value = codes[i];
    if (i === 0) {
      s.getCell(`B${r}`).value = { formula: "$B$5" };
      s.getCell(`C${r}`).value = { formula: "$C$5" };
    } else {
      s.getCell(`B${r}`).value = { formula: `B${r - 1}+H${base - 1}` };
      s.getCell(`C${r}`).value = { formula: `C${r - 1}+I${base - 1}` };
    }
    num(s.getCell(`B${r}`), 3);
    num(s.getCell(`C${r}`), 3);
  }
}

// ----------------------------------------------------------------------------

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TopoField";
  wb.lastModifiedBy = "TopoField";
  wb.created = new Date();

  buildClosed(wb);
  buildOpenControlled(wb);
  buildOpenUncontrolled(wb);

  await mkdir(dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Generado: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
