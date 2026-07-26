-- 0017_image_url_2x.sql — Colonne image upscale ×4 (page détail uniquement)
-- Peuplée par scripts/migrate-upscale.ts (worker Python Real-ESRGAN + CUDA).
-- Les cartes/grilles continuent d'utiliser image_url (1x, ~30-80 Ko).
-- La fiche détail charge image_url_2x en swap progressif (~200-400 Ko).

alter table public.parfums
  add column if not exists image_url_2x text;

comment on column public.parfums.image_url_2x is
  'URL WebP upscale ×4 (1500×2000) — affichage fiche détail / lightbox uniquement';
