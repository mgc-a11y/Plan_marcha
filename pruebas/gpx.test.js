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

test("archivo que no es GPX: avisa", () => {
  assert.throws(() => analizarGpx("hola"), /no parece un GPX/);
});

test("GPX con un solo punto: avisa", () => {
  assert.throws(
    () => analizarGpx(gpx('<trk><trkseg><trkpt lat="0" lon="0"/></trkseg></trk>')),
    /puntos suficientes/
  );
});
