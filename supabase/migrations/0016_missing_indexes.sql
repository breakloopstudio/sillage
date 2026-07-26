-- 0016 — Index manquants (audit P2)

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

create index if not exists user_settings_weather_idx
  on public.user_settings (weather_notifs, push_notifs)
  where weather_lat is not null;
