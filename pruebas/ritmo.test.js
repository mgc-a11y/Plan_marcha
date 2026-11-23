// Pruebas del cálculo de ritmo. Cada una se puede comprobar a mano.
// Se ejecutan con: node --test pruebas/
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  potenciaNecesaria, velocidadParaPotencia, dividirEnTramos, estimarRuta, formatoDuracion, TIPOS_BAJADOR
} = require("../ritmo.js");

const cerca = (a, b, tol, txt) => assert.ok(Math.abs(a - b) < tol, (txt || "") + " salió " + a + ", esperaba " + b);

// Modelo simplificado "solo aire": densidad 1,2, CdA 0,5, sin rodadura ni pérdidas.
// A mano: potencia = 0,5 × 1,2 × 0,5 × v³ = 0,3 × v³  →  a 10 m/s hacen falta 300 W.
const soloAire = { densidadAire: 1.2, cda: 0.5, crr: 0, eficiencia: 1, fraccionSubida: 1, fraccionLlano: 1 };

test("solo aire: a 10 m/s (36 km/h) hacen falta 300 W", () => {
  cerca(potenciaNecesaria(10, 0, 80, soloAire), 300, 1e-9);
});

test("solo aire: con 300 W se va a 10 m/s (36 km/h)", () => {
  cerca(velocidadParaPotencia(300, 0, 80, soloAire), 10, 1e-6);
});

test("tramo llano de 10 km a 36 km/h: 1000 s (16 min 40 s)", () => {
  const r = estimarRuta({ distanciaKm: 10, perfil: [] }, { ftp: 300, pesoKg: 72, gramosHora: 60 }, soloAire);
  cerca(r.segundosTotales, 1000, 1e-3);
  cerca(r.velocidadMediaKmh, 36, 1e-6);
});

test("hidratos: 90 km a 36 km/h = 2,5 h × 60 g/h = 150 g", () => {
  const r = estimarRuta({ distanciaKm: 90, perfil: [] }, { ftp: 300, pesoKg: 72, gramosHora: 60 }, soloAire);
  cerca(r.segundosTotales, 9000, 1e-2);
  cerca(r.hidratosTotalesG, 150, 1e-3);
  assert.equal(formatoDuracion(r.segundosTotales), "2 h 30 min");
});

test("solo gravedad: 100 kg, 10 %, 2 m/s → 100 × 10 × 0,0995 × 2 = 199,0 W", () => {
  // sin(atan(0,10)) = 0,10 / √1,01 = 0,0995037
  const s = { gravedad: 10, crr: 0, cda: 0, eficiencia: 1 };
  cerca(potenciaNecesaria(2, 0.10, 100, s), 199.0074, 1e-3);
});

test("solo rodadura: 0,005 × 80 kg × 10 × 5 m/s = 20 W", () => {
  const s = { gravedad: 10, crr: 0.005, cda: 0, eficiencia: 1 };
  cerca(potenciaNecesaria(5, 0, 80, s), 20, 1e-9);
});

test("valores reales, llano, 78 kg a 36 km/h: (196 + 30,6) ÷ 0,97698 = 231,9 W", () => {
  // Aire: 0,5 × 1,225 × 0,32 × 10³ = 196 W. Rodadura: 0,004 × 78 × 9,80665 × 10 = 30,6 W.
  cerca(potenciaNecesaria(10, 0, 78), 231.94, 0.01);
  cerca(velocidadParaPotencia(231.94, 0, 78), 10, 1e-3);
});

test("bajada fuerte: por defecto (bajador medio) no pasa de 65 km/h", () => {
  cerca(velocidadParaPotencia(150, -0.10, 78) * 3.6, 65, 1e-9);
});

// Ruta de 1 km de bajada al 10 %: con cualquier tope, la cuesta lleva al tope.
const bajada1km = { distanciaKm: 1, perfil: [{ km: 0, ele: 100 }, { km: 1, ele: 0 }] };
const datosBase = { ftp: 250, pesoKg: 70, gramosHora: 60 };

