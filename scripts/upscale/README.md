# Upscale — Real-ESRGAN (Python + CUDA)

Deux workers Python dans un venv isolé, appelés par `scripts/migrate-upscale.ts`.
Exploitent le GPU (CUDA, half precision) ; fallback CPU transparent.

- `upscale_worker.py` — worker **persistant** utilisé par la migration : le modèle
  est chargé une fois, les images défilent en JSON-lines stdin/stdout (~0,5 s/image).
- `upscale.py` — CLI one-shot pour un upscale manuel (recharge le modèle à chaque appel).

## Setup (one-time)

```powershell
# 1. Créer le venv en Python 3.10 (uv télécharge la version si absente)
uv venv scripts/upscale/venv --python 3.10

# 2. torch + CUDA (index PyTorch — NE PAS utiliser PyPI par défaut sur Windows)
uv pip install --python scripts/upscale/venv/Scripts/python.exe torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 3. realesrgan + opencv
uv pip install --python scripts/upscale/venv/Scripts/python.exe -r scripts/upscale/requirements.txt

# 4. Patch basicsr (torchvision >= 0.17 a supprimé functional_tensor)
scripts/upscale/venv/Scripts/python.exe scripts/upscale/patch_basicsr.py
```

Les poids `RealESRGAN_x4plus.pth` (~64 MB) sont téléchargés automatiquement
au premier run dans `scripts/upscale/weights/`.

## Test manuel (CLI one-shot)

```powershell
scripts/upscale/venv/Scripts/python.exe scripts/upscale/upscale.py input.webp output.png --scale 4
```

## Workflows (migrate-upscale)

```powershell
# Batch standard : tous les parfums dont image_url_2x est NULL (reprend au checkpoint)
npm run migrate-upscale

# Simulation / test
npm run migrate-upscale -- --dry-run
npm run migrate-upscale -- --limit=20

# Régénérer des parfums précis (ex. après remplacement de leur image 1x)
npm run migrate-upscale -- --ids=marque_nom_1,marque_nom_2

# Tout régénérer (ex. changement de modèle/qualité) — ignore image_url_2x et le checkpoint
npm run migrate-upscale -- --force
```

- **Nouveaux parfums** : ajoutés avec `image_url_2x = NULL` → pris automatiquement au
  prochain `npm run migrate-upscale` (batch standard).
- **Remplacement d'image** : `updateParfum(id, { imageUrl })` remet `image_url_2x` à
  `NULL` (invalidation auto du dérivé) → régénéré au prochain batch, ou immédiatement
  via `--ids=<id>`.
- En attendant la 2x, la fiche détail affiche la 1x (fallback transparent).

## Modèle & débit

`RealESRGAN_x4plus` (RRDBNet) — upscale ×4, optimisé photos réelles.
Source 375×500 → sortie 1500×2000.

Débit réel constaté (RTX 3060 Ti) : **~0,5 image/s**, plafonné par le coût série
par image (upscale GPU + I/O image 1500×2000 + 3 allers-retours Supabase).
Augmenter la concurrence n'accélère pas (testé 2/3/6 workers).
→ ~24 K images en **~10 h** (run non supervisé, resumable).

## Pipeline (migrate-upscale.ts)

```
download primary.webp (Supabase Storage)
  → écrit tmp .webp (zéro décode)
  → worker Python : cv2.imread webp → Real-ESRGAN ×4 (CUDA) → cv2.imwrite PNG
  → sharp encode WebP q85 (plus rapide que l'encodeur webp de cv2)
  → upload primary_2x.webp
  → UPDATE parfums.image_url_2x
```

## Structure

```
scripts/upscale/
├── upscale_worker.py   # worker persistant (migration)
├── upscale.py          # CLI one-shot (manuel)
├── patch_basicsr.py    # patch torchvision>=0.17 (idempotent)
├── requirements.txt    # deps hors torch
├── venv/               # environnement isolé (gitignoré)
└── weights/            # RealESRGAN_x4plus.pth (gitignoré, téléchargé auto)
```
