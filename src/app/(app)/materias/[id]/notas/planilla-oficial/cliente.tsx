"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ACEPTA, mandarFoto } from "@/lib/foto-cliente";
import { parecidoFlexible as parecido } from "@/lib/nombres";
import { importarPlanilla } from "../../acciones";

type Alumno = { id: number; orden: number; apellido: string; nombre: string; baja: boolean };
type FilaLeida = {
  numero: string;
  nombre: string;
  parciales1: string[];
  valoracion1: string;
  calificacion1: string;
  inasistencias1: string;
  parciales2: string[];
  valoracion2: string;
  calificacion2: string;
  intensificacion1: string;
  inasistencias2: string;
  tachado: boolean;
  observacion: string;
  dudoso: boolean;
};
type Fila = FilaLeida & { alumnoId: string; baja: boolean };
type Col = { tipo: string; tema: string }; // tema: id existente, "nuevo" o "" (examen / no usar)

const NO = "__no__";
const n = (v: string) => Number(v.replace(",", "."));
const esNota = (v: string) => v.trim() === "" || (/^\d{1,2}([.,]\d+)?$/.test(v.trim()) && n(v) >= 1 && n(v) <= 10);
const esVal = (v: string) => v.trim() === "" || ["TEA", "TEP", "TED"].includes(v.trim().toUpperCase());
const esIna = (v: string) => v.trim() === "" || (/^\d{1,3}([.,]\d+)?$/.test(v.trim()) && n(v) <= 300);
const aNota = (v: string) => (v.trim() === "" ? null : n(v));

