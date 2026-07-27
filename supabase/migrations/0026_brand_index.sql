-- 0026_brand_index.sql — Index sur marque pour la page maison (/brand/[name]).
-- La fiche détail (chip « La maison ») et les sélecteurs de marques (BrandCapsules,
-- BrandSheet) naviguent vers /brand/<marque>, qui filtre les parfums par marque exacte
-- (getParfumsByMarque, PostgREST .eq). Sans index dédié, ce filtre ferait un seq scan
-- sur ~25K lignes. Miroir de parfums_perfumers_gin (0004) qui porte la page /perfumer.

create index if not exists parfums_marque_idx
  on public.parfums (marque);
