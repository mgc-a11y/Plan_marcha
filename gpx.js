// Lector de archivos GPX: nombre, distancia y desnivel positivo.
// Funciona en el navegador y en Node (para las pruebas). Sin librerías.

// Radio medio de la Tierra en km.
// Fuente: IUGG, radio medio R1 del elipsoide GRS80 (Moritz, H. 2000,
// "Geodetic Reference System 1980", Journal of Geodesy 74:128-133).
var RADIO_TIERRA_KM = 6371.0088;

function aRadianes(grados) {
  return (grados * Math.PI) / 180;
}

// Distancia entre dos puntos con la fórmula de Haversine (km).
// Fuente: Sinnott, R. W. (1984), "Virtues of the Haversine",
// Sky and Telescope 68(2):159.
function distanciaKm(a, b) {
  var dLat = aRadianes(b.lat - a.lat);
  var dLon = aRadianes(b.lon - a.lon);
  var h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function limpiarTexto(texto) {
  return texto
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function primerNombre(bloque) {
  var m = /<name>([\s\S]*?)<\/name>/.exec(bloque);
  return m ? limpiarTexto(m[1]) : "";
}

function leerAtributo(atributos, nombre) {
  var m = new RegExp("\\b" + nombre + "\\s*=\\s*[\"']([^\"']+)[\"']").exec(atributos);
  return m ? parseFloat(m[1]) : NaN;
}

// Devuelve los puntos de un trozo de texto GPX con la etiqueta indicada.
function leerPuntos(texto, etiqueta) {
  var patron = new RegExp(
    "<" + etiqueta + "\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/" + etiqueta + ">)",
    "g"
  );
  var puntos = [];
  var m;
  while ((m = patron.exec(texto)) !== null) {
    var lat = leerAtributo(m[1], "lat");
    var lon = leerAtributo(m[1], "lon");
    if (isNaN(lat) || isNaN(lon)) continue;
    var ele = null;
    var e = /<ele>\s*([^<]+?)\s*<\/ele>/.exec(m[2] || "");
    if (e && !isNaN(parseFloat(e[1]))) ele = parseFloat(e[1]);
    var conHora = /<time>/.test(m[2] || "");
    puntos.push({ lat: lat, lon: lon, ele: ele, conHora: conHora });
  }
  return puntos;
}

// Separa la ruta en tramos. Entre tramos distintos no se suma distancia
// (por ejemplo, si el GPS se paró y se reanudó en otro sitio).
function leerTramos(texto) {
  if (/<trkpt\b/.test(texto)) {
    var tramos = [];
    var patronSeg = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/g;
    var m;
    while ((m = patronSeg.exec(texto)) !== null) {
      var p = leerPuntos(m[1], "trkpt");
      if (p.length) tramos.push(p);
    }
    if (!tramos.length) tramos.push(leerPuntos(texto, "trkpt"));
    return tramos;
  }
  return [leerPuntos(texto, "rtept")];
}

// ¿La altitud puede venir de un planificador con mapa de relieve?
// Pista: ningún punto tiene hora (no se grabó en bici) y el archivo no lo
// exportaron Strava ni Garmin Connect, que ponen su propia altitud corregida
// (comprobado el 24/11/2026 con el track QH 2026: Map Plus 7297 m,
// exportado de Strava 4154 m, exportado de Garmin 3584 m).
function altitudPlanificada(texto, tramos) {
  var algunaHora = tramos.some(function (t) {
    return t.some(function (p) { return p.conHora; });
  });
  if (algunaHora) return false;
  var creador = (/<gpx\b[^>]*\bcreator\s*=\s*["']([^"']*)["']/.exec(texto) || [, ""])[1];
  return !/strava|garmin/i.test(creador);
}

function analizarGpx(texto) {
  texto = String(texto || "");
  if (!/<gpx\b/.test(texto)) {
    throw new Error("El archivo no parece un GPX.");
  }

  var nombre =
    primerNombre((/<trk\b[\s\S]*?<\/trk>/.exec(texto) || [""])[0]) ||
    primerNombre((/<rte\b[\s\S]*?<\/rte>/.exec(texto) || [""])[0]) ||
    primerNombre((/<metadata\b[\s\S]*?<\/metadata>/.exec(texto) || [""])[0]) ||
    "Sin nombre";

  var tramos = leerTramos(texto);
  var totalPuntos = 0;
  var distancia = 0;
  var desnivel = 0;
  var hayAltitud = false;
  // Perfil: km recorridos hasta cada punto y su altitud.
  var perfil = [];

  tramos.forEach(function (puntos) {
    totalPuntos += puntos.length;
    for (var i = 0; i < puntos.length; i++) {
      if (i > 0) {
        distancia += distanciaKm(puntos[i - 1], puntos[i]);
        var antes = puntos[i - 1].ele;
        var ahora = puntos[i].ele;
        if (antes !== null && ahora !== null) {
          hayAltitud = true;
          if (ahora > antes) desnivel += ahora - antes;
        }
      }
      if (puntos[i].ele !== null) {
        perfil.push({ km: distancia, ele: puntos[i].ele });
      }
    }
  });

  if (totalPuntos < 2) {
    throw new Error("El GPX no tiene puntos suficientes para medir la ruta.");
  }

  // Si la altitud máxima o mínima se repite, se marca la primera vez.
  var masAlto = null;
  var masBajo = null;
  perfil.forEach(function (p) {
    if (masAlto === null || p.ele > masAlto.ele) masAlto = p;
    if (masBajo === null || p.ele < masBajo.ele) masBajo = p;
  });
  if (perfil.length < 2) {
    perfil = [];
    masAlto = null;
    masBajo = null;
  }

  return {
    nombre: nombre,
    distanciaKm: distancia,
    desnivelPositivoM: hayAltitud ? desnivel : null,
    puntos: totalPuntos,
    perfil: perfil,
    puntoMasAlto: masAlto,
    puntoMasBajo: masBajo,
    // Solo tiene sentido avisar si hay altitudes.
    altitudPlanificada: hayAltitud && altitudPlanificada(texto, tramos)
  };
}

var AVISO_RUTA_PLANIFICADA =
  "Esta ruta parece planificada (sus puntos no tienen hora). Su altitud puede " +
  "venir de un mapa de relieve y el desnivel salir inflado. Si te parece alto, " +
  "impórtala en Strava o Garmin Connect y sube aquí el GPX que exportes.";

function resumenEnPalabras(r) {
  var km = r.distanciaKm.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  var texto = "Tu ruta se llama «" + r.nombre + "». Mide " + km + " km";
  if (r.desnivelPositivoM === null) {
    texto += ". El archivo no trae altitudes, así que no puedo calcular el desnivel.";
  } else {
    texto +=
      " y sube " +
      Math.round(r.desnivelPositivoM).toLocaleString("es-ES") +
      " m de desnivel positivo.";
  }
  return texto;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    analizarGpx: analizarGpx,
    resumenEnPalabras: resumenEnPalabras,
    AVISO_RUTA_PLANIFICADA: AVISO_RUTA_PLANIFICADA,
    distanciaKm: distanciaKm,
    RADIO_TIERRA_KM: RADIO_TIERRA_KM
  };
}
