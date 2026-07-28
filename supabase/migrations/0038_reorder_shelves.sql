-- 0038_reorder_shelves.sql
-- Réordonnancement atomique des étagères (drag & drop du gestionnaire).
-- Une seule transaction écrit tous les `order` → aucun état intermédiaire / flicker
-- côté realtime. SECURITY DEFINER car on écrit plusieurs lignes ; le check owner
-- est fait par `user_id = auth.uid()` dans la clause WHERE.

create or replace function public.reorder_shelves(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_el  jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for v_el in select * from jsonb_array_elements(p_items)
  loop
    update public.shelves
       set "order" = (v_el ->> 'order')::int
     where id = (v_el ->> 'id')::uuid
       and user_id = v_uid;
  end loop;
end;
$$;

grant execute on function public.reorder_shelves(jsonb) to authenticated;
