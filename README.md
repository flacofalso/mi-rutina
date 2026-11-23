# Mi Rutina

App web personal e instalable en el celular (PWA) para registrar entrenamientos de fuerza y seguir un plan de alimentación por porciones. Funciona sin conexión y no tiene servidor: **todos los datos quedan guardados solo en el dispositivo**.

## Funciones

- **Entrenar:** muestra los ejercicios del día con imagen, series, repeticiones, intensidad (RPE `@8` o RIR) y descanso.
  - Registras kilos, repeticiones y RPE de cada serie.
  - Muestra lo que hiciste la última vez en ese ejercicio.
  - Temporizador de descanso automático, con sonido y vibración.
  - Marca con 🎥 las series que hay que grabar (las celdas verdes de la planilla).
  - Soporta biseries y explica tempo, pausas, RPE y RIR.
  - Mantiene la pantalla encendida mientras entrenas.
- **Resumen para el entrenador:** al terminar anotas tu peso corporal, cómo te sentiste y tus comentarios. La app arma un resumen para enviar por WhatsApp, con la lista de videos que tienes que adjuntar.
- **Comidas:**
  - Menú semanal con horarios que se ajustan solos si entrenas de mañana o de noche.
  - Control de porciones por grupo de alimentos.
  - Equivalencias para cambiar un alimento por otro del mismo grupo.
  - Reglas de la pauta y lista de alimentos a evitar.
- **Historial:** sesiones anteriores y progreso por ejercicio (mejor serie y volumen).
- **Importación semanal:** cada vez que llega la planilla `.xlsx` nueva del entrenador, se importa directamente en la app.

## Privacidad

Este repositorio contiene **solo el código**. La rutina, las imágenes de los ejercicios y el plan de alimentación son personales: viven en la carpeta `privado/`, que git ignora, y se cargan en el teléfono mediante un *paquete personal*.

## Uso

### 1. Crear el paquete personal (en el computador)

```bash
pip install pillow
python herramientas/crear_paquete.py "Mi planilla.xlsx"
```

El script lee:

| Archivo | Contenido |
|---|---|
| `privado/imagenes.json` | `{ "Nombre del ejercicio": "ruta/a/imagen.jpg" }` |
| `privado/nutricion.json` | grupos de alimentos, porciones, equivalencias, reglas y menú de 7 días |

Genera `privado/paquete.json`, que incluye la planilla, las imágenes reducidas y el plan.

### 2. Importarlo en el teléfono

1. Abre la app publicada en GitHub Pages.
2. Envíate `paquete.json` (por correo o Drive) e impórtalo en **Ajustes → Importar paquete personal**.
3. Instala la app: en iPhone, Safari → Compartir → *Agregar a inicio*; en Android, Chrome → *Instalar app*.

### 3. Cada semana

Importa la planilla nueva en **Ajustes → Importar Excel de la semana**. Se agrega como semana nueva; el historial se conserva.

> **Respaldo:** descarga un respaldo de vez en cuando (en **Ajustes**). Si se borran los datos del navegador, se pierde el historial.

## Formato de la planilla

El lector busca los encabezados, no posiciones fijas:

- `Ejercicios` | `Series` | `Carga Sugerida` | `Descanso` | `Reps` | `RIR/RPE`, y por cada serie `Kilos` | `Reps` | `RIR/RPE`.
- Filas `Dia N` que separan los días.
- Una celda **verde** en `Kilos` de una serie indica que esa serie se graba. Una celda **gris** indica que la serie no aplica.
- Una celda `Series` combinada entre dos ejercicios se interpreta como **biserie**.
- Los rangos que Excel convierte en fecha (por ejemplo, `8-12` → 8-dic) se recuperan automáticamente.

## Desarrollo

No necesita compilación.

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

En `localhost`, si existe `privado/paquete.json`, se carga automáticamente.

Al publicar cambios, sube `VERSION` en `sw.js` para que los teléfonos descarguen la versión nueva.

```
index.html            estructura y navegación
css/styles.css        estilos (claro/oscuro)
js/app.js             enrutador
js/data.js            estado, horarios, importación y respaldo
js/db.js              IndexedDB
js/xlsx-parser.js     lector de la planilla
js/timer.js           temporizador de descanso
js/resumen.js         texto para WhatsApp
js/vistas/*.js        pantallas
herramientas/         script del paquete personal
```
