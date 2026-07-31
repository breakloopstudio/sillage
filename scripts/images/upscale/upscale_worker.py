"""
Worker upscale Real-ESRGAN PERSISTANT — appelé par migrate-upscale.ts.

Le modèle est chargé UNE fois au démarrage, puis les images défilent via un
protocole JSON-lines sur stdin/stdout. Évite le coût de démarrage (~6 s)
d'un processus par image → débit ~0,3-0,5 s/image sur GPU.

Protocole :
  → stdout au démarrage : {"ready": true, "gpu": bool}
  ← stdin  (une ligne par job) : {"input": "...", "output": "...", "scale": 4}
  → stdout (une ligne par job) : {"ok": true, "width": w, "height": h}
                                 {"ok": false, "error": "..."}
  ← stdin  {"stop": true} ou EOF : sortie propre.

Usage manuel :
    python upscale_worker.py   (puis saisir les jobs ligne par ligne)
"""
import contextlib
import json
import os
import sys
import urllib.request

os.environ.setdefault("BASICSR_JIT", "0")

import cv2
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(HERE, "weights")
WEIGHTS_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
)
WEIGHTS_PATH = os.path.join(WEIGHTS_DIR, "RealESRGAN_x4plus.pth")


def log(msg: str) -> None:
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def ensure_weights() -> None:
    if os.path.exists(WEIGHTS_PATH) and os.path.getsize(WEIGHTS_PATH) > 0:
        return
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    log("Téléchargement des poids RealESRGAN_x4plus.pth...")
    tmp = WEIGHTS_PATH + ".part"
    urllib.request.urlretrieve(WEIGHTS_URL, tmp)
    os.replace(tmp, WEIGHTS_PATH)
    log(f"OK ({os.path.getsize(WEIGHTS_PATH) / 1e6:.1f} MB)")


def build_upsampler(tile: int) -> RealESRGANer:
    gpu = torch.cuda.is_available()
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4
    )
    return RealESRGANer(
        scale=4,
        model_path=WEIGHTS_PATH,
        model=model,
        tile=tile,
        tile_pad=10,
        pre_pad=0,
        half=gpu,
        gpu_id=0 if gpu else None,
    )


def process(upsampler: RealESRGANer, job: dict) -> dict:
    img = cv2.imread(job["input"], cv2.IMREAD_UNCHANGED)
    if img is None:
        return {"ok": False, "error": f"lecture image impossible: {job['input']}"}
    scale = int(job.get("scale", 4))
    with contextlib.redirect_stdout(sys.stderr):
        output, _ = upsampler.enhance(img, outscale=scale)
    cv2.imwrite(job["output"], output)
    h, w = output.shape[:2]
    return {"ok": True, "width": int(w), "height": int(h)}


def main() -> None:
    tile = int(os.environ.get("UPSCALE_TILE", "512"))
    ensure_weights()
    upsampler = build_upsampler(tile)
    gpu = torch.cuda.is_available()
    send({"ready": True, "gpu": gpu})
    log(f"worker prêt ({'cuda' if gpu else 'cpu'}, tile={tile})")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError as e:
            send({"ok": False, "error": f"json invalide: {e}"})
            continue
        if job.get("stop"):
            break
        try:
            send(process(upsampler, job))
        except Exception as e:  # noqa: BLE001 — un job ne doit pas tuer le worker
            send({"ok": False, "error": str(e)})

    log("worker arrêté")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        log(f"FATAL: {e}")
        with contextlib.suppress(Exception):
            send({"ready": False, "error": str(e)})
        sys.exit(1)
