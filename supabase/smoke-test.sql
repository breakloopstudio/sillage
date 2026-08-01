-- Smoke test du schéma Sillage (local)
-- 1. Données de test
insert into public.parfums (id, nom, marque, famille_olfactive, notes_tete, notes_coeur, notes_fond, main_accords, perfumers, popularity_score, review_count, rating_count, image_url)
values
  ('chanel_no5', 'N°5', 'Chanel', 'Floral Aldéhydé', '{Aldehydes,Neroli,Ylang-Ylang}', '{Jasmine,Rose,Iris}', '{Sandalwood,Vanilla,Vetiver}', '{aldehydic,powdery,floral}', '{Ernest Beaux}', 98, 15200, 12100, 'https://example.com/no5.webp'),
  ('chanel_bleu_de_chanel', 'Bleu de Chanel', 'Chanel', 'Boisé Aromatique', '{Grapefruit,Lemon,Mint}', '{Ginger,Nutmeg,Jasmine}', '{Cedar,Sandalwood,Incense}', '{citrus,woody,fresh}', '{Jacques Polge}', 99, 28400, 21000, 'https://example.com/bleu.webp'),
  ('dior_sauvage', 'Sauvage', 'Dior', 'Aromatique Fougère', '{Bergamot,Pepper}', '{Lavender,Sichuan Pepper}', '{Ambroxan,Cedar}', '{fresh,spicy,woody}', '{François Demachy}', 100, 45100, 32000, 'https://example.com/sauvage.webp'),
  ('jpg_le_male', 'Le Mâle', 'Jean Paul Gaultier', 'Oriental Fougère', '{Lavender,Mint,Bergamot}', '{Cinnamon,Orange Blossom}', '{Vanilla,Tonka Bean,Sandalwood}', '{vanilla,sweet,warm}', '{Francis Kurkdjian}', 97, 22800, 18400, 'https://example.com/lemale.webp'),
  ('guerlain_lhomme_ideal', 'L''Homme Idéal', 'Guerlain', 'Boisé Aromatique', '{Citrus,Rosemary,Orange Blossom}', '{Almond,Tonka Bean}', '{Leather,Cedar,Vetiver}', '{almond,woody,sweet}', '{Thierry Wasser}', 92, 8900, 7100, 'https://example.com/ideal.webp');

\echo '=== 2. search_text / search_vector générés automatiquement'
select id, search_text, left(search_vector::text, 60) as vector_head from public.parfums order by id;

\echo '=== 3. Recherche exacte "chanel" (2 attendus, Bleu en tête car plus populaire)'
select id from public.search_parfums('chanel');

\echo '=== 4. Recherche avec typo "chanell" (fallback trgm attendu)'
select id from public.search_parfums('chanell');

\echo '=== 5. Multi-tokens "jean paul gaultier le male" (le_male attendu)'
select id from public.search_parfums('jean paul gaultier le male');

\echo '=== 6. Sans accents "l homme ideal" (guerlain attendu — unaccent + stop words)'
select id from public.search_parfums('l homme ideal');

\echo '=== 7. Stop words purs "eau de" (vide attendu)'
select count(*) as nb from public.search_parfums('eau de');

\echo '=== 8. similar_parfums sur accords de Sauvage'
select id from public.similar_parfums('{fresh,spicy,woody}'::text[], 'dior_sauvage', 3);

\echo '=== 9. RLS : parfums lisibles en anon'
set role anon;
select count(*) as parfums_visibles_anon from public.parfums;
reset role;

\echo '=== 10. RLS : favoris inaccessibles en anon (0 policy)'
set role anon;
select count(*) as favoris_visibles_anon from public.favoris;
reset role;

\echo '=== 11. Publication realtime (6 tables attendues)'
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;

\echo '=== 12. Stop words seedés (38 attendus)'
select count(*) as stop_words from public.search_stop_words;

-- Auto-nettoyage : le smoke test est rejouable sans polluer la base
delete from public.parfums where image_url like 'https://example.com/%';

\echo '=== FIN SMOKE TEST (données de test supprimées)'
