# Agenda docente

App para llevar notas, asistencia y seguimiento de mis cursos, y bajar las planillas en PDF.
Next.js + TypeScript + Turso (SQLite) + Drizzle. Después se empaqueta como APK con Capacitor.

## Cómo está organizada

- **Jerarquía**: Modalidad › Escuela › Curso (año y ciclo lectivo) › División (sección, turno, preceptor/a).
- **Asignación**: una materia que doy en una división. Cada asignación tiene su planilla de calificaciones.
- **Inscripción**: un alumno en una división, con su N° de orden, cursa/recursa y estado (activo o baja).
  La planilla oficial no permite tachar, así que una baja sigue impresa en su fila; solo deja de contar en totales y promedios.
- **Clases**: una por fecha, con cuatrimestre, tema y si se dictó o no.
- **Asistencia**: P presente, A ausente, T tarde (media falta), J justificada (queda registrada, no suma falta).
- **Notas**: por tema y categoría (participación, desempeño, TP escrito, actividad virtual, oral, quiz, examen), escala 1 a 10.
  Las de quiz llegan desde quizzes-profe-nacho con `origen = "quiz"`.
- **Pesos**: cuánto vale cada categoría en la calificación del cuatrimestre, configurable por asignación.
  Si una categoría todavía no tiene notas, su peso se reparte entre las demás.
- **Cierres**: lo que confirmo para la planilla oficial (valoraciones, calificaciones, intensificación, diciembre, febrero, final).
  Si una calificación no está confirmada, la planilla usa la calculada.

## Calendario

- **Eventos** con tipo (examen, feria, cierre de notas, intensificación, valoración preliminar, reunión, acto, sin clases, otro),
  fecha o rango de fechas, hora opcional, nota y aviso opcional N días antes.
- Se asocian a una materia de un curso, a una escuela, o a nada (eventos generales como la feria ACTE).
- **Repetición**: todo evento arranca sin repetir; se puede elegir semanal, quincenal o mensual, con fecha de corte.
  Una fecha puntual de la serie se puede cancelar o mover sin tocar el resto (`eventos_excepciones`).
- Los días marcados como **sin clases** dejan esas clases como no dictadas en la asistencia.
- La nota de un examen puede quedar vinculada a su evento (`notas_evento`).

API:

- `GET /api/eventos?desde=2026-11-01&hasta=2026-11-30` → las fechas concretas del rango, ya expandidas.
  Sin parámetros devuelve los próximos 30 días.
- `POST /api/eventos` → crea un evento. Ejemplo:
  `{ "titulo": "Reunión de departamento", "tipo": "reunion", "fechaInicio": "2026-11-03", "horaInicio": "14:00", "repeticion": "semanal", "repetirHasta": "2026-12-15" }`

## Planillas en PDF

- `GET /api/asignaciones/:id/planilla-calificaciones` → planilla oficial DGCyE (modelo 2.1). Usa el PDF original
  (`src/pdf/plantillas/planilla-calificaciones.pdf`) como fondo y escribe los datos encima, así sale idéntica.
- `GET /api/asignaciones/:id/planilla-asistencia?cuatrimestre=1` → fechas en columnas, alumnos en filas,
  inasistencias y % por alumno, % de presentes por clase y promedio del curso. Los % menores a 75 salen en rojo.

Casilleros de "calificaciones parciales" (5 por cuatrimestre): uno por tema con el promedio de sus notas y el examen al final.
Si hay más temas que casilleros, se agrupan temas seguidos.

## Pantallas

- **Inicio**: lo agendado para las próximas dos semanas y tus cursos agrupados por escuela, con acceso directo a la asistencia.
- **Materia**: alumnos con % de asistencia, valoración y nota (confirmada o calculada), por cuatrimestre.
- **Tomar asistencia**: arranca con todos presentes; tocás al alumno para pasar a A, T, J; mantenés apretado para elegir directo.
  Se puede marcar que no hubo clase, elegir el tema y corregir días anteriores. Si el calendario dice "sin clases", ya viene destildado.
- **Cargar notas**: elegís qué evaluás, el tema (o creás uno nuevo) y la fecha, y cargás la nota de cada uno. Enter pasa al siguiente.
- **Ficha del alumno**: promedio por parte con su peso, notas por tema (con botón para borrar) y asistencia clase por clase.
- **Cierre**: propone la valoración (con las notas de los dos primeros meses) y la calificación (promedio ponderado);
  "Completar los vacíos" rellena lo que falte sin pisar lo que ya pusiste. En el 2° cuatrimestre suma intensificación, diciembre, febrero y final.
