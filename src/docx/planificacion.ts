// Planificación anual en Word, con la misma forma que el modelo (carta apaisada, tres páginas)
import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { numerarUnidades, renglones, type DatosPlanificacion } from "@/lib/planificacion";
import { grupoDe } from "@/lib/grupo";

const ANCHO = 15840 - 2 * 567; // carta apaisada con 1 cm de margen, en twips
const FUENTE = "Cambria";
const TAM = 20; // 10 pt (medios puntos)

const linea = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const bordes = { top: linea, bottom: linea, left: linea, right: linea };

function texto(t: string, o: { negrita?: boolean; cursiva?: boolean; tam?: number } = {}) {
  return new TextRun({ text: t, bold: o.negrita, italics: o.cursiva, font: FUENTE, size: o.tam ?? TAM });
}

function parrafo(t: string, o: { negrita?: boolean; centro?: boolean; justificado?: boolean; sangria?: boolean } = {}) {
  return new Paragraph({
    children: [texto(t, o)],
    alignment: o.centro ? AlignmentType.CENTER : o.justificado ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    indent: o.sangria ? { firstLine: 360 } : undefined,
    spacing: { after: 40 },
  });
}

function vinetas(t: string | undefined, intro?: string) {
  const items = renglones(t).map(
    (r) => new Paragraph({ children: [texto(r)], bullet: { level: 0 }, spacing: { after: 20 } }),
  );
  return [...(intro ? [parrafo(intro, { negrita: true })] : []), ...items, ...(items.length || intro ? [] : [parrafo("")])];
}

function celda(hijos: Paragraph[], o: { ancho: number; titulo?: boolean; columnas?: number }) {
  return new TableCell({
    children: hijos.length ? hijos : [parrafo("")],
    width: { size: o.ancho, type: WidthType.DXA },
    columnSpan: o.columnas,
    borders: bordes,
    shading: o.titulo ? { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
  });
}

const tituloCelda = (t: string, ancho: number, columnas?: number) =>
  celda([new Paragraph({ children: [texto(t, { negrita: true, cursiva: true })], alignment: AlignmentType.CENTER })], {
    ancho,
    titulo: true,
    columnas,
  });

function tabla(anchos: number[], filas: TableCell[][]) {
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: anchos,
    layout: TableLayoutType.FIXED,
    rows: filas.map((c) => new TableRow({ children: c })),
  });
}

function cabecera(d: DatosPlanificacion) {
  const { cab, contenido } = d;
  const eps = cab.modalidad.formato === "eps";
  const a = [0.2, 0.14, 0.16, 0.3, 0.2].map((p) => Math.round(ANCHO * p));
  const dos = (x: string, y: string) => [parrafo(x), parrafo(y)];
  return tabla(a, [
    [celda([parrafo("Planificación Anual", { negrita: true, centro: true })], { ancho: ANCHO, columnas: 5 })],
    [
      celda(dos("Docente:", cab.asig.profesor), { ancho: a[0] }),
      celda(dos(`Curso: ${grupoDe(cab)}`, `Turno: ${cab.div.turno}`), { ancho: a[1] }),
      celda(dos("Carga horaria", contenido.cargaHoraria ?? ""), { ancho: a[2] }),
      celda(dos("Espacio Curricular:", cab.asig.materia), { ancho: a[3] }),
      celda(dos("Ciclo lectivo:", String(cab.curso.cicloLectivo)), { ancho: a[4] }),
    ],
  ]);
}

const pagina = {
  page: {
    size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
    margin: { top: 567, bottom: 567, left: 567, right: 567 },
  },
};