test("bajadores: bueno 75 km/h, medio 65 km/h, malo 55 km/h", () => {
  assert.equal(TIPOS_BAJADOR.bueno.velocidadMaxKmh, 75);
  assert.equal(TIPOS_BAJADOR.medio.velocidadMaxKmh, 65);
  assert.equal(TIPOS_BAJADOR.malo.velocidadMaxKmh, 55);
});

test("buen bajador: 1 km de bajada al 15 % a 75 km/h = 48 s", () => {
  // A mano: 1000 m ÷ (75 ÷ 3,6) m/s = 48 s
  const bajada15 = { distanciaKm: 1, perfil: [{ km: 0, ele: 150 }, { km: 1, ele: 0 }] };
  const r = estimarRuta(bajada15, { ...datosBase, bajador: "bueno" }, { tramoM: 1000 });
  cerca(r.segundosTotales, 48, 1e-6);
});

test("buen bajador al 10 %: el aire frena antes de llegar a 75 km/h", () => {
  // Con 78 kg y 175 W, al 10 % la física da unos 73,4 km/h, por debajo del tope.
  const r = estimarRuta(bajada1km, { ...datosBase, bajador: "bueno" }, { tramoM: 1000 });
  const kmh = 3600 / r.segundosTotales;
  assert.ok(kmh < 75 && kmh > 65, "salió " + kmh);
});

test("bajador medio: 1 km al 10 % a 65 km/h = 55,4 s", () => {
  // A mano: 1000 ÷ (65 ÷ 3,6) = 55,38 s
  const r = estimarRuta(bajada1km, { ...datosBase, bajador: "medio" }, { tramoM: 1000 });
  cerca(r.segundosTotales, 55.385, 1e-3);
});

test("mal bajador: 1 km al 10 % a 55 km/h = 65,5 s", () => {
  // A mano: 1000 ÷ (55 ÷ 3,6) = 65,45 s
  const r = estimarRuta(bajada1km, { ...datosBase, bajador: "malo" }, { tramoM: 1000 });
  cerca(r.segundosTotales, 65.455, 1e-3);
});

test("tipo de bajador: en subida y en llano no cambia nada", () => {
  const subeYLlano = { distanciaKm: 2, perfil: [{ km: 0, ele: 0 }, { km: 1, ele: 60 }, { km: 2, ele: 60 }] };
  const bueno = estimarRuta(subeYLlano, { ...datosBase, bajador: "bueno" }, { tramoM: 1000 });
  const malo = estimarRuta(subeYLlano, { ...datosBase, bajador: "malo" }, { tramoM: 1000 });
  cerca(bueno.segundosTotales, malo.segundosTotales, 1e-9);
});

test("% en subida: 90 % de 250 W = 225 W solo en los tramos de subida", () => {
  const perfil = [{ km: 0, ele: 0 }, { km: 1, ele: 60 }, { km: 2, ele: 60 }]; // 1 km al 6 % + 1 km llano
  const r = estimarRuta({ distanciaKm: 2, perfil }, { ...datosBase, pctSubida: 90, pctLlano: 60 }, { tramoM: 1000 });
  cerca(r.potenciaSubidaW, 225, 1e-9);
  cerca(r.potenciaLlanoW, 150, 1e-9);
  assert.equal(r.tramos[0].tipo, "subida");
  cerca(r.tramos[0].potenciaW, 225, 1e-9);
  assert.equal(r.tramos[1].tipo, "llano");
  cerca(r.tramos[1].potenciaW, 150, 1e-9);
  // La velocidad de cada tramo coincide con la de su potencia.
  cerca(r.tramos[0].velocidadMs, velocidadParaPotencia(225, 0.06, 78), 1e-9);
  cerca(r.tramos[1].velocidadMs, velocidadParaPotencia(150, 0, 78), 1e-9);
});

