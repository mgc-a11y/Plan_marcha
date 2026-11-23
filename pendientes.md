# Pendientes

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
