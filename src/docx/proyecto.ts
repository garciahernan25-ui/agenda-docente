// Proyecto (salida, laboratorio u otro) en Word A4, con la nómina del curso si la pediste
import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ProyectoArmado } from "@/lib/proyectos-formato";

const ANCHO = 11906 - 2 * 850; // A4 con 1,5 cm de margen, en twips
const FUENTE = "Cambria";
const TAM = 22; // 11 pt

const linea = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const bordes = { top: linea, bottom: linea, left: linea, right: linea };
const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

const run = (t: string, o: { b?: boolean; i?: boolean; tam?: number; mayus?: boolean } = {}) =>
  new TextRun({ text: t, bold: o.b, italics: o.i, size: o.tam ?? TAM, font: FUENTE, allCaps: o.mayus });

const p = (hijos: TextRun[], o: { centro?: boolean; justif?: boolean; antes?: number; despues?: number; sangria?: boolean } = {}) =>
  new Paragraph({
    children: hijos,
    alignment: o.centro ? AlignmentType.CENTER : o.justif ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { before: o.antes ?? 0, after: o.despues ?? 40 },
    indent: o.sangria ? { firstLine: 360 } : undefined,
  });

const celda = (hijos: Paragraph[], ancho: number, gris = false) =>
  new TableCell({
    children: hijos.length ? hijos : [p([run("")])],
    width: { size: ancho, type: WidthType.DXA },
    borders: bordes,
    shading: gris ? { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
  });

const tabla = (anchos: number[], filas: TableCell[][]) =>
  new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    layout: TableLayoutType.FIXED,
    rows: filas.map((c) => new TableRow({ children: c })),
  });

export async function generarProyectoDocx(a: ProyectoArmado, autor: string) {
  const medio = Math.round(ANCHO / 2);
  const hijos: (Paragraph | Table)[] = [
    p([run(a.escuela, { b: true, tam: 28 })], { centro: true }),
    ...(a.distrito ? [p([run(a.distrito)], { centro: true })] : []),
    p([run(a.documento, { b: true, tam: 30, mayus: true })], { centro: true, antes: 240 }),
    p([run(`“${a.titulo}”`, { b: true, i: true, tam: 26 })], { centro: true, despues: 200 }),
    tabla(
      [medio, ANCHO - medio],
      Array.from({ length: Math.ceil(a.datos.length / 2) }, (_, i) =>
        a.datos.slice(i * 2, i * 2 + 2).map(([k, v], j) => celda([p([run(`${k}: `, { b: true }), run(v)])], j === 0 ? medio : ANCHO - medio)),
      ),
    ),
    p([run("")]),
  ];

  for (const parte of a.partes) {
    const cuerpo = parte.lista
      ? parte.items.map((t) => new Paragraph({ children: [run(t)], bullet: { level: 0 }, spacing: { after: 20 } }))
      : parte.parrafos.map((t) => p([run(t)], { justif: true, sangria: true }));
    hijos.push(tabla([ANCHO], [[celda([p([run(parte.titulo, { b: true })])], ANCHO, true)], [celda(cuerpo, ANCHO)]]));
  }

  // Firmas
  hijos.push(
    p([run("")], { antes: 1200 }),
    new Table({
      width: { size: ANCHO, type: WidthType.DXA },
      columnWidths: [medio, ANCHO - medio],
      borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde, insideHorizontal: sinBorde, insideVertical: sinBorde },
      rows: [
        new TableRow({
          children: ["Firma del/la docente", "Firma y sello del equipo directivo"].map(
            (t, i) =>
              new TableCell({
                width: { size: i ? ANCHO - medio : medio, type: WidthType.DXA },
                margins: { left: 300, right: 300 },
                children: [
                  new Paragraph({
                    children: [run(t)],
                    alignment: AlignmentType.CENTER,
                    border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } },
                  }),
                ],
              }),
          ),
        }),
      ],
    }),
  );

  if (a.nomina.length) {
    const anchos = [700, ANCHO - 700 - 2000 - 2600, 2000, 2600];
    hijos.push(
      new Paragraph({ children: [new PageBreak()] }),
      p([run("Nómina de estudiantes", { b: true, tam: 28 })], { centro: true }),
      p([run(`“${a.titulo}” · ${a.datos[2][1]} · ${a.escuela}`)], { centro: true, despues: 160 }),
      tabla(anchos, [
        ["N°", "Apellido y nombre", "DNI", "Observaciones"].map((t, i) => celda([p([run(t, { b: true })], { centro: i !== 1 })], anchos[i], true)),
        ...a.nomina.map((e) => [
          celda([p([run(String(e.n))], { centro: true })], anchos[0]),
          celda([p([run(e.apellidoNombre)])], anchos[1]),
          celda([], anchos[2]),
          celda([], anchos[3]),
        ]),
      ]),
    );
    if (a.responsables.length) {
      hijos.push(
        p([run("Docentes responsables y acompañantes", { b: true })], { antes: 240 }),
        ...a.responsables.map((r) => new Paragraph({ children: [run(r)], bullet: { level: 0 } })),
      );
    }
  }

  const doc = new Document({
    creator: autor,
    title: `${a.documento}: ${a.titulo}`,
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
        children: hijos,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
