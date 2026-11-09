-- Supabase SQL Editor এ একবার run করুন (আবার run করলেও সমস্যা নেই)
-- 1) কলাম
alter table public.users add column if not exists email_verified boolean not null default false;
alter table public.users add column if not exists email_verified_at timestamptz;

-- 2) যারা আগেই verify করেছে তাদের তথ্য আনা
update public.users u
set email_verified = (a.email_confirmed_at is not null),
    email_verified_at = a.email_confirmed_at
from auth.users a
where a.id = u.id;

-- 3) এখন থেকে verify করলেই নিজে নিজে আপডেট হবে
create or replace function public.sync_email_verified() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  update public.users
  set email_verified = (new.email_confirmed_at is not null),
      email_verified_at = new.email_confirmed_at
  where id = new.id;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_sync_email_verified on auth.users;
create trigger trg_sync_email_verified
after insert or update of email_confirmed_at on auth.users
for each row execute function public.sync_email_verified();
