// Pruebas del lector de GPX. Se ejecutan con: node --test pruebas/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { analizarGpx, resumenEnPalabras } = require("../gpx.js");

const ejemplo = fs.readFileSync(path.join(__dirname, "ejemplo.gpx"), "utf8");

function gpx(cuerpo) {
  return '<?xml version="1.0"?><gpx version="1.1">' + cuerpo + "</gpx>";
}

test("ruta de ejemplo: distancia 111,195 km (1° de latitud)", () => {
  const r = analizarGpx(ejemplo);
  assert.ok(Math.abs(r.distanciaKm - 111.195) < 0.01, "salió " + r.distanciaKm);
});

test("ruta de ejemplo: desnivel positivo 165 m", () => {
  assert.equal(analizarGpx(ejemplo).desnivelPositivoM, 165);
});

test("ruta de ejemplo: nombre del track, no el de metadatos", () => {
  assert.equal(analizarGpx(ejemplo).nombre, "Vuelta de prueba & café");
});

test("ruta de ejemplo: frase en palabras sencillas", () => {
  assert.equal(
    resumenEnPalabras(analizarGpx(ejemplo)),
    "Tu ruta se llama «Vuelta de prueba & café». Mide 111,2 km y sube 165 m de desnivel positivo."
  );
});

test("acepta lon antes que lat y comillas simples", () => {
  const r = analizarGpx(gpx(
    "<trk><trkseg><trkpt lon='0' lat='0'/><trkpt lon='0' lat='0.1'/></trkseg></trk>"
  ));
  assert.ok(Math.abs(r.distanciaKm - 11.1195) < 0.001);
});

test("sin altitudes: no inventa desnivel", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.1" lon="0"/></trkseg></trk>'
  ));
  assert.equal(r.desnivelPositivoM, null);
  assert.match(resumenEnPalabras(r), /no trae altitudes/);
});

test("dos tramos: no suma el salto entre ellos", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.1" lon="0"/></trkseg>' +
    '<trkseg><trkpt lat="10" lon="0"/><trkpt lat="10.1" lon="0"/></trkseg></trk>'
  ));
  assert.ok(Math.abs(r.distanciaKm - 2 * 11.1195) < 0.001);
});

test("ruta planificada (rtept) también vale", () => {
  const r = analizarGpx(gpx(
    '<rte><name>Ruta Garmin</name><rtept lat="0" lon="0"/><rtept lat="0.1" lon="0"/></rte>'
  ));
  assert.equal(r.nombre, "Ruta Garmin");
});

test("sin nombre: lo dice", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.1" lon="0"/></trkseg></trk>'
  ));
  assert.equal(r.nombre, "Sin nombre");
});

test("perfil: un punto por cada altitud, empezando en el km 0", () => {
  const r = analizarGpx(ejemplo);
  assert.equal(r.perfil.length, 11);
  assert.equal(r.perfil[0].km, 0);
  assert.equal(r.perfil[0].ele, 100);
  assert.ok(Math.abs(r.perfil[10].km - 111.195) < 0.01);
});

test("perfil: punto más alto 230 m al final (km 111,2)", () => {
  const r = analizarGpx(ejemplo);
  assert.equal(r.puntoMasAlto.ele, 230);
  assert.ok(Math.abs(r.puntoMasAlto.km - 111.195) < 0.01);
});

test("perfil: punto más bajo 100 m en la salida (km 0)", () => {
  const r = analizarGpx(ejemplo);
  assert.equal(r.puntoMasBajo.ele, 100);
  assert.equal(r.puntoMasBajo.km, 0);
});

test("perfil: si la altitud máxima se repite, marca la primera", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"><ele>100</ele></trkpt>' +
    '<trkpt lat="0.1" lon="0"><ele>200</ele></trkpt>' +
    '<trkpt lat="0.2" lon="0"><ele>200</ele></trkpt></trkseg></trk>'
  ));
  assert.ok(Math.abs(r.puntoMasAlto.km - 11.1195) < 0.001);
});

test("perfil: con dos tramos los km siguen sin saltos", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"><ele>1</ele></trkpt><trkpt lat="0.1" lon="0"><ele>2</ele></trkpt></trkseg>' +
    '<trkseg><trkpt lat="10" lon="0"><ele>3</ele></trkpt><trkpt lat="10.1" lon="0"><ele>4</ele></trkpt></trkseg></trk>'
  ));
  assert.ok(Math.abs(r.perfil[2].km - 11.1195) < 0.001);
  assert.ok(Math.abs(r.perfil[3].km - 2 * 11.1195) < 0.001);
});

test("perfil: sin altitudes no hay perfil ni puntos marcados", () => {
  const r = analizarGpx(gpx(
    '<trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.1" lon="0"/></trkseg></trk>'
  ));
  assert.deepEqual(r.perfil, []);
  assert.equal(r.puntoMasAlto, null);
  assert.equal(r.puntoMasBajo, null);
});

// Aviso de ruta planificada (altitud de mapa de relieve).
const dosPuntos = (atributosGpx, hora) =>
  "<gpx " + atributosGpx + "><trk><trkseg>" +
  '<trkpt lat="0" lon="0"><ele>100</ele>' + (hora ? "<time>2026-06-04T06:00:00Z</time>" : "") + "</trkpt>" +
  '<trkpt lat="0.1" lon="0"><ele>120</ele>' + (hora ? "<time>2026-06-04T06:10:00Z</time>" : "") + "</trkpt>" +
  "</trkseg></trk></gpx>";

test("aviso: ruta de un planificador sin hora (como Map Plus) → avisa", () => {
  assert.equal(analizarGpx(dosPuntos('creator="Map Plus 2.9.2"', false)).altitudPlanificada, true);
});

test("aviso: exportada de Strava sin hora → no avisa", () => {
  assert.equal(analizarGpx(dosPuntos('creator="StravaGPX"', false)).altitudPlanificada, false);
});

test("aviso: exportada de Garmin Connect sin hora → no avisa", () => {
  assert.equal(analizarGpx(dosPuntos('creator="Garmin Connect"', false)).altitudPlanificada, false);
});

test("aviso: actividad grabada (con hora) de cualquier app → no avisa", () => {
  assert.equal(analizarGpx(dosPuntos('creator="Map Plus 2.9.2"', true)).altitudPlanificada, false);
});

test("aviso: sin altitudes no hay nada que avisar", () => {
  const r = analizarGpx('<gpx creator="Otro"><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.1" lon="0"/></trkseg></trk></gpx>');
  assert.equal(r.altitudPlanificada, false);
});

test("archivo que no es GPX: avisa", () => {
  assert.throws(() => analizarGpx("hola"), /no parece un GPX/);
});

test("GPX con un solo punto: avisa", () => {
  assert.throws(
    () => analizarGpx(gpx('<trk><trkseg><trkpt lat="0" lon="0"/></trkseg></trk>')),
    /puntos suficientes/
  );
});