- **Notas por tema**: elegís o creás un tema y cargás una grilla con todos los alumnos y todas las formas de evaluar
  (participación, desempeño, TP escrito, actividad virtual, oral, quiz), con el promedio del tema en vivo.
  Ese promedio es el casillero del tema en la planilla oficial. "Cargar por tipo" sigue para cargar una sola cosa rápido.
- **Planilla de notas**: la planilla oficial en pantalla (valoraciones, calificaciones, intensificación, diciembre, febrero, final),
  editable casillero por casillero, con los totales en vivo. En gris lo que propone la app y todavía no confirmaste.
  Botones para ver e imprimir el PDF, descargarlo y abrir los de asistencia.
- **Corregir notas**: desde "Cargar notas" tocás una tanda ya cargada para cambiar valores, borrar, sumar a quien faltó
  o moverla a otra fecha, parte o tema; desde la ficha del alumno tocás una nota para corregirla.
- **Calendario**: vista de mes con puntos por tipo, lista del mes o del día, alta de eventos con repetición opcional,
  sacar una fecha de una serie o borrarla entera.
- **Cursos**: modalidad › escuela › curso › división; en cada división, datos, materias (con pesos y clases previstas) y alumnos
  (pegar la lista, cursa/recursa, baja, observación).

## EPS

- La modalidad tiene un formato: **Secundaria común** (planilla de calificaciones DGCyE) o **EPS** (RITE + Plan formativo).
  Se elige al crearla o después, en Cursos.
- En la EPS el curso se carga como nivel (ej. "III-IV") y cada estudiante tiene su nivel (1 a 4) y el mes/año en que empezó.
- En la materia se completa el encabezado: área, familia profesional, región, sede, CFP que articula, oferta y correo.
- **RITE** (por área): informe contextual, primer y segundo informe (el número va en la columna TEA, TEP o TED), valoración
  final y observaciones por estudiante. Se completa con lo que ya cargaste y se puede corregir todo.
- **Plan de trabajo formativo** (uno por estudiante): la fila de Ciencias Naturales con 5 casilleros por nivel.
  "Completar con las notas" llena el nivel actual con el promedio de cada tema y el examen.
- Las dos tienen **Vista para el Drive** (réplica de solo lectura, con atributos `data-planilla` para que un agente la
  encuentre) y botones **Copiar** que dejan los datos separados por tabulaciones para pegar directo en Google Sheets.

## Primeros pasos

```bash
npm install
npm run clave -- "tu contraseña"   # imprime AGENDA_CLAVE_HASH y SESSION_SECRET
# copiá .env.example a .env.local y pegá esas dos líneas (más DOCENTE_NOMBRE)
npm run db:migrate                 # crea local.db con las tablas
npm run db:seed                    # carga 2° C de Fisicoquímica (EES N° 52) como ejemplo (¡borra todo!)
npm run dev                        # http://localhost:3000
```

### Login

Un solo docente, una contraseña. Se guarda solo el hash (scrypt) en `AGENDA_CLAVE_HASH`; la sesión es una cookie firmada
con `SESSION_SECRET` que dura 30 días. Todas las páginas, acciones y rutas de API exigen sesión. Después de 5 intentos
fallidos se bloquea un minuto.

### Subir a Vercel

1. Crear la base en Turso y correr `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate`.
2. En Vercel cargar `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AGENDA_CLAVE_HASH`, `SESSION_SECRET` y `DOCENTE_NOMBRE`.
3. No correr `db:seed` contra la base de producción: borra todo.

Otros comandos:

```bash
npm test                # tests de cálculos, calendario, sesión y contraseña
npm run pdf:prueba      # genera PDFs con datos inventados en ./salida
npm run db:generate     # nueva migración después de tocar src/db/schema.ts
```

Para usar Turso en vez de la base local, copiá `.env.example` a `.env.local` y completá
`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.

## Pendiente

1. API en quizzes-profe-nacho para traer los puntajes de los quizzes.
2. Modo offline (PWA): tomar asistencia y cargar notas sin señal, y sincronizar al volver.
3. APK con Capacitor y avisos en el celu para los eventos con "avisarme".
4. Editar un evento ya creado y mover una fecha puntual de una serie (hoy se puede sacar o borrar).
