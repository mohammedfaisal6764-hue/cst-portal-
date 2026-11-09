-- Supabase SQL Editor এ একবার run করুন (আবার run করলেও সমস্যা নেই)
-- Admin Users পাতার "🔁 Force Re-verify" বাটন এই function ডাকে।
-- কাজ: auto-confirmed (signup-এর ৫ সেকেন্ডের মধ্যে confirmed) student/group_admin দের আবার unverified করা।
-- Admin/teacher বাদ। একবারে p_limit জন (ডিফল্ট ১০) — যাতে মেইল limit পার না হয়।

create or replace function public.admin_force_reverify(p_limit int default 10) returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if (auth.jwt() ->> 'email') is distinct from 'mohammedfaisal6764@gmail.com' then
    raise exception 'শুধু admin পারবে';
  end if;
  with t as (
    select a.id from auth.users a join public.users u on u.id = a.id
    where a.email_confirmed_at is not null
      and a.email_confirmed_at - a.created_at < interval '5 seconds'
      and coalesce(u.role, 'student') in ('student', 'group_admin')
      and a.email is distinct from 'mohammedfaisal6764@gmail.com'
    order by a.created_at
    limit greatest(coalesce(p_limit, 10), 1)
  )
  update auth.users a set email_confirmed_at = null from t where a.id = t.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- কতজন auto-confirmed বাকি আছে (কিছু বদলায় না)
create or replace function public.admin_auto_confirmed_count() returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if (auth.jwt() ->> 'email') is distinct from 'mohammedfaisal6764@gmail.com' then raise exception 'শুধু admin পারবে'; end if;
  select count(*) into n from auth.users a join public.users u on u.id = a.id
  where a.email_confirmed_at is not null and a.email_confirmed_at - a.created_at < interval '5 seconds'
    and coalesce(u.role, 'student') in ('student', 'group_admin')
    and a.email is distinct from 'mohammedfaisal6764@gmail.com';
  return n;
end $$;

revoke all on function public.admin_force_reverify(int) from public, anon;
revoke all on function public.admin_auto_confirmed_count() from public, anon;
grant execute on function public.admin_force_reverify(int) to authenticated;
grant execute on function public.admin_auto_confirmed_count() to authenticated;
