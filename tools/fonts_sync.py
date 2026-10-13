#!/usr/bin/env python3
"""Descarga las fuentes de Google y las deja autoalojadas en apps/*/public/fonts (+ fonts.css).

Por qué: evita que cada persona que abre la PWA le revele su IP a un tercero (Habeas Data), permite una CSP estricta
(`font-src 'self'`) y deja la app funcionando sin conexión. Solo se conservan los subconjuntos latin y latin-ext.
Uso: python3 tools/fonts_sync.py   (requiere salida a fonts.googleapis.com; el resultado se versiona).
"""
import re, sys, urllib.request, pathlib

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
FAMILIES = [
    "family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap",
    "family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap",
    # Íconos: ejes fijos (tamaño óptico 24, grosor 400) y relleno 0..1; los íconos vienen del contenido (juegos, insignias).
    "family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block",
]
KEEP = {"latin", "latin-ext", "fallback", None}
ROOT = pathlib.Path(__file__).resolve().parent.parent


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode()


def main():
    out_css, files = [], {}
    for fam in FAMILIES:
        css = fetch(f"https://fonts.googleapis.com/css2?{fam}")
        for m in re.finditer(r"(?:/\* ([\w-]+) \*/\s*)?(@font-face \{.*?\})", css, re.S):
            subset, block = m.group(1), m.group(2)
            if subset not in KEEP:
                continue
            url = re.search(r"url\((https://[^)]+)\)", block).group(1)
            name = re.search(r"font-family: '([^']+)'", block).group(1).lower().replace(" ", "-")
            style = re.search(r"font-style: (\w+)", block).group(1)
            weight = (re.search(r"font-weight: ([\d ]+)", block) or [None, "var"])[1].replace(" ", "-")
            fname = f"{name}-{style}-{weight}-{subset or 'all'}.woff2"
            files[fname] = url
            out_css.append(block.replace(url, f"/fonts/{fname}"))
    for app in ("pwa", "console"):
        d = ROOT / "apps" / app / "public" / "fonts"
        d.mkdir(parents=True, exist_ok=True)
        for fname, url in files.items():
            if not (d / fname).exists():
                (d / fname).write_bytes(fetch(url, binary=True))
        (d / "fonts.css").write_text("/* Generado por tools/fonts_sync.py. Fuentes bajo licencia SIL OFL / Apache 2.0. */\n" + "\n".join(out_css) + "\n")
        print(f"✓ {app}: {len(files)} archivos")


if __name__ == "__main__":
    sys.exit(main())
