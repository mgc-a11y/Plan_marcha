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
    puntos.push({ lat: lat, lon: lon, ele: ele });
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

  tramos.forEach(function (puntos) {
    totalPuntos += puntos.length;
    for (var i = 1; i < puntos.length; i++) {
      distancia += distanciaKm(puntos[i - 1], puntos[i]);
      var antes = puntos[i - 1].ele;
      var ahora = puntos[i].ele;
      if (antes !== null && ahora !== null) {
        hayAltitud = true;
        if (ahora > antes) desnivel += ahora - antes;
      }
    }
  });

  if (totalPuntos < 2) {
    throw new Error("El GPX no tiene puntos suficientes para medir la ruta.");
  }

  return {
    nombre: nombre,
    distanciaKm: distancia,
    desnivelPositivoM: hayAltitud ? desnivel : null,
    puntos: totalPuntos
  };
}

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
    distanciaKm: distanciaKm,
    RADIO_TIERRA_KM: RADIO_TIERRA_KM
  };
}
