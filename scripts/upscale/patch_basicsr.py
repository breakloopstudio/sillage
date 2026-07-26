"""
Patch basicsr pour torchvision >= 0.17 (idempotent).

basicsr 1.4.2 importe `torchvision.transforms.functional_tensor`, module
supprimé dans torchvision 0.17+. On réécrit l'import vers
`torchvision.transforms.functional`. À lancer après `uv pip install`.

Usage: python patch_basicsr.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "venv", "Lib", "site-packages", "basicsr", "data", "degradations.py")

OLD = "from torchvision.transforms.functional_tensor import rgb_to_grayscale"
NEW = "from torchvision.transforms.functional import rgb_to_grayscale"


def main() -> None:
    if not os.path.exists(TARGET):
        sys.stderr.write(f"FAIL: {TARGET} introuvable (venv non installé ?)\n")
        sys.exit(1)

    src = open(TARGET, encoding="utf-8").read()
    if NEW in src:
        print("basicsr déjà patché — rien à faire.")
        return
    if OLD not in src:
        print("Import attendu absent — basicsr a peut-être changé, à vérifier.")
        return

    open(TARGET, "w", encoding="utf-8").write(src.replace(OLD, NEW))
    print("basicsr patché (functional_tensor → functional).")


if __name__ == "__main__":
    main()
