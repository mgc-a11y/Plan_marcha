// Estimación de velocidad y tiempo por tramos según la pendiente y el FTP.
// Funciona en el navegador y en Node (para las pruebas). Sin librerías.
//
// Modelo de potencia: Martin, J.C., Milliken, D.L., Cobb, J.E., McFadden, K.L.
// y Coggan, A.R. (1998), "Validation of a mathematical model for road cycling
// power", Journal of Applied Biomechanics 14:276-291.

// Velocidad máxima en bajada según cómo baja el usuario (km/h).
// Valores elegidos por el usuario, no salen de una fuente.
var TIPOS_BAJADOR = {
  bueno: { nombre: "Buen bajador", velocidadMaxKmh: 75 },
  medio: { nombre: "Bajador medio", velocidadMaxKmh: 65 },
  malo: { nombre: "Mal bajador", velocidadMaxKmh: 55 }
};

// Pendiente a partir de la cual un tramo cuenta como subida o bajada (2 %).
// Supuesto sin fuente.
var UMBRAL_PENDIENTE = 0.02;

var SUPUESTOS = {
  // Fracción del FTP por defecto en subida y en llano (el usuario la cambia).
  // El rango 56-75 % es la zona "Resistencia" de Allen y Coggan (Training and
  // Racing with a Power Meter, 2010). Elegir 0,70 es un supuesto, no una recomendación.
  fraccionSubida: 0.70,
  fraccionLlano: 0.70,
  // Peso de bici y equipo en kg. Supuesto sin fuente.
  pesoBiciKg: 8,
  // Superficie aerodinámica (m²), manos en manetas. Valor orientativo sin fuente exacta.
  cda: 0.32,
  // Coeficiente de rodadura en asfalto. Sin fuente exacta
  // (Martin et al. 1998 midieron 0,0032 en sus condiciones).
  crr: 0.004,
  // Eficiencia de la transmisión. Fuente: Martin et al. 1998.
  eficiencia: 0.97698,
  // Densidad del aire (kg/m³) a nivel del mar y 15 °C. Fuente: ISO 2533 (atmósfera estándar).
  densidadAire: 1.225,
  // Gravedad estándar (m/s²). Fuente: CGPM 1901.
  gravedad: 9.80665,
  // Velocidad máxima en bajada (km/h) por defecto: bajador medio.
  velocidadMaxKmh: TIPOS_BAJADOR.medio.velocidadMaxKmh,
  // Longitud de cada tramo (m) para calcular la pendiente.
  tramoM: 100
};

function conSupuestos(cambios) {
  var s = {};
  for (var k in SUPUESTOS) s[k] = SUPUESTOS[k];
  for (var c in cambios || {}) s[c] = cambios[c];
  return s;
}

// Potencia (W) que hace falta para ir a v (m/s) con esa pendiente (0,05 = 5 %)
// y esa masa total (kg).
function potenciaNecesaria(v, pendiente, masaKg, cambios) {
  var s = conSupuestos(cambios);
  var angulo = Math.atan(pendiente);
  var fSubir = masaKg * s.gravedad * Math.sin(angulo);
  var fRodar = s.crr * masaKg * s.gravedad * Math.cos(angulo);
  var fAire = 0.5 * s.densidadAire * s.cda * v * v;
  return ((fSubir + fRodar + fAire) * v) / s.eficiencia;
}

