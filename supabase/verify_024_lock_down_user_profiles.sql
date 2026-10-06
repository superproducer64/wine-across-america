-- Verification for migration 024. Run each block separately in the Supabase SQL
-- editor (after applying 024). Every block is wrapped in begin/rollback, so
-- nothing persists. Blocks that must be REJECTED are DO blocks: silent = PASS,
-- an error starting "FAIL" = the protection is not working.
-- Result-returning blocks end in a single SELECT; read the booleans.
--
-- Users: explorer = paa_explorer@paa.com (non-admin); admin = first app_admins row.

-- ═══ T1. explorer: user_profiles / user_activity_summary = 1 row; views have no email ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select
  (select count(*) from public.user_profiles)          as user_profiles_rows,          -- expect 1
  (select count(*) from public.user_activity_summary)  as activity_rows,               -- expect 1
  (select count(*) from public.member_directory)       as directory_rows,              -- expect all visible members
  (select count(*) from public.member_profiles)        as member_profiles_rows,        -- expect all members
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name in ('member_directory', 'member_profiles')
      and column_name ilike '%email%')                  as email_columns;              -- expect 0
rollback;

-- ═══ T2. explorer: search_members still works (security definer) ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.search_members('a');   -- expect rows (visible members, no email column)
rollback;

-- ═══ T3. explorer: self-setting is_creator must FAIL ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    update public.user_profiles set is_creator = true where id = auth.uid();
    raise exception 'FAIL T3: is_creator update was allowed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
rollback;

-- ═══ T4. explorer: self-setting user_role = 'sommelier' alone must FAIL ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    update public.user_profiles set user_role = 'sommelier' where id = auth.uid();
    raise exception 'FAIL T4: user_role update was allowed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
rollback;

-- ═══ T5. explorer: self-setting sommelier_status = 'approved' must FAIL ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    update public.user_profiles
       set sommelier_status = 'approved', sommelier_cert_url = 'x' where id = auth.uid();
    raise exception 'FAIL T5: sommelier_status = approved was allowed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
rollback;

-- ═══ T6. explorer: applying (same update submitSommelierApplication sends) must WORK ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
update public.user_profiles
   set sommelier_cert_url = 'https://example.com/cert.jpg',
       sommelier_status = 'pending'
 where id = auth.uid();
-- user_role is no longer sent by the app; it stays 'enthusiast' until an admin approves
select user_role, sommelier_status from public.user_profiles;   -- expect enthusiast / pending
rollback;

-- ═══ T7. explorer: admin push tokens only while pending ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as tokens_before_applying from public.get_admin_push_tokens();   -- expect 0
update public.user_profiles
   set sommelier_cert_url = 'x', sommelier_status = 'pending'
 where id = auth.uid();
select count(*) as tokens_after_applying from public.get_admin_push_tokens();    -- expect = admins with a push_token
rollback;

-- ═══ T8. explorer: anon role gets nothing from the views ═══
begin;
set local role anon;
do $$ begin
  begin
    perform 1 from public.member_profiles limit 1;
    raise exception 'FAIL T8: anon can read member_profiles';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
rollback;

-- ═══ T9. admin: sees every profile, real wine counts ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.app_admins limit 1),
                    'role', 'authenticated')::text, true);
select set_config('test.total_profiles', (select count(*) from public.user_profiles)::text, true);  -- as postgres
set local role authenticated;
select
  (select count(*) from public.user_profiles)                          as profiles_seen,   -- expect = total
  current_setting('test.total_profiles')                               as profiles_total,
  (select count(*) from public.user_activity_summary)                  as activity_rows,   -- expect = total
  (select coalesce(sum(wines_logged), 0) from public.user_activity_summary) as wines_logged_sum; -- expect > 0, = wine_entries count
rollback;

-- ═══ T10. admin: approval of another user still works (as updateSommelierStatus does) ═══
-- If this reports 0 rows updated, an admin UPDATE policy on user_profiles is
-- missing live (the self_update policy only covers own row). That is a
-- pre-existing gap, not caused by 024.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.app_admins limit 1),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  update public.user_profiles
     set sommelier_status = 'approved', user_role = 'sommelier'
   where id = (select id from public.user_profiles where id <> auth.uid() limit 1);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FAIL T10: admin update affected 0 rows (no admin UPDATE policy?)'; end if;
end $$;
rollback;

-- ═══ T11. paa_som: admin panel data (pending queue, activity, all profiles) ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_som@paa.com'),
                    'role', 'authenticated')::text, true);
select set_config('test.total_profiles', (select count(*) from public.user_profiles)::text, true);  -- as postgres
select set_config('test.total_pending', (select count(*) from public.user_profiles
                                          where sommelier_status = 'pending')::text, true);
set local role authenticated;
select
  (select is_creator from public.user_profiles where id = auth.uid())   as is_creator,        -- expect true (UI gate)
  exists (select 1 from public.app_admins where user_id = auth.uid())    as in_app_admins,     -- expect true
  (select count(*) from public.user_profiles)                            as profiles_seen,     -- expect = total
  current_setting('test.total_profiles')                                 as profiles_total,
  (select count(*) from public.user_profiles where sommelier_status = 'pending') as pending_seen, -- expect = pending total
  current_setting('test.total_pending')                                  as pending_total,
  (select count(*) from public.user_activity_summary)                    as activity_rows;     -- expect = total profiles
rollback;

-- ═══ T12. explorer: self-promotion into app_admins must FAIL (re-run) ═══
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'paa_explorer@paa.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.app_admins (user_id) values (auth.uid());
    raise exception 'FAIL T12: explorer inserted itself into app_admins';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
rollback;