test("% en llano también se usa en las bajadas", () => {
  const r = estimarRuta(bajada1km, { ...datosBase, pctSubida: 90, pctLlano: 60 }, { tramoM: 1000 });
  assert.equal(r.tramos[0].tipo, "bajada");
  cerca(r.tramos[0].potenciaW, 150, 1e-9);
});

test("subir el % en subida acorta solo el tiempo de subida", () => {
  const perfil = [{ km: 0, ele: 0 }, { km: 1, ele: 60 }, { km: 2, ele: 60 }];
  const a = estimarRuta({ distanciaKm: 2, perfil }, { ...datosBase, pctSubida: 70, pctLlano: 70 }, { tramoM: 1000 });
  const b = estimarRuta({ distanciaKm: 2, perfil }, { ...datosBase, pctSubida: 90, pctLlano: 70 }, { tramoM: 1000 });
  assert.ok(b.grupos.subida.segundos < a.grupos.subida.segundos);
  cerca(b.grupos.llano.segundos, a.grupos.llano.segundos, 1e-9);
});

test("frontera del 2 %: exactamente 2 % cuenta como llano", () => {
  const perfil = [{ km: 0, ele: 0 }, { km: 1, ele: 20 }];
  const r = estimarRuta({ distanciaKm: 1, perfil }, datosBase, { tramoM: 1000 });
  assert.equal(r.tramos[0].tipo, "llano");
});

test("subida: más peso va más lento, más potencia va más rápido", () => {
  const base = velocidadParaPotencia(200, 0.07, 78);
  assert.ok(velocidadParaPotencia(200, 0.07, 90) < base);
  assert.ok(velocidadParaPotencia(250, 0.07, 78) > base);
});

test("tramos de 100 m: puntos cada 50 m subiendo 5 m → tramos con 10 % de pendiente", () => {
  const perfil = [];
  for (let i = 0; i <= 10; i++) perfil.push({ km: i * 0.05, ele: 100 + i * 5 });
  const tramos = dividirEnTramos(perfil, 100);
  assert.equal(tramos.length, 5);
  tramos.forEach(t => { cerca(t.distanciaM, 100, 1e-9); cerca(t.pendiente, 0.10, 1e-9); });
});

test("resumen por tipo de tramo: 1 km subida, 1 km llano, 1 km bajada", () => {
  const perfil = [
    { km: 0, ele: 0 }, { km: 1, ele: 50 },   // +5 %: subida
    { km: 2, ele: 50 },                      // 0 %: llano
    { km: 3, ele: 0 }                        // -5 %: bajada
  ];
  const r = estimarRuta({ distanciaKm: 3, perfil }, { ftp: 250, pesoKg: 70, gramosHora: 60 }, { tramoM: 1000 });
  cerca(r.grupos.subida.metros, 1000, 1e-6);
  cerca(r.grupos.llano.metros, 1000, 1e-6);
  cerca(r.grupos.bajada.metros, 1000, 1e-6);
  assert.ok(r.grupos.subida.segundos > r.grupos.llano.segundos);
  assert.ok(r.grupos.llano.segundos > r.grupos.bajada.segundos);
});

test("por defecto: 70 % del FTP en subida y llano (250 W → 175 W), bajador medio, masa = peso + 8 kg", () => {
  const r = estimarRuta({ distanciaKm: 1, perfil: [] }, { ftp: 250, pesoKg: 70, gramosHora: 60 });
  cerca(r.potenciaSubidaW, 175, 1e-9);
  cerca(r.potenciaLlanoW, 175, 1e-9);
  assert.equal(r.velocidadMaxKmh, 65);
  assert.equal(r.masaKg, 78);
});

test("formato de tiempo", () => {
  assert.equal(formatoDuracion(1000), "17 min");
  assert.equal(formatoDuracion(3600 * 7 + 5 * 60), "7 h 05 min");
});
