"""
Worker upscale Real-ESRGAN — appelé en subprocess par migrate-upscale.ts

Usage:
    python upscale.py <input> <output> [--scale 4] [--tile 512]

Auto-télécharge les poids RealESRGAN_x4plus.pth au premier run (~64 MB).
CUDA auto-détecté (half precision sur GPU), fallback CPU transparent.
Sortie : stderr log, exit 0 = OK, exit != 0 = échec.
"""
import argparse
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


def ensure_weights() -> None:
    if os.path.exists(WEIGHTS_PATH) and os.path.getsize(WEIGHTS_PATH) > 0:
        return
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    sys.stderr.write("Téléchargement des poids RealESRGAN_x4plus.pth...\n")
    tmp = WEIGHTS_PATH + ".part"
    urllib.request.urlretrieve(WEIGHTS_URL, tmp)
    os.replace(tmp, WEIGHTS_PATH)
    sys.stderr.write(f"OK ({os.path.getsize(WEIGHTS_PATH) / 1e6:.1f} MB)\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--tile", type=int, default=512)
    args = ap.parse_args()

    ensure_weights()

    gpu = torch.cuda.is_available()
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4
    )
    upsampler = RealESRGANer(
        scale=4,
        model_path=WEIGHTS_PATH,
        model=model,
        tile=args.tile,
        tile_pad=10,
        pre_pad=0,
        half=gpu,
        gpu_id=0 if gpu else None,
    )

    img = cv2.imread(args.input, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.stderr.write(f"FAIL: lecture image impossible: {args.input}\n")
        sys.exit(2)

    output, _ = upsampler.enhance(img, outscale=args.scale)
    cv2.imwrite(args.output, output)

    h, w = output.shape[:2]
    sys.stderr.write(f"OK {w}x{h} {'cuda' if gpu else 'cpu'}\n")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"FAIL: {e}\n")
        sys.exit(1)
