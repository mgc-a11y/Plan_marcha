# Pendientes

## ▶ Próxima sesión (25/11/2026): empezar aquí
Objetivo principal de la app: **generar un GPX con la ruta y los puntos donde comer y beber**
(no fuentes ni puntos de agua, sino los momentos en que el ciclista come o bebe).

1. **Investigar fuentes de nutrición deportiva en ciclismo** sobre cada cuánto comer y beber
   (¿cada 15 min, cada 30 min, según la situación?). Solo fuentes fiables, citadas. La app calcula,
   no receta: la investigación sirve para informar al usuario, que elige.
2. **El usuario dará su punto de vista** sobre la frecuencia de comer y beber.
3. **Diseñar la generación del GPX**: el navegador crea y descarga el archivo, sin servidor.
   Puntos con nombre tipo «Comer 1 — 30 g» o «Beber 3», colocados según el tiempo estimado.
   Decidir qué pasa en el modo «velocidad media» (reparte el tiempo por igual).
4. **Prueba en el Garmin Edge 1030 Plus**: ver cómo muestra los puntos de un GPX importado
   en Garmin Connect. Se hará cuando haga falta.
5. **Mapa (después del track)**: mirar qué servicio de mapas público usar (Google Maps pide clave y
   pago; OpenStreetMap es gratis con normas de uso). Ver la sección «Idea: corregir la altitud
   con el mapa (cota Z)». Preguntar antes de añadir librerías.

## Revisar distancia y desnivel frente a Strava
Apuntado el 23/11/2026. Volver a analizarlo cuando la web pueda comparar más datos.

Comparación con la primera versión del lector de GPX (sin filtros):

| Ruta | Web: distancia | Strava: distancia | Web: desnivel | Strava: desnivel |
|---|---|---|---|---|
| Primer gravelazo con el padre! | 48,3 km | 48,13 km (+0,4 %) | 440 m | 412 m (+7 %) |
| Quebrantahuesos 2023 | 197,0 km | 196,59 km (+0,2 %) | 3543 m | 3502 m (+1,2 %) |

Qué mirar:
- La distancia sale siempre un poco más alta. ¿Puntos con la bici parada?
- El desnivel varía mucho según la ruta. Probar un filtro, pero solo con una fuente fiable para el método.
- Guardar estos dos GPX en `pruebas/` para usarlos como pruebas automáticas.

## Revisar el perfil de altitud y los puntos más alto y más bajo
Apuntado el 23/11/2026. Probado con rutas reales: los datos son aproximados, pero bastante fiables.
Decisión: seguimos con ellos. Se refinan solo si encontramos una forma fiable de hacerlo.

Qué mirar:
- Los puntos más alto y más bajo usan la altitud del GPX tal cual, sin suavizar. Un pico falso del GPS podría moverlos.
- Si se añade un filtro para el desnivel, usar el mismo en el perfil.

## Selector de archivos en el iPhone (para la versión definitiva)
Apuntado el 23/11/2026. Probado con un iPhone 17 Pro.

Qué pasó:
- Con el filtro «solo .gpx», los GPX salían en gris y no se podían elegir.
- Sin filtro, salía un menú con fototeca, cámara y vídeo, que confunde.
- Con el filtro actual (GPX, XML y archivos de datos), abre directamente el selector en «Descargas». Funciona.

Qué falta concretar:
- Comprobar si se puede llegar a otras carpetas (iCloud Drive, En mi iPhone) o si el usuario no tiene más.
- Probar en Android y en otros iPhone antes de la versión definitiva.
- Una web no puede elegir en qué carpeta se abre el selector.

## Desnivel inflado en rutas planificadas
Apuntado el 24/11/2026. Track QH 2026 (creado con Map Plus, sin hora en los puntos).

Qué pasó:
- La web daba 7297 m de desnivel (el real son unos 3700-3800 m). No sumaba bajadas: la bajada era 7251 m aparte.
- La altitud venía de un mapa de relieve y «ondulaba» 5-25 m cada 100-200 m, también en plena subida.
- Strava, Garmin Connect y Wikiloc sustituyen la altitud del archivo por la de su base de datos.

| Mismo track | Desnivel en la plataforma | Desnivel en la web |
|---|---|---|
| Original de Map Plus | — | 7297 m |
| Exportado de Strava | 4163 m | 4154 m |
| Exportado de Garmin Connect | 3575 m | 3584 m |

Filtros probados con el original (no aplicados):
- Umbral de 10 m (GPS Visualizer, con fuente): 5109 m. Mejora, pero se queda alto.
- Media de 500 m (sin fuente): 3854 m. Estropea las rutas grabadas (gravel 302 m frente a 412 m de Strava).

Decisión: no filtrar. La web avisa cuando el GPX no tiene hora y no viene de Strava ni de Garmin.
Solución práctica: importar la ruta en Strava o Garmin Connect y exportar el GPX.

## Idea: corregir la altitud con el mapa (cota Z)
Apuntado el 24/11/2026, a propuesta del usuario. Para cuando pongamos la ruta sobre un mapa
(puntos de comida y de agua), usar la altitud del mapa para ajustar la del track, como Strava o Garmin.

Antes de hacerlo, decidir:
- Privacidad: pedir alturas o teselas de un mapa en internet revela por dónde pasa la ruta.
  Hoy la regla es que el GPX no sale del dispositivo. ¿Se acepta, avisando al usuario?
- Calidad: Map Plus ya usaba un mapa de relieve y dio 7297 m. Depende mucho de la resolución del mapa
  y de cómo se suavice. Strava usa barómetros de su comunidad, no solo relieve.
- Librerías: un mapa casi seguro necesita una librería. Preguntar antes de añadirla.
- Comparar el resultado con los exportados de Strava (4163 m) y Garmin (3584 m) de este mismo track.
