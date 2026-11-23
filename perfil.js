// Dibuja el perfil de altitud en SVG, sin librerías.
// Recibe el resultado de analizarGpx (gpx.js).

var SVG_NS = "http://www.w3.org/2000/svg";

function crearSvg(etiqueta, atributos, texto) {
  var el = document.createElementNS(SVG_NS, etiqueta);
  for (var k in atributos) el.setAttribute(k, atributos[k]);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Paso "redondo" (1, 2 o 5 × 10^n) para que salgan unas 5 marcas.
function pasoRedondo(rango) {
  var bruto = rango / 5;
  var base = Math.pow(10, Math.floor(Math.log10(bruto)));
  var opciones = [1, 2, 5, 10];
  for (var i = 0; i < opciones.length; i++) {
    if (opciones[i] * base >= bruto) return opciones[i] * base;
  }
  return 10 * base;
}

function formatoKm(km) {
  return km.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatoM(m) {
  // "+ 0" evita que se escriba "-0 m" por redondeos.
  return (Math.round(m) + 0).toLocaleString("es-ES") + " m";
}

// Con muchos puntos, dibuja uno de cada N para que vaya fluido.
// Los puntos más alto y más bajo se marcan con los datos completos.
function aligerar(perfil, maximo) {
  if (perfil.length <= maximo) return perfil;
  var salto = Math.ceil(perfil.length / maximo);
  var res = [];
  for (var i = 0; i < perfil.length; i += salto) res.push(perfil[i]);
  if (res[res.length - 1] !== perfil[perfil.length - 1]) res.push(perfil[perfil.length - 1]);
  return res;
}

function dibujarPerfil(contenedor, r) {
  contenedor.textContent = "";
  if (!r.perfil.length) return;

  // El dibujo usa el ancho real de la pantalla para que el texto no se encoja en el móvil.
  var ancho = Math.max(300, Math.round(contenedor.clientWidth || 800));
  var alto = ancho < 500 ? 240 : 320;
  var m = { izq: 56, der: 16, arr: 16, aba: 36 };
  var w = ancho - m.izq - m.der;
  var h = alto - m.arr - m.aba;

  var kmMax = r.perfil[r.perfil.length - 1].km || 1;
  var eleMin = r.puntoMasBajo.ele;
  var eleMax = r.puntoMasAlto.ele;
  var margen = Math.max((eleMax - eleMin) * 0.2, 10);
  var yBajo = eleMin - margen;
  var yAlto = eleMax + margen;

  function x(km) { return m.izq + (km / kmMax) * w; }
  function y(ele) { return m.arr + (1 - (ele - yBajo) / (yAlto - yBajo)) * h; }

  var svg = crearSvg("svg", {
    viewBox: "0 0 " + ancho + " " + alto,
    role: "img",
    "aria-label": "Perfil de altitud de la ruta"
  });

  // Líneas de altitud y etiquetas de metros.
  var pasoY = pasoRedondo(yAlto - yBajo);
  for (var v = Math.ceil(yBajo / pasoY) * pasoY; v <= yAlto; v += pasoY) {
    svg.appendChild(crearSvg("line", { x1: m.izq, x2: ancho - m.der, y1: y(v), y2: y(v), class: "rejilla" }));
    svg.appendChild(crearSvg("text", { x: m.izq - 6, y: y(v) + 4, "text-anchor": "end", class: "eje" }, formatoM(v)));
  }

  // Etiquetas de km.
  var pasoX = pasoRedondo(kmMax);
  for (var k = 0; k <= kmMax + 1e-9; k += pasoX) {
    svg.appendChild(crearSvg("text", { x: x(k), y: alto - m.aba + 20, "text-anchor": "middle", class: "eje" },
      k.toLocaleString("es-ES") + " km"));
  }

  // Área y línea del perfil.
  var puntos = aligerar(r.perfil, 1500);
  var linea = puntos.map(function (p) { return x(p.km).toFixed(1) + "," + y(p.ele).toFixed(1); }).join(" ");
  var base = y(yBajo).toFixed(1);
  svg.appendChild(crearSvg("polygon", {
    points: x(puntos[0].km).toFixed(1) + "," + base + " " + linea + " " + x(puntos[puntos.length - 1].km).toFixed(1) + "," + base,
    class: "area"
  }));
  svg.appendChild(crearSvg("polyline", { points: linea, class: "linea" }));

  // Marcas del punto más alto y más bajo.
  function marcar(p, clase, simbolo, arriba) {
    var px = x(p.km), py = y(p.ele);
    var ancla = px > ancho * 0.75 ? "end" : px < ancho * 0.25 ? "start" : "middle";
    svg.appendChild(crearSvg("circle", { cx: px, cy: py, r: 5, class: clase }));
    svg.appendChild(crearSvg("text", {
      x: px, y: arriba ? py - 10 : py + 20, "text-anchor": ancla, class: "etiqueta " + clase
    }, simbolo + " " + formatoM(p.ele) + " · km " + formatoKm(p.km)));
  }
  marcar(r.puntoMasAlto, "alto", "▲", true);
  marcar(r.puntoMasBajo, "bajo", "▼", false);

  contenedor.appendChild(svg);

  var leyenda = document.createElement("p");
  leyenda.className = "leyenda";
  leyenda.textContent =
    "Punto más alto: " + formatoM(r.puntoMasAlto.ele) + " en el km " + formatoKm(r.puntoMasAlto.km) +
    ". Punto más bajo: " + formatoM(r.puntoMasBajo.ele) + " en el km " + formatoKm(r.puntoMasBajo.km) + ".";
  contenedor.appendChild(leyenda);
}
