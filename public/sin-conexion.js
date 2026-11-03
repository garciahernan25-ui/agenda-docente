// Agenda sin señal: tomar asistencia y cargar notas por tema con lo que el celu guardó la última vez que hubo internet.
// Lo cargado queda en la cola "agenda.pendientes" (mismas claves que src/lib/pendientes.ts) y se manda cuando vuelve la señal.
(function () {
  "use strict";
  var CLAVE_DATOS = "agenda.datos";
  var CLAVE_PENDIENTES = "agenda.pendientes";
  var CATEGORIAS = [
    ["participacion", "Particip."],
    ["desempeno", "Desemp."],
    ["tp_escrito", "TP escrito"],
    ["actividad_virtual", "Act. virtual"],
    ["oral", "Oral"],
    ["quiz", "Quiz"],
  ];
  var SIGUIENTE = { P: "A", A: "T", T: "J", J: "P" };
  var app = document.getElementById("app");

  function leer(clave, porDefecto) {
    try {
      var t = localStorage.getItem(clave);
      return t ? JSON.parse(t) : porDefecto;
    } catch (e) {
      return porDefecto;
    }
  }
  function cola() { return leer(CLAVE_PENDIENTES, []); }
  function encolar(item) {
    item.uid = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    item.creado = new Date().toISOString();
    var c = cola();
    c.push(item);
    try {
      localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(c));
      return true;
    } catch (e) {
      return false;
    }
  }
  function hoy() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  }
  function fechaLinda(iso) {
    var p = iso.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    var dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return dias[d.getUTCDay()] + " " + p[2] + " " + meses[p[1] - 1];
  }
  function cuatrimestreDe(iso) { return Number(iso.slice(5, 7)) >= 8 ? 2 : 1; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return String(Math.round(n * 10) / 10).replace(".", ","); }
  function num(v) { return Number(String(v).replace(",", ".")); }
  function valida(v) { return v === "" || (isFinite(num(v)) && num(v) >= 1 && num(v) <= 10); }

  function ir(ruta) {
    history.pushState(null, "", ruta);
    pintar();
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", pintar);
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-ir]");
    if (a) {
      e.preventDefault();
      ir(a.getAttribute("data-ir"));
    }
  });

  function aviso() {
    var n = cola().length;
    return '<div class="aviso' + (navigator.onLine ? " ok" : "") + '">' +
      (navigator.onLine ? "Parece que volvió la señal" : "Sin señal") + " · " +
      (n ? n + (n === 1 ? " cambio guardado" : " cambios guardados") + " en el celu" : "podés tomar asistencia y cargar notas") +
      ' <button class="boton" style="padding:3px 10px;margin-left:6px;font-size:12px" id="volver-app">Reintentar</button></div>';
  }
  // Solo cambia el cartelito de arriba (no borra lo que estás cargando)
  function refrescarAviso() {
    var av = document.querySelector(".aviso");
    if (av) {
      av.outerHTML = aviso();
      engancharVolver();
    }
  }
  function encabezado(titulo, sub, volver) {
    return aviso() + "<header>" + (volver ? '<button class="volver" data-ir="' + volver + '" aria-label="Volver">‹</button>' : "") +
      '<div><h1>' + esc(titulo) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div></header>";
  }

  var datos = leer(CLAVE_DATOS, null);

  function pintar() {
    var ruta = location.pathname.replace(/\/+$/, "") || "/";
    var m;
    if (!datos || !datos.materias) return sinDatos();
    if ((m = ruta.match(/^\/materias\/(\d+)\/asistencia$/))) return asistencia(Number(m[1]));
    if ((m = ruta.match(/^\/materias\/(\d+)\/temas$/))) return notas(Number(m[1]));
    if ((m = ruta.match(/^\/materias\/(\d+)$/))) return panel(Number(m[1]));
    if (ruta === "/" || ruta === "/materias") return inicio();
    return necesitaInternet();
  }

  function sinDatos() {
    app.innerHTML = encabezado("Sin señal", "") +
      '<div class="tarjeta vacio">Todavía no hay nada guardado en este celu para usar sin internet. Abrí la agenda una vez con señal (con tu contraseña) y ya queda lista.</div>' +
      '<div class="fijo"><button class="boton primario" onclick="location.reload()">Reintentar</button></div>';
    engancharVolver();
  }

  function necesitaInternet() {
    app.innerHTML = encabezado("Esto necesita internet", "Sin señal") +
      '<div class="tarjeta vacio">Sin señal podés tomar asistencia y cargar notas por tema. Las planillas, Cursos, planificación, proyectos y RITE se usan con internet.</div>' +
      '<div class="fijo"><button class="boton primario" data-ir="/">Ir a mis materias</button></div>';
    engancharVolver();
  }

  function materia(id) {
    for (var i = 0; i < datos.materias.length; i++) if (datos.materias[i].id === id) return datos.materias[i];
    return null;
  }

  function inicio() {
    var porEscuela = {};
    datos.materias.forEach(function (m) { (porEscuela[m.escuela] = porEscuela[m.escuela] || []).push(m); });
    var html = encabezado("Agenda docente", "Sin señal · datos del " + new Date(datos.generado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }));
    Object.keys(porEscuela).forEach(function (e) {
      html += "<h2>" + esc(e) + '</h2><div class="tarjeta">';
      porEscuela[e].forEach(function (m) {
        html += '<div class="fila"><div class="crece"><b>' + esc(m.grupo) + "</b> · " + esc(m.materia) + '<div class="chico">' + esc(m.turno) + "</div></div>" +
          '<button class="boton primario" data-ir="/materias/' + m.id + '">Ir</button></div>';
      });
      html += "</div>";
    });
    app.innerHTML = html;
    engancharVolver();
  }

  function panel(id) {
    var m = materia(id);
    if (!m) return necesitaInternet();
    app.innerHTML = encabezado(m.grupo + " · " + m.materia, m.escuela, "/") +
      '<div class="grilla2"><button class="boton primario" style="grid-column:span 2;padding:14px" data-ir="/materias/' + id + '/asistencia">Tomar asistencia</button>' +
      '<button class="boton" style="grid-column:span 2;padding:14px" data-ir="/materias/' + id + '/temas">Notas por tema</button></div>' +
      '<p class="chico" style="margin-top:16px">Sin señal solo están estas dos. Lo demás vuelve cuando haya internet.</p>';
    engancharVolver();
  }

  function asistencia(id) {
    var m = materia(id);
    if (!m) return necesitaInternet();
    var q = new URLSearchParams(location.search);
    var fecha = q.get("fecha") || hoy();
    // Si ya la cargaste sin señal para este día, la retoma
    var previa = null;
    cola().forEach(function (it) { if (it.tipo === "asistencia" && it.asignacionId === id && it.fecha === fecha) previa = it; });
    var estados = {};
    m.alumnos.forEach(function (a) { estados[a.id] = "P"; });
    var dictada = true;
    if (previa) {
      dictada = previa.dictada;
      previa.registros.forEach(function (r) { estados[r.inscripcionId] = r.estado; });
    }
    var temaId = previa && previa.temaId ? previa.temaId : null;

    function render(mensaje) {
      var cuenta = { P: 0, A: 0, T: 0, J: 0 };
      Object.keys(estados).forEach(function (k) { cuenta[estados[k]]++; });
      var html = encabezado("Asistencia", m.grupo + " · " + m.materia, "/materias/" + id) +
        '<div class="tarjeta" style="padding:12px;display:flex;gap:8px;align-items:center"><input type="date" id="fecha" class="campo" value="' + fecha + '" max="' + hoy() + '"></div>' +
        (previa ? '<p class="chico" style="margin:8px 4px">Ya la habías cargado sin señal: si guardás, se reemplaza.</p>' : "") +
        '<div class="tarjeta" style="margin-top:12px"><label class="chk">Hubo clase este día <input type="checkbox" id="dictada" ' + (dictada ? "checked" : "") + ' style="width:20px;height:20px"></label></div>';
      if (dictada) {
        var temasC = m.temas.filter(function (t) { return t.cuatrimestre === cuatrimestreDe(fecha); });
        if (temasC.length) {
          html += '<select id="tema" class="campo" style="margin-top:12px"><option value="">Tema de la clase (opcional)</option>' +
            temasC.map(function (t) { return '<option value="' + t.id + '"' + (t.id === temaId ? " selected" : "") + ">" + esc(t.titulo) + "</option>"; }).join("") + "</select>";
        }
        html += '<p class="chico" style="margin:12px 4px 6px">' + cuenta.P + " P · " + cuenta.A + " A · " + cuenta.T + " T · " + cuenta.J + " J — tocá para cambiar</p>";
        html += '<div class="tarjeta">' + (m.alumnos.length ? m.alumnos.map(function (a) {
          return '<div class="fila" style="padding:8px 12px"><span class="num">' + a.orden + '</span><span class="crece">' + esc(a.nombre) + "</span>" +
            '<button class="estado ' + estados[a.id] + '" data-alumno="' + a.id + '">' + estados[a.id] + "</button></div>";
        }).join("") : '<p class="vacio">No hay estudiantes activos.</p>') + "</div>";
      }
      html += '<div class="fijo"><button class="boton primario" id="guardar">Guardar en el celu</button>' + (mensaje ? '<p class="msj ok">' + mensaje + "</p>" : "") + "</div>";
      app.innerHTML = html;
      engancharVolver();
      document.getElementById("fecha").onchange = function (e) { if (e.target.value) ir("/materias/" + id + "/asistencia?fecha=" + e.target.value); };
      document.getElementById("dictada").onchange = function (e) { dictada = e.target.checked; render(); };
      var t = document.getElementById("tema");
      if (t) t.onchange = function (e) { temaId = e.target.value ? Number(e.target.value) : null; };
      Array.prototype.forEach.call(document.querySelectorAll("[data-alumno]"), function (b) {
        b.onclick = function () {
          var k = b.getAttribute("data-alumno");
          estados[k] = SIGUIENTE[estados[k]];
          render();
        };
      });
      document.getElementById("guardar").onclick = function () {
        var ok = encolar({
          tipo: "asistencia",
          descripcion: "Asistencia del " + fechaLinda(fecha) + " (" + m.grupo + " · " + m.materia + ")",
          asignacionId: id,
          fecha: fecha,
          dictada: dictada,
          temaId: dictada ? temaId : null,
          registros: Object.keys(estados).map(function (k) { return { inscripcionId: Number(k), estado: estados[k] }; }),
        });
        previa = true;
        render(ok ? "Guardada en el celu ✓ Se manda sola cuando vuelva la señal." : "No se pudo guardar en el celu (sin espacio).");
      };
    }
    render();
  }

  function notas(id) {
    var m = materia(id);
    if (!m) return necesitaInternet();
    var q = new URLSearchParams(location.search);
    var c = Number(q.get("c")) || cuatrimestreDe(hoy());
    var temasC = m.temas.filter(function (t) { return t.cuatrimestre === c; });
    var tId = Number(q.get("t")) || (temasC[0] && temasC[0].id) || null;
    var tema = null;
    temasC.forEach(function (t) { if (t.id === tId) tema = t; });

    var base = "/materias/" + id + "/temas?c=";
    var html = encabezado("Notas por tema", m.grupo + " · " + m.materia + " · " + c + "° cuatrimestre", "/materias/" + id) +
      '<div class="seg" style="margin-bottom:12px"><button data-ir="' + base + '1" class="' + (c === 1 ? "si" : "") + '">1° cuatrimestre</button><button data-ir="' + base + '2" class="' + (c === 2 ? "si" : "") + '">2° cuatrimestre</button></div>';
    if (!temasC.length) {
      app.innerHTML = html + '<div class="tarjeta vacio">No hay temas en este cuatrimestre. Los temas nuevos se crean con internet.</div>';
      return engancharVolver();
    }
    html += '<select id="tema" class="campo">' + temasC.map(function (t) {
      return '<option value="' + t.id + '"' + (tema && t.id === tema.id ? " selected" : "") + ">" + esc(t.titulo) + "</option>";
    }).join("") + "</select>";

    // Valor de cada casillero: lo que había + lo que ya cargaste sin señal para este tema
    var original = {};
    var varias = {};
    m.notas.forEach(function (n) {
      if (n.t !== tema.id) return;
      var k = n.i + "|" + n.c;
      if (k in original) varias[k] = true;
      original[k] = fmt(n.v);
    });
    Object.keys(varias).forEach(function (k) { original[k] = "varias"; });
    cola().forEach(function (it) {
      if (it.tipo !== "celdas" || it.asignacionId !== id || it.temaId !== tema.id) return;
      it.celdas.forEach(function (cel) {
        var k = cel.inscripcionId + "|" + cel.categoria;
        if (original[k] !== "varias") original[k] = cel.valor === null ? "" : fmt(cel.valor);
      });
    });

    html += '<div class="tarjeta tabla" style="margin-top:12px"><table><thead><tr><th class="nombre">Estudiante</th>' +
      CATEGORIAS.map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + "</tr></thead><tbody>" +
      m.alumnos.map(function (a) {
        return '<tr><td class="nombre">' + esc(a.nombre) + "</td>" + CATEGORIAS.map(function (x) {
          var k = a.id + "|" + x[0];
          if (original[k] === "varias") return '<td class="chico">varias</td>';
          return '<td><input inputmode="decimal" data-k="' + k + '" value="' + (original[k] || "") + '" aria-label="' + esc(a.nombre) + " " + x[1] + '"></td>';
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<label style="display:block;margin-top:12px"><span class="chico">Fecha de las notas nuevas</span><input type="date" id="fecha" class="campo" value="' + hoy() + '"></label>' +
      '<div class="fijo"><button class="boton primario" id="guardar">Guardar en el celu</button><p class="msj" id="msj"></p></div>';
    app.innerHTML = html;
    engancharVolver();
    document.getElementById("tema").onchange = function (e) { ir(base + c + "&t=" + e.target.value); };
    Array.prototype.forEach.call(document.querySelectorAll("[data-k]"), function (inp) {
      inp.oninput = function () {
        var k = inp.getAttribute("data-k");
        inp.classList.toggle("cambio", inp.value.trim() !== (original[k] || ""));
        inp.classList.toggle("mal", !valida(inp.value.trim()));
      };
    });
    document.getElementById("guardar").onclick = function () {
      var celdas = [];
      var mal = false;
      Array.prototype.forEach.call(document.querySelectorAll("[data-k]"), function (inp) {
        var k = inp.getAttribute("data-k");
        var v = inp.value.trim();
        if (v === (original[k] || "")) return;
        if (!valida(v)) { mal = true; return; }
        var p = k.split("|");
        celdas.push({ inscripcionId: Number(p[0]), categoria: p[1], valor: v === "" ? null : Math.round(num(v) * 10) / 10 });
      });
      var msj = document.getElementById("msj");
      if (mal) { msj.className = "msj mal"; msj.textContent = "Hay notas fuera de 1 a 10."; return; }
      if (!celdas.length) { msj.className = "msj"; msj.textContent = "No cambiaste ninguna nota."; return; }
      var ok = encolar({
        tipo: "celdas",
        descripcion: "Notas de “" + tema.titulo + "” (" + m.grupo + " · " + m.materia + ")",
        asignacionId: id,
        temaId: tema.id,
        fecha: document.getElementById("fecha").value || hoy(),
        celdas: celdas,
      });
      celdas.forEach(function (cel) { original[cel.inscripcionId + "|" + cel.categoria] = cel.valor === null ? "" : fmt(cel.valor); });
      Array.prototype.forEach.call(document.querySelectorAll(".cambio"), function (i) { i.classList.remove("cambio"); });
      msj.className = ok ? "msj ok" : "msj mal";
      msj.textContent = ok ? "Guardadas en el celu ✓ Se mandan solas cuando vuelva la señal." : "No se pudo guardar en el celu (sin espacio).";
      refrescarAviso();
    };
  }

  function engancharVolver() {
    var b = document.getElementById("volver-app");
    if (b) b.onclick = function () { location.reload(); };
  }
  window.addEventListener("online", refrescarAviso);
  window.addEventListener("offline", refrescarAviso);
  pintar();
})();
