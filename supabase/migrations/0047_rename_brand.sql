-- 0047_rename_brand.sql — Renommage ParfumScan → Sillage (export RGPD)

create or replace function public.export_user_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select jsonb_build_object(
    'exportedAt', now(),
    'app', 'Sillage',
    'version', '3.0.0',
    'collections', jsonb_build_object(
      'favoris',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favoris t where t.user_id = v_uid),
      'userParfum',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_parfum t where t.user_id = v_uid),
      'possessions',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.possessions t where t.user_id = v_uid),
      'scans',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.scans t where t.user_id = v_uid),
      'shelves',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shelves t where t.user_id = v_uid),
      'sotd',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sotd t where t.user_id = v_uid),
      'priceAlerts',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.price_alerts t where t.user_id = v_uid),
      'settings',     (select to_jsonb(t) from public.user_settings t where t.user_id = v_uid)
    ),
    'excluded', jsonb_build_array(
      jsonb_build_object(
        'table', 'push_tokens',
        'reason', 'Identifiants techniques de notification, régénérés automatiquement'
      )
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;