export function ImportarPlanilla(props: {
  asignacionId: number;
  hoy: string;
  ciclo: number;
  alumnos: Alumno[];
  temas: { id: number; titulo: string; cuatrimestre: 1 | 2 }[];
  tipos: { clave: string; nombre: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const tipoBase = props.tipos.find((t) => t.clave === "tp_escrito")?.clave ?? props.tipos.find((t) => t.clave !== "examen")?.clave ?? "examen";
  const colInicial = (): Col[] => Array.from({ length: 5 }, () => ({ tipo: tipoBase, tema: "nuevo" }));
  const [cols1, setCols1] = useState<Col[]>(colInicial);
  const [cols2, setCols2] = useState<Col[]>(colInicial);
  const [nombres, setNombres] = useState({ 1: "Nota {k} (planilla 1° C)", 2: "Nota {k} (planilla 2° C)" } as Record<1 | 2, string>);
  const [fecha1, setFecha1] = useState(`${props.ciclo}-07-01`);
  const [fecha2, setFecha2] = useState(props.hoy);
  const [cierre1, setCierre1] = useState(true);
  const [cierre2, setCierre2] = useState(true);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function emparejar(numero: string, nombre: string) {
    const num = Number(numero);
    const porNumero = num ? props.alumnos.find((a) => a.orden === num) : undefined;
    if (porNumero && (!nombre || parecido(nombre, porNumero.apellido, porNumero.nombre) >= 0.6)) return String(porNumero.id);
    const porNombre = props.alumnos
      .map((a) => ({ a, p: parecido(nombre, a.apellido, a.nombre) }))
      .filter((x) => x.p >= 0.6)
      .sort((x, y) => y.p - x.p);
    if (porNombre[0] && (porNombre.length === 1 || porNombre[0].p > porNombre[1].p)) return String(porNombre[0].a.id);
    if (porNumero && !nombre) return String(porNumero.id);
    return NO;
  }

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);
    setLeyendo(true);
    const r = await mandarFoto<{ filas: FilaLeida[] }>("/api/foto/planilla-oficial", archivo);
    setLeyendo(false);
    if (input.current) input.current.value = "";
    if (!r.ok) return setMensaje({ ok: false, texto: r.mensaje });
    // Si ya había filas (otra hoja), se suman
    setFilas((prev) => [...(prev ?? []), ...r.datos.filas.map((f) => ({ ...f, alumnoId: emparejar(f.numero, f.nombre), baja: f.tachado }))]);
  }

  const set = (i: number, c: Partial<Fila>) => setFilas((fs) => fs!.map((f, j) => (j === i ? { ...f, ...c } : f)));
  const setParcial = (i: number, cu: 1 | 2, k: number, v: string) =>
    setFilas((fs) => fs!.map((f, j) => (j !== i ? f : cu === 1 ? { ...f, parciales1: f.parciales1.map((x, m) => (m === k ? v : x)) } : { ...f, parciales2: f.parciales2.map((x, m) => (m === k ? v : x)) })));

  const conValor = (cu: 1 | 2, k: number) => (filas ?? []).some((f) => f.alumnoId !== NO && (cu === 1 ? f.parciales1 : f.parciales2)[k].trim() !== "");
  const repetidos = new Set((filas ?? []).map((f) => f.alumnoId).filter((id, i, arr) => id !== NO && arr.indexOf(id) !== i));
  const filaMal = (f: Fila) =>
    f.alumnoId !== NO &&
    (![...f.parciales1, ...f.parciales2, f.calificacion1, f.calificacion2, f.intensificacion1].every(esNota) ||
      !esVal(f.valoracion1) ||
      !esVal(f.valoracion2) ||
      !esIna(f.inasistencias1) ||
      !esIna(f.inasistencias2));

  function guardar() {
    if (!filas) return;
    if (repetidos.size) return setMensaje({ ok: false, texto: "Hay dos filas con el mismo alumno. Corregilo antes de guardar." });
    if (filas.some(filaMal)) return setMensaje({ ok: false, texto: "Hay valores en rojo: notas de 1 a 10, valoración TEA/TEP/TED e inasistencias en número." });
    const armarCols = (cu: 1 | 2, cols: Col[]) =>
      cols.map((c, k) => {
        const usar = c.tipo !== NO && conValor(cu, k);
        const examen = c.tipo === "examen";
        return {
          usar,
          categoria: usar ? c.tipo : tipoBase,
          temaId: usar && !examen && c.tema !== "nuevo" && c.tema ? Number(c.tema) : null,
          temaNuevo: usar && !examen && c.tema === "nuevo" ? nombres[cu].replace("{k}", String(k + 1)) : null,
        };
      });
    iniciar(async () => {
      try {
        const r = await importarPlanilla({
          asignacionId: props.asignacionId,
          fecha1,
          fecha2,
          columnas1: armarCols(1, cols1),
          columnas2: armarCols(2, cols2),
          guardarCierre1: cierre1,
          guardarCierre2: cierre2,
          filas: filas
            .filter((f) => f.alumnoId !== NO)
            .map((f) => ({
              inscripcionId: Number(f.alumnoId),
              parciales1: f.parciales1.map(aNota),
              parciales2: f.parciales2.map(aNota),
              valoracion1: (f.valoracion1.trim().toUpperCase() || null) as "TEA" | "TEP" | "TED" | null,
              calificacion1: aNota(f.calificacion1),
              inasistencias1: f.inasistencias1.trim() === "" ? null : n(f.inasistencias1),
              valoracion2: (f.valoracion2.trim().toUpperCase() || null) as "TEA" | "TEP" | "TED" | null,
              calificacion2: aNota(f.calificacion2),
              intensificacion1: aNota(f.intensificacion1),
              inasistencias2: f.inasistencias2.trim() === "" ? null : n(f.inasistencias2),
              baja: f.baja && !props.alumnos.find((a) => String(a.id) === f.alumnoId)?.baja,
              observacion: f.observacion.trim() || null,
            })),
        });
        setFilas(null);
        setMensaje({ ok: true, texto: `Listo: se importaron ${r.notas} notas y el cierre de la planilla${r.bajas ? ` (${r.bajas} ${r.bajas === 1 ? "quedó" : "quedaron"} de baja)` : ""}.` });
      } catch (e) {
        setMensaje({ ok: false, texto: e instanceof Error && e.message ? e.message : "No se pudo importar." });
      }
    });
  }

  const celda = (v: string, ok: boolean, onChange: (v: string) => void, label: string, ancho = "w-11") => (
    <input value={v} onChange={(e) => onChange(e.target.value)} inputMode="decimal" aria-label={label}
      className={`${ancho} rounded-md border bg-papel px-0.5 py-1 text-center text-sm font-semibold ${ok ? "border-borde" : "border-ausente text-ausente"}`} />
  );

  const configColumnas = (cu: 1 | 2) => {
    const cols = cu === 1 ? cols1 : cols2;
    const setCols = cu === 1 ? setCols1 : setCols2;
    const temasC = props.temas.filter((t) => t.cuatrimestre === cu);
    const usadas = [0, 1, 2, 3, 4].filter((k) => conValor(cu, k));
    if (!usadas.length) return <p className="text-xs text-texto-2">No hay notas parciales en el {cu}° cuatrimestre.</p>;
    return (
      <div className="space-y-2">
        {usadas.map((k) => (
          <div key={k} className="grid grid-cols-2 gap-2 text-sm">
            <span className="col-span-2 font-semibold">Casillero {k + 1}</span>
            <select value={cols[k].tipo} onChange={(e) => setCols((cs) => cs.map((c, j) => (j === k ? { ...c, tipo: e.target.value } : c)))} className="campo py-1.5" aria-label={`Tipo casillero ${k + 1} del ${cu}° C`}>
              {props.tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
              <option value={NO}>No importar</option>
            </select>
            {cols[k].tipo !== "examen" && cols[k].tipo !== NO ? (
              <select value={cols[k].tema} onChange={(e) => setCols((cs) => cs.map((c, j) => (j === k ? { ...c, tema: e.target.value } : c)))} className="campo py-1.5" aria-label={`Tema casillero ${k + 1} del ${cu}° C`}>
                <option value="nuevo">Tema nuevo: {nombres[cu].replace("{k}", String(k + 1))}</option>
                {temasC.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            ) : <span />}
          </div>
        ))}
        <label className="block text-xs text-texto-2">
          Nombre de los temas nuevos ({"{k}"} = número de casillero)
          <input value={nombres[cu]} onChange={(e) => setNombres((s) => ({ ...s, [cu]: e.target.value }))} className="campo mt-1 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-texto-2">
          Fecha para estas notas
          <input type="date" value={cu === 1 ? fecha1 : fecha2} onChange={(e) => (cu === 1 ? setFecha1 : setFecha2)(e.target.value)} className="campo mt-1 py-1.5 text-sm" />
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-8">
      <input ref={input} type="file" accept={ACEPTA} className="hidden" onChange={(e) => leer(e.target.files?.[0])} />

      {!filas && (
        <div className="tarjeta space-y-3 p-4 text-sm">
          <p>
            Sacale una foto a la planilla oficial de calificaciones que ya tenés completa, o subí una imagen o un PDF. Si son dos hojas, cargá una y después la otra.
          </p>
          <p className="text-texto-2">
            Se importan las notas parciales de los dos cuatrimestres (como notas de un tema), y la valoración, la calificación y las inasistencias como estaban en el papel. Todo se revisa antes de guardar.
          </p>
          <button type="button" onClick={() => input.current?.click()} disabled={leyendo} className="boton-primario w-full py-3 disabled:opacity-60">
            {leyendo ? "Leyendo la planilla… (puede tardar unos segundos)" : "📷 Sacar foto o subir imagen / PDF"}
          </button>
        </div>
      )}

      {filas && (
        <>
          <section className="tarjeta space-y-3 p-3">
            <p className="font-semibold">1° cuatrimestre</p>
            {configColumnas(1)}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cierre1} onChange={(e) => setCierre1(e.target.checked)} className="size-4" />
              Guardar valoración, calificación e inasistencias del 1° como cierre
            </label>
          </section>
          <section className="tarjeta space-y-3 p-3">
            <p className="font-semibold">2° cuatrimestre</p>
            {configColumnas(2)}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cierre2} onChange={(e) => setCierre2(e.target.checked)} className="size-4" />
              Guardar lo que haya de cierre del 2° (valoración, calificación, intensificación, inasistencias)
            </label>
          </section>

          <section>
            <h2 className="titulo-seccion">Lo que se leyó</h2>
            <p className="mb-2 text-xs text-texto-2">
              En <span className="rounded bg-tarde-bg px-1 text-tarde">amarillo</span>, filas dudosas; en rojo, valores que no sirven. Elegí el alumno de cada fila. Los tachados en el papel se marcan para dar de baja (se guarda lo que tenían).
            </p>
            <div className="tarjeta overflow-x-auto">
              <table className="text-sm">
                <thead className="text-[11px] text-texto-2">
                  <tr>
                    <th className="px-2 text-left">Alumno</th>
                    <th colSpan={5} className="border-l border-borde">1° C · parciales</th>
                    <th>Val.</th><th>Calif.</th><th>Inas.</th>
                    <th colSpan={5} className="border-l border-borde">2° C · parciales</th>
                    <th>Val.</th><th>Calif.</th><th>Int. 1°</th><th>Inas.</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className={`border-t border-borde ${f.dudoso ? "bg-tarde-bg" : ""}`}>
                      <td className="min-w-44 px-2 py-1">
                        <select value={f.alumnoId} onChange={(e) => set(i, { alumnoId: e.target.value })}
                          className={`w-full rounded-md border bg-papel px-1 py-1 text-sm ${repetidos.has(f.alumnoId) ? "border-ausente" : "border-borde"}`} aria-label={`Alumno de la fila ${i + 1}`}>
                          <option value={NO}>— no importar —</option>
                          {props.alumnos.map((a) => <option key={a.id} value={a.id}>{a.orden}. {a.apellido}, {a.nombre}{a.baja ? " (baja)" : ""}</option>)}
                        </select>
                        <span className={`block truncate text-[11px] text-texto-2 ${f.tachado ? "line-through" : ""}`}>leído: {[f.numero, f.nombre].filter(Boolean).join(" · ") || "?"}</span>
                        {f.observacion && <span className="block text-[11px] text-texto-2">anotación: {f.observacion}</span>}
                        {(f.tachado || f.baja) && f.alumnoId !== NO && (
                          <label className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ausente">
                            <input type="checkbox" checked={f.baja} onChange={(e) => set(i, { baja: e.target.checked })} className="size-3.5" />
                            Tachado: dar de baja
                          </label>
                        )}
                      </td>
                      {f.parciales1.map((v, k) => <td key={`a${k}`} className={k === 0 ? "border-l border-borde pl-1" : ""}>{celda(v, esNota(v), (x) => setParcial(i, 1, k, x), `1C parcial ${k + 1} fila ${i + 1}`)}</td>)}
                      <td>{celda(f.valoracion1, esVal(f.valoracion1), (x) => set(i, { valoracion1: x.toUpperCase() }), `Valoración 1C fila ${i + 1}`, "w-12")}</td>
                      <td>{celda(f.calificacion1, esNota(f.calificacion1), (x) => set(i, { calificacion1: x }), `Calificación 1C fila ${i + 1}`)}</td>
                      <td>{celda(f.inasistencias1, esIna(f.inasistencias1), (x) => set(i, { inasistencias1: x }), `Inasistencias 1C fila ${i + 1}`)}</td>
                      {f.parciales2.map((v, k) => <td key={`b${k}`} className={k === 0 ? "border-l border-borde pl-1" : ""}>{celda(v, esNota(v), (x) => setParcial(i, 2, k, x), `2C parcial ${k + 1} fila ${i + 1}`)}</td>)}
                      <td>{celda(f.valoracion2, esVal(f.valoracion2), (x) => set(i, { valoracion2: x.toUpperCase() }), `Valoración 2C fila ${i + 1}`, "w-12")}</td>
                      <td>{celda(f.calificacion2, esNota(f.calificacion2), (x) => set(i, { calificacion2: x }), `Calificación 2C fila ${i + 1}`)}</td>
                      <td>{celda(f.intensificacion1, esNota(f.intensificacion1), (x) => set(i, { intensificacion1: x }), `Intensificación fila ${i + 1}`)}</td>
                      <td className="pr-2">{celda(f.inasistencias2, esIna(f.inasistencias2), (x) => set(i, { inasistencias2: x }), `Inasistencias 2C fila ${i + 1}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => input.current?.click()} disabled={leyendo} className="mt-2 text-sm font-semibold text-tinta">
              {leyendo ? "Leyendo…" : "+ Sumar otra hoja de la planilla"}
            </button>
          </section>

          <div className="sticky bottom-20 z-10 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setFilas(null)} className="boton">Descartar</button>
            <button type="button" onClick={guardar} disabled={pendiente} className="boton-primario col-span-2 py-3 shadow-lg disabled:opacity-60">
              {pendiente ? "Importando…" : "Importar"}
            </button>
          </div>
        </>
      )}
      {mensaje && (
        <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>
          {mensaje.texto}{" "}
          {mensaje.ok && <Link href={`/materias/${props.asignacionId}/planilla`} className="font-semibold text-tinta">Ver la planilla</Link>}
        </p>
      )}
    </div>
  );
}