export async function generarPlanificacionDocx(d: DatosPlanificacion) {
  const c = d.contenido;
  const unidades = numerarUnidades(d.unidades);
  const medio = Math.round(ANCHO / 2);
  const cuarto = Math.round(ANCHO / 4);

  const bloque = (nombre: string, hijos: Paragraph[]) =>
    tabla([ANCHO], [[tituloCelda(nombre, ANCHO)], [celda(hijos, { ancho: ANCHO })]]);

  const columnaUnidades = (cuatri: 1 | 2) =>
    unidades
      .filter((u) => u.cuatrimestre === cuatri)
      .flatMap((u) => [
        parrafo(`Unidad n°${u.numero}: “${u.titulo}”${u.eje ? ` - ${u.eje}` : ""}`, { negrita: true }),
        ...u.contenidos
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => parrafo(l.trim(), { justificado: true })),
      ]);

  const doc = new Document({
    creator: d.cab.asig.profesor,
    title: `Planificación anual ${d.cab.asig.materia} ${grupoDe(d.cab)} ${d.cab.curso.cicloLectivo}`,
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    sections: [
      {
        properties: pagina,
        children: [
          new Paragraph({ children: [texto(d.cab.escuela.nombre, { negrita: true, cursiva: true, tam: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
          cabecera(d),
          bloque(
            "Fundamentación",
            (c.fundamentacion ?? "")
              .split(/\r?\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => parrafo(p, { justificado: true, sangria: true })),
          ),
          bloque("Objetivos de Enseñanza", vinetas(c.objetivosEnsenanza, "Se espera que el/la docente pueda:")),
          bloque("Objetivos de Aprendizaje", vinetas(c.objetivosAprendizaje, "Se espera que el estudiante logre:")),
        ],
      },
      {
        properties: pagina,
        children: [
          cabecera(d),
          tabla(
            [medio, ANCHO - medio],
            [
              [tituloCelda("Primer cuatrimestre", medio), tituloCelda("Segundo cuatrimestre", ANCHO - medio)],
              [celda(columnaUnidades(1), { ancho: medio }), celda(columnaUnidades(2), { ancho: ANCHO - medio })],
            ],
          ),
          tabla(
            [cuarto, cuarto, cuarto, ANCHO - 3 * cuarto],
            [
              [
                tituloCelda("Estrategias didácticas. Actividades", cuarto),
                tituloCelda("Recursos", cuarto),
                tituloCelda("Sistema evaluativo", cuarto),
                tituloCelda("Criterios de evaluación", ANCHO - 3 * cuarto),
              ],
              [
                celda(vinetas(c.estrategias, "Se propondrá:"), { ancho: cuarto }),
                celda(vinetas(c.recursos, "Para el desarrollo de las clases se utilizarán:"), { ancho: cuarto }),
                celda(vinetas(c.sistemaEvaluativo), { ancho: cuarto }),
                celda(vinetas(c.criterios), { ancho: ANCHO - 3 * cuarto }),
              ],
            ],
          ),
        ],
      },
      {
        properties: pagina,
        children: [
          cabecera(d),
          tabla(
            [medio, ANCHO - medio],
            [
              [tituloCelda("Bibliografía", ANCHO, 2)],
              [
                celda(vinetas(c.bibliografiaDocente, "Bibliografía para el docente:"), { ancho: medio }),
                celda(vinetas(c.bibliografiaEstudiante, "Bibliografía para el estudiante:"), { ancho: ANCHO - medio }),
              ],
              [tituloCelda("Proyectos institucionales/Salidas educativas etc", medio), tituloCelda("Observaciones", ANCHO - medio)],
              [celda(vinetas(c.proyectos), { ancho: medio }), celda(vinetas(c.observaciones), { ancho: ANCHO - medio })],
            ],
          ),
          new Paragraph({ children: [], spacing: { before: 600 } }),
          new Table({
            width: { size: ANCHO, type: WidthType.DXA },
            columnWidths: [medio, ANCHO - medio],
            borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: medio, type: WidthType.DXA }, children: [parrafo(`Fecha de entrega: ${c.fechaEntrega ? c.fechaEntrega.split("-").reverse().join("/") : ""}`)] }),
                  new TableCell({ width: { size: ANCHO - medio, type: WidthType.DXA }, children: [parrafo("Recepción:")] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
