"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { mandarFoto } from "@/lib/foto-cliente";
import { normal, parecidoFlexible as parecido } from "@/lib/nombres";
import { guardarNotas } from "../../acciones";

type Alumno = { id: number; orden: number; apellido: string; nombre: string };
type Planilla = { columnas: string[]; filas: { numero: string; nombre: string; valores: string[]; dudoso: boolean }[] };
type Columna = { encabezado: string; tipo: string; temaId: string; fecha: string };
type Fila = { leido: string; alumnoId: string; valores: string[]; dudoso: boolean };

const NO = "__no__";
const num = (v: string) => Number(v.replace(",", "."));
const valida = (v: string) => v === "" || (/^\d{1,2}([.,]\d+)?$/.test(v.trim()) && num(v) >= 1 && num(v) <= 10);

// "12/9", "12-09" → fecha ISO del año en curso
function fechaDeEncabezado(t: string, hoy: string) {
  const m = t.match(/(\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
  return `${hoy.slice(0, 4)}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function NotasDesdeFoto(props: {
  asignacionId: number;
  hoy: string;
  cuatrimestreInicial: 1 | 2;
  alumnos: Alumno[];
  temas: { id: number; titulo: string; cuatrimestre: 1 | 2 }[];
  tipos: { clave: string; nombre: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [c, setC] = useState<1 | 2>(props.cuatrimestreInicial);
  const [leyendo, setLeyendo] = useState(false);
  const [columnas, setColumnas] = useState<Columna[] | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const temasC = props.temas.filter((t) => t.cuatrimestre === c);
  const noExamen = props.tipos.filter((t) => t.clave !== "examen");

  // Tipo sugerido por el encabezado ("TP 1" → TP escrito, "Exam" → examen…)
  function tipoSugerido(enc: string) {
    const e = normal(enc);
    if (/exam|prueba|evaluacion|parcial/.test(e)) return "examen";
    const igual = props.tipos.find((t) => e && (normal(t.nombre).includes(e) || e.includes(normal(t.nombre).split(" ")[0])));
    if (igual) return igual.clave;
    if (/\btp\b|practico/.test(e)) return props.tipos.find((t) => t.clave === "tp_escrito")?.clave ?? noExamen[0]?.clave ?? NO;
    if (/oral/.test(e)) return props.tipos.find((t) => t.clave === "oral")?.clave ?? noExamen[0]?.clave ?? NO;
    return props.tipos.find((t) => t.clave === "tp_escrito")?.clave ?? noExamen[0]?.clave ?? NO;
  }

  // A qué alumno de la lista corresponde cada fila leída: por número de orden y nombre, o por nombre
  function emparejar(numero: string, nombre: string) {
    const porNombre = props.alumnos
      .map((a) => ({ a, p: parecido(nombre, a.apellido, a.nombre) }))
      .filter((x) => x.p >= 0.6)
      .sort((x, y) => y.p - x.p);
    const n = Number(numero);
    const porNumero = n ? props.alumnos.find((a) => a.orden === n) : undefined;
    if (porNumero && (!nombre || parecido(nombre, porNumero.apellido, porNumero.nombre) >= 0.6)) return String(porNumero.id);
    if (porNombre[0] && (porNombre.length === 1 || porNombre[0].p > porNombre[1].p)) return String(porNombre[0].a.id);
    if (porNumero && !nombre) return String(porNumero.id);
    return NO;
  }

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);
    setLeyendo(true);
    const r = await mandarFoto<{ planilla: Planilla }>("/api/foto/notas", archivo);
    setLeyendo(false);
    if (input.current) input.current.value = "";
    if (!r.ok) return setMensaje({ ok: false, texto: r.mensaje });
    const p = r.datos.planilla;
    const ultimoTema = temasC.at(-1)?.id;
    setColumnas(
      p.columnas.map((enc) => ({
        encabezado: enc,
        tipo: tipoSugerido(enc),
        temaId: ultimoTema ? String(ultimoTema) : "",
        fecha: fechaDeEncabezado(enc, props.hoy) ?? props.hoy,
      })),
    );
    setFilas(p.filas.map((f) => ({ leido: [f.numero, f.nombre].filter(Boolean).join(" · "), alumnoId: emparejar(f.numero, f.nombre), valores: f.valores, dudoso: f.dudoso })));
  }

  const cambiarCol = (i: number, cambio: Partial<Columna>) => setColumnas((cs) => cs!.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const cambiarFila = (i: number, cambio: Partial<Fila>) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const cambiarValor = (i: number, k: number, v: string) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, valores: x.valores.map((y, m) => (m === k ? v : y)) } : x)));

  const repetidos = new Set(filas.map((f) => f.alumnoId).filter((id, i, arr) => id !== NO && arr.indexOf(id) !== i));
  const invalidas = filas.some((f) => f.alumnoId !== NO && f.valores.some((v, k) => columnas?.[k]?.tipo !== NO && !valida(v)));

  function guardar() {
    if (!columnas) return;
    if (repetidos.size) return setMensaje({ ok: false, texto: "Hay dos filas con el mismo alumno. Corregilo antes de guardar." });
    if (invalidas) return setMensaje({ ok: false, texto: "Hay notas que no son un número de 1 a 10 (en rojo). Corregilas o borralas." });
    const lotes = columnas
      .map((col, k) => ({ col, valores: filas.filter((f) => f.alumnoId !== NO && f.valores[k].trim() !== "").map((f) => ({ inscripcionId: Number(f.alumnoId), valor: num(f.valores[k]) })) }))
      .filter((l) => l.col.tipo !== NO && l.valores.length);
    if (!lotes.length) return setMensaje({ ok: false, texto: "No hay notas para guardar." });
    if (lotes.some((l) => l.col.tipo !== "examen" && !l.col.temaId)) return setMensaje({ ok: false, texto: "Elegí el tema de cada columna (salvo el examen)." });
    iniciar(async () => {
      try {
        let total = 0;
        for (const l of lotes) {
          const r = await guardarNotas({
            asignacionId: props.asignacionId,
            cuatrimestre: c,
            categoria: l.col.tipo,
            temaId: l.col.tipo === "examen" ? null : Number(l.col.temaId),
            fecha: l.col.fecha,
            valores: l.valores,
          });
          total += r.cantidad;
        }
        setColumnas(null);
        setFilas([]);
        setMensaje({ ok: true, texto: `Listo: se guardaron ${total} notas.` });
      } catch {
        setMensaje({ ok: false, texto: "No se pudieron guardar. Revisá los datos y probá de nuevo." });
      }
    });
  }

  return (
    <div className="space-y-4 pb-8">
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => leer(e.target.files?.[0])} />

      {!columnas && (
        <div className="tarjeta space-y-3 p-4 text-sm">
          <p>Sacale una foto a tu planilla de notas en papel: de frente, con buena luz y que se vean los nombres y todas las columnas. Después revisás todo antes de guardar.</p>
          <div className="flex rounded-xl border border-borde bg-hoja p-0.5 font-semibold">
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" onClick={() => setC(n)} className={`flex-1 rounded-lg px-3 py-1.5 ${c === n ? "bg-tinta text-hoja" : "text-texto-2"}`}>
                {n}° cuatrimestre
              </button>
            ))}
          </div>
          <button type="button" onClick={() => input.current?.click()} disabled={leyendo} className="boton-primario w-full py-3 disabled:opacity-60">
            {leyendo ? "Leyendo la planilla… (puede tardar unos segundos)" : "📷 Sacar o elegir foto"}
          </button>
          {temasC.length === 0 && (
            <p className="text-xs text-texto-2">
              Este cuatrimestre no tiene temas. Las notas van a un tema (salvo el examen):{" "}
              <Link href={`/materias/${props.asignacionId}/temas?c=${c}`} className="font-semibold text-tinta">creá los temas primero</Link>.
            </p>
          )}
        </div>
      )}

      {columnas && (
        <>
          <section className="space-y-2">
            <h2 className="titulo-seccion">Qué es cada columna</h2>
            {columnas.map((col, i) => (
              <div key={i} className="tarjeta grid grid-cols-2 gap-2 p-3 text-sm">
                <p className="col-span-2 font-semibold">
                  Columna {i + 1}
                  {col.encabezado && <span className="font-normal text-texto-2"> · “{col.encabezado}”</span>}
                </p>
                <select value={col.tipo} onChange={(e) => cambiarCol(i, { tipo: e.target.value })} className="campo py-2" aria-label={`Tipo de la columna ${i + 1}`}>
                  {props.tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
                  <option value={NO}>No cargar esta columna</option>
                </select>
                <input type="date" value={col.fecha} onChange={(e) => cambiarCol(i, { fecha: e.target.value })} className="campo py-2" aria-label={`Fecha de la columna ${i + 1}`} />
                {col.tipo !== "examen" && col.tipo !== NO && (
                  <select value={col.temaId} onChange={(e) => cambiarCol(i, { temaId: e.target.value })} className="campo col-span-2 py-2" aria-label={`Tema de la columna ${i + 1}`}>
                    <option value="">Elegí el tema…</option>
                    {temasC.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                  </select>
                )}
              </div>
            ))}
          </section>

          <section>
            <h2 className="titulo-seccion">Notas leídas</h2>
            <p className="mb-2 text-xs text-texto-2">
              En <span className="rounded bg-tarde-bg px-1 text-tarde">amarillo</span>, filas que no se leían bien. Elegí el alumno de cada fila y corregí las notas que haga falta.
            </p>
            <div className="tarjeta overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-texto-2">
                    <th className="px-2 py-1.5 text-left">Alumno</th>
                    {columnas.map((_, k) => <th key={k} className="px-1">{k + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className={`border-t border-borde ${f.dudoso ? "bg-tarde-bg" : ""}`}>
                      <td className="min-w-40 px-2 py-1.5">
                        <select
                          value={f.alumnoId}
                          onChange={(e) => cambiarFila(i, { alumnoId: e.target.value })}
                          className={`w-full rounded-lg border bg-papel px-1 py-1 text-sm ${repetidos.has(f.alumnoId) ? "border-ausente" : "border-borde"}`}
                          aria-label={`Alumno de la fila ${i + 1}`}
                        >
                          <option value={NO}>— no cargar —</option>
                          {props.alumnos.map((a) => <option key={a.id} value={a.id}>{a.orden}. {a.apellido}, {a.nombre}</option>)}
                        </select>
                        <span className="block truncate text-[11px] text-texto-2">leído: {f.leido || "?"}</span>
                      </td>
                      {f.valores.map((v, k) => (
                        <td key={k} className="px-1 text-center">
                          <input
                            value={v}
                            onChange={(e) => cambiarValor(i, k, e.target.value)}
                            inputMode="decimal"
                            disabled={columnas[k].tipo === NO || f.alumnoId === NO}
                            className={`w-12 rounded-lg border bg-papel px-1 py-1 text-center font-semibold disabled:opacity-40 ${valida(v) ? "border-borde" : "border-ausente text-ausente"}`}
                            aria-label={`Nota columna ${k + 1}, fila ${i + 1}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="sticky bottom-20 z-10 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { setColumnas(null); setFilas([]); }} className="boton">Descartar</button>
            <button type="button" onClick={guardar} disabled={pendiente} className="boton-primario col-span-2 py-3 shadow-lg disabled:opacity-60">
              {pendiente ? "Guardando…" : "Guardar notas"}
            </button>
          </div>
        </>
      )}
      {mensaje && (
        <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>
          {mensaje.texto}{" "}
          {mensaje.ok && <Link href={`/materias/${props.asignacionId}/temas?c=${c}`} className="font-semibold text-tinta">Ver notas por tema</Link>}
        </p>
      )}
    </div>
  );
}
