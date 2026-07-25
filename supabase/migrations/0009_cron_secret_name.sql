-- 0009_cron_secret_name.sql — FIX : les jobs de 0008 lisaient le secret Vault
-- 'SUPABASE_SERVICE_ROLE_KEY', mais ce nom est RÉSERVÉ par la plateforme
-- (non stockable via `supabase secrets set` → header Authorization NULL).
-- Recréation des 3 jobs avec le secret 'CRON_SERVICE_ROLE_KEY'.

select cron.unschedule('price-alerts-6h');
select cron.unschedule('weather-7h-summer');
select cron.unschedule('weather-7h-winter');

-- Prix : toutes les 6 heures
select cron.schedule('price-alerts-6h', '0 */6 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/check-price-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SERVICE_ROLE_KEY')
    )
  );
$$);

-- Météo : 5h UTC (= 7h Paris en été)
select cron.schedule('weather-7h-summer', '0 5 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/send-weather-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SERVICE_ROLE_KEY')
    )
  );
$$);

-- Météo : 6h UTC (= 7h Paris en hiver — ignoré en été grâce à l'idempotence)
select cron.schedule('weather-7h-winter', '0 6 * * *', $$
  select net.http_post(
    url := 'https://zrifarygomoljwhdjcbh.supabase.co/functions/v1/send-weather-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SERVICE_ROLE_KEY')
    )
  );
$$);
