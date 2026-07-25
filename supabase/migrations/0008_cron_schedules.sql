-- 0008_cron_schedules.sql — Schedules pg_cron (Phase 3 Edge Functions)
-- Les secrets service_role_key sont lus depuis Vault (supabase secrets set).
-- ⚠️ cron.timezone est verrouillé sur l'hébergé (restart requis) → schedules en UTC.
-- Météo : double schedule 5h + 6h UTC = couvre 7h Paris été (UTC+2) ET hiver (UTC+1).
-- L'idempotence notification_runs garantit exactement 1 envoi/jour/user
-- (le 2e run du jour échoue sur la PK et est ignoré).

-- Prix : toutes les 6 heures (fuseau indifférent)
select cron.schedule('price-alerts-6h', '0 */6 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/check-price-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    )
  );
$$);

-- Météo : 5h UTC (= 7h Paris en été)
select cron.schedule('weather-7h-summer', '0 5 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/send-weather-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    )
  );
$$);

-- Météo : 6h UTC (= 7h Paris en hiver — ignoré en été grâce à l'idempotence)
select cron.schedule('weather-7h-winter', '0 6 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/send-weather-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    )
  );
$$);
