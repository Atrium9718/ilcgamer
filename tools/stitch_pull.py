#!/usr/bin/env python3
"""Descarga pantallas de Google Stitch (HTML + screenshot) a design/stitch-exports/.

Uso:
    STITCH_API_KEY=... python3 tools/stitch_pull.py <slug> <screenId> [<slug> <screenId> ...]

Cada pantalla queda en design/stitch-exports/<slug>/ con:
    screen.html   código exportado por Stitch (HTML + Tailwind)
    screen.png    captura de referencia (para regresión visual)
    meta.json     id, título, tamaño y design system usado

La API key nunca se escribe en disco: se lee de la variable de entorno STITCH_API_KEY.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

PROJECT_ID = os.environ.get("STITCH_PROJECT_ID", "3853668696389706038")
ENDPOINT = "https://stitch.googleapis.com/mcp"
ROOT = Path(__file__).resolve().parent.parent / "design" / "stitch-exports"


def call(tool: str, args: dict) -> dict:
    key = os.environ.get("STITCH_API_KEY")
    if not key:
        sys.exit("Falta la variable de entorno STITCH_API_KEY")
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": tool, "arguments": args}}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        "X-Goog-Api-Key": key,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    })
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read())
    if "error" in data or data["result"].get("isError"):
        sys.exit(f"Error de Stitch en {tool}: {json.dumps(data)[:500]}")
    return json.loads(data["result"]["content"][0]["text"])


def download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url, timeout=120) as resp:
        dest.write_bytes(resp.read())


def pull(slug: str, screen_id: str) -> None:
    screen = call("get_screen", {"name": f"projects/{PROJECT_ID}/screens/{screen_id}"})
    out = ROOT / slug
    out.mkdir(parents=True, exist_ok=True)
    if url := screen.get("htmlCode", {}).get("downloadUrl"):
        download(url, out / "screen.html")
    if url := screen.get("screenshot", {}).get("downloadUrl"):
        download(url, out / "screen.png")
    meta = {
        "screenId": screen_id,
        "title": screen.get("title"),
        "width": screen.get("width"),
        "height": screen.get("height"),
        "designSystem": (screen.get("designSystem") or {}).get("name"),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"✓ {slug} ← {screen_id}")


if __name__ == "__main__":
    pairs = sys.argv[1:]
    if not pairs or len(pairs) % 2:
        sys.exit(__doc__)
    for i in range(0, len(pairs), 2):
        pull(pairs[i], pairs[i + 1])
