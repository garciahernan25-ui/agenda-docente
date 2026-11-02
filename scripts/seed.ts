/*
 * Carga de ejemplo con 2° C de Fisicoquímica (EES N° 52). Nombres inventados.
 * Uso: npm run db:seed   (borra todo y vuelve a cargar)
 */
import { db } from "@/db";
import * as s from "@/db/schema";

type Fila = [string, string, s.Valoracion | null, number | null, s.Valoracion | null, ("baja" | null)?, string?];

const ALUMNOS: Fila[] = [
  ["ALBORNOZ", "Tomás", "TED", null, null, "baja"],
  ["BARRIOS", "Lautaro", "TEA", 7, "TEP"],
  ["CÁCERES", "Iván", "TEP", 1, "TED", "baja"],
  ["DÍAZ", "Franco", "TEP", 4, "TED", "baja"],
  ["ESPINOZA", "Abril", "TEA", 8, "TEA"],
  ["ESPINOZA", "Bruno", "TEA", 7, "TEP"],
  ["FERREYRA", "Kevin", "TEP", 6, "TEA"],
  ["GODOY", "Martina", "TEP", 4, "TEA"],
  ["HERRERA", "Jazmín", "TEP", 6, "TEP"],
  ["IBARRA", "Nicolás", "TEP", 4, "TEP"],
  ["IBARRA", "Santino", "TEA", 6, "TED"],
  ["LUNA", "Gael", "TED", 1, "TED"],
  ["MEDINA", "Facundo", "TEP", 4, "TED", "baja"],
  ["MOLINA", "Benjamín", "TEA", 7, "TED"],
  ["NAVARRO", "Zoe", "TED", null, null, "baja", "T.M"],
  ["OJEDA", "Thiago", "TEP", 4, "TED"],
  ["PERALTA", "Joaquín", "TEP", 4, "TEP"],
  ["QUIROGA", "Valentina", "TEA", 7, "TEA"],
  ["RAMOS", "Matías", "TED", 1, "TED", "baja"],
  ["SOSA", "Emiliano", "TEP", 2, "TED"],
];

async function main() {
  await db.delete(s.modalidades); // cascade borra el resto
  await db.delete(s.alumnos);
  await db.delete(s.eventos);

  const [mod] = await db.insert(s.modalidades).values({ nombre: "Secundaria" }).returning();
  const [esc] = await db
    .insert(s.escuelas)
    .values({ modalidadId: mod.id, nombre: "EES N° 52", distrito: "Almirante Brown" })
    .returning();
  const [cur] = await db.insert(s.cursos).values({ escuelaId: esc.id, anio: "2°", cicloLectivo: 2026 }).returning();
  const [div] = await db
    .insert(s.divisiones)
    .values({ cursoId: cur.id, seccion: "C", turno: "Vespertino", preceptor: "Preceptora de ejemplo" })
    .returning();
  const [asig] = await db
    .insert(s.asignaciones)
    .values({ divisionId: div.id, materia: "Fisicoquímica", profesor: "Hernán Andrés García" })
    .returning();
  await db.insert(s.pesos).values(
    Object.entries({ participacion: 10, desempeno: 10, tp_escrito: 15, actividad_virtual: 10, oral: 5, quiz: 10, examen: 40 }).map(
      ([categoria, peso]) => ({ asignacionId: asig.id, categoria: categoria as s.Categoria, peso }),
    ),
  );

  for (const [i, [apellido, nombre, v1, c1, v2, estado, obs]] of ALUMNOS.entries()) {
    const [al] = await db.insert(s.alumnos).values({ apellido, nombre }).returning();
    const [ins] = await db
      .insert(s.inscripciones)
      .values({ divisionId: div.id, alumnoId: al.id, orden: i + 1, estado: estado ?? "activo", observacion: obs })
      .returning();
    await db.insert(s.cierres).values({
      asignacionId: asig.id,
      inscripcionId: ins.id,
      valoracion1: v1,
      calificacion1: c1,
      valoracion2: v2,
    });
  }
  // EPS de ejemplo (nombres inventados): se trabaja por niveles y cada estudiante tiene el suyo
  const [modEps] = await db.insert(s.modalidades).values({ nombre: "EPS", formato: "eps" }).returning();
  const [escEps] = await db
    .insert(s.escuelas)
    .values({ modalidadId: modEps.id, nombre: "E.P.S. N° 403", distrito: "Almirante Brown" })
    .returning();
  const [curEps] = await db.insert(s.cursos).values({ escuelaId: escEps.id, anio: "III-IV", cicloLectivo: 2026 }).returning();
  const [divEps] = await db.insert(s.divisiones).values({ cursoId: curEps.id, seccion: "A", turno: "Vespertino" }).returning();
  const [asigEps] = await db
    .insert(s.asignaciones)
    .values({
      divisionId: divEps.id,
      materia: "Ciencias Naturales",
      profesor: "Hernán Andrés García",
      datosEps: { region: "V", familiaProfesional: "Energías eléctricas", area: "Ciencias Naturales" },
    })
    .returning();
  const EPS: [string, string, number, string][] = [
    ["ACOSTA", "Lucía", 4, "03/2024"],
    ["BRITEZ", "Ramiro", 4, "03/2024"],
    ["CORREA", "Dana", 3, "08/2024"],
    ["DOMÍNGUEZ", "Enzo", 4, "03/2023"],
    ["FARÍAS", "Milagros", 3, "03/2025"],
  ];
  for (const [i, [apellido, nombre, nivel, inicioEps]] of EPS.entries()) {
    const [al] = await db.insert(s.alumnos).values({ apellido, nombre }).returning();
    await db.insert(s.inscripciones).values({ divisionId: divEps.id, alumnoId: al.id, orden: i + 1, nivel, inicioEps });
  }
  console.log(`EPS de ejemplo: ${EPS.length} estudiantes en ${escEps.nombre}, asignación ${asigEps.id}`);

  console.log(`Listo: ${ALUMNOS.length} alumnos en ${esc.nombre} ${cur.anio} ${div.seccion}, asignación ${asig.id}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