// Velocidad (m/s) que se consigue con esa potencia. Busca por bisección:
// la potencia necesaria crece con la velocidad, así que hay una sola solución.
function velocidadParaPotencia(potenciaW, pendiente, masaKg, cambios) {
  var s = conSupuestos(cambios);
  var vMax = s.velocidadMaxKmh / 3.6;
  if (potenciaNecesaria(vMax, pendiente, masaKg, s) <= potenciaW) return vMax;
  var bajo = 0, alto = vMax;
  for (var i = 0; i < 100; i++) {
    var medio = (bajo + alto) / 2;
    if (potenciaNecesaria(medio, pendiente, masaKg, s) < potenciaW) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

// Agrupa el perfil (lista de {km, ele}) en tramos de unos 100 m.
function dividirEnTramos(perfil, tramoM) {
  var tramos = [];
  var inicio = perfil[0];
  for (var i = 1; i < perfil.length; i++) {
    var p = perfil[i];
    var metros = (p.km - inicio.km) * 1000;
    // El margen de 1 mm evita fallos de redondeo (99,9999 m en vez de 100 m).
    if (metros >= tramoM - 0.001 || i === perfil.length - 1) {
      if (metros > 0) {
        tramos.push({
          kmInicio: inicio.km,
          distanciaM: metros,
          pendiente: (p.ele - inicio.ele) / metros
        });
      }
      inicio = p;
    }
  }
  return tramos;
}

// datos: { ftp (W), pesoKg, gramosHora, y opcionales: pctSubida, pctLlano
// (porcentaje del FTP, p. ej. 75) y bajador ("bueno", "medio" o "malo") }.
// ruta: resultado de analizarGpx.
// En bajada se usa el mismo porcentaje que en llano, con el tope de velocidad del bajador.
function estimarRuta(ruta, datos, cambios) {
  var s = conSupuestos(cambios);
  if (datos.pctSubida != null) s.fraccionSubida = datos.pctSubida / 100;
  if (datos.pctLlano != null) s.fraccionLlano = datos.pctLlano / 100;
  if (datos.bajador && TIPOS_BAJADOR[datos.bajador]) {
    s.velocidadMaxKmh = TIPOS_BAJADOR[datos.bajador].velocidadMaxKmh;
  }
  var masa = datos.pesoKg + s.pesoBiciKg;
  var potenciaSubida = datos.ftp * s.fraccionSubida;
  var potenciaLlano = datos.ftp * s.fraccionLlano;

  var tramos = ruta.perfil && ruta.perfil.length >= 2
    ? dividirEnTramos(ruta.perfil, s.tramoM)
    : [{ kmInicio: 0, distanciaM: ruta.distanciaKm * 1000, pendiente: 0 }];

  var grupos = {
    subida: { metros: 0, segundos: 0 },
    llano: { metros: 0, segundos: 0 },
    bajada: { metros: 0, segundos: 0 }
  };
  var total = 0, metrosTotales = 0;

  tramos.forEach(function (t) {
    var g = t.pendiente > UMBRAL_PENDIENTE ? "subida" : t.pendiente < -UMBRAL_PENDIENTE ? "bajada" : "llano";
    t.tipo = g;
    t.potenciaW = g === "subida" ? potenciaSubida : potenciaLlano;
    t.velocidadMs = velocidadParaPotencia(t.potenciaW, t.pendiente, masa, s);
    t.segundos = t.distanciaM / t.velocidadMs;
    total += t.segundos;
    metrosTotales += t.distanciaM;
    grupos[g].metros += t.distanciaM;
    grupos[g].segundos += t.segundos;
  });

  return {
    potenciaSubidaW: potenciaSubida,
    potenciaLlanoW: potenciaLlano,
    velocidadMaxKmh: s.velocidadMaxKmh,
    masaKg: masa,
    tramos: tramos,
    grupos: grupos,
    segundosTotales: total,
    velocidadMediaKmh: total > 0 ? (metrosTotales / total) * 3.6 : 0,
    hidratosTotalesG: datos.gramosHora * (total / 3600)
  };
}

// Alternativa sin potencia: el usuario da una velocidad media (km/h).
// Tiempo = distancia ÷ velocidad. No usa FTP, peso, intensidades ni bajador.
// datos: { velocidadKmh, gramosHora }.
function estimarPorVelocidad(ruta, datos) {
  var segundos = (ruta.distanciaKm / datos.velocidadKmh) * 3600;
  return {
    segundosTotales: segundos,
    velocidadMediaKmh: datos.velocidadKmh,
    hidratosTotalesG: datos.gramosHora * (segundos / 3600)
  };
}

function formatoDuracion(segundos) {
  var min = Math.round(segundos / 60);
  var h = Math.floor(min / 60);
  var m = min % 60;
  if (h === 0) return m + " min";
  return h + " h " + (m < 10 ? "0" : "") + m + " min";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUPUESTOS: SUPUESTOS,
    TIPOS_BAJADOR: TIPOS_BAJADOR,
    potenciaNecesaria: potenciaNecesaria,
    velocidadParaPotencia: velocidadParaPotencia,
    dividirEnTramos: dividirEnTramos,
    estimarRuta: estimarRuta,
    estimarPorVelocidad: estimarPorVelocidad,
    formatoDuracion: formatoDuracion
  };
}
