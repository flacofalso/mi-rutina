"""Genera el paquete personal (privado/paquete.json) que se importa en la app.

El paquete reúne todo lo que NO se publica en el repositorio:
  - la planilla de rutina (.xlsx) del entrenador
  - las imágenes de los ejercicios (reducidas a WebP)
  - el plan de alimentación y el menú semanal

Uso (desde la raíz del proyecto):
    python herramientas/crear_paquete.py "Mi Rutina.xlsx"

Archivos de entrada (en la carpeta privado/, ignorada por git):
    privado/imagenes.json   {"Nombre del ejercicio": "ruta/a/imagen.jpg", ...}
    privado/nutricion.json  plan de alimentación (ver README)

Requiere: pip install pillow
"""
import base64
import io
import json
import sys
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Falta Pillow. Instálalo con: pip install pillow")

RAIZ = Path(__file__).resolve().parent.parent
PRIVADO = RAIZ / "privado"
LADO_MAX = 640


def imagen_a_dataurl(ruta: Path) -> str:
    with Image.open(ruta) as im:
        im = im.convert("RGBA") if im.mode in ("P", "LA") else im
        if im.mode == "RGBA":
            fondo = Image.new("RGB", im.size, (255, 255, 255))
            fondo.paste(im, mask=im.split()[-1])
            im = fondo
        else:
            im = im.convert("RGB")
        im.thumbnail((LADO_MAX, LADO_MAX))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=72, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    excel = Path(sys.argv[1])
    if not excel.is_absolute():
        excel = RAIZ / excel
    if not excel.exists():
        sys.exit(f"No encuentro el Excel: {excel}")

    paquete = {
        "tipo": "paquete-rutina",
        "version": 1,
        "creado": datetime.now().isoformat(timespec="seconds"),
        "excel": {"nombre": excel.name, "base64": base64.b64encode(excel.read_bytes()).decode()},
        "imagenes": {},
    }

    mapa = PRIVADO / "imagenes.json"
    if mapa.exists():
        for nombre, ruta in json.loads(mapa.read_text(encoding="utf-8")).items():
            archivo = RAIZ / ruta
            if not archivo.exists():
                print(f"  ! imagen no encontrada para '{nombre}': {ruta}")
                continue
            paquete["imagenes"][nombre] = imagen_a_dataurl(archivo)
            print(f"  ✓ {nombre}")

    nutri = PRIVADO / "nutricion.json"
    if nutri.exists():
        paquete["nutricion"] = json.loads(nutri.read_text(encoding="utf-8"))

    PRIVADO.mkdir(exist_ok=True)
    salida = PRIVADO / "paquete.json"
    salida.write_text(json.dumps(paquete, ensure_ascii=False), encoding="utf-8")
    kb = salida.stat().st_size / 1024
    print(f"\nPaquete creado: {salida} ({kb:.0f} KB)")
    print("Envíalo a tu teléfono (por ejemplo a tu correo o Drive) e impórtalo en Ajustes → Paquete personal.")


if __name__ == "__main__":
    main()
