-- Supabase SQL Editor এ একবার run করুন (আবার run করলেও সমস্যা নেই)
-- Push notification: প্রতিটা user-এর subscription রাখার টেবিল + অনুমতি

create table if not exists public.push_subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  section    text,
  endpoint   text not null,
  p256dh     text,
  auth       text,
  updated_at timestamptz default now()
);

-- আগে টেবিল থাকলে: user_id unique না হলে upsert ব্যর্থ হয়, তাই duplicate সরিয়ে unique বানানো
delete from public.push_subscriptions a using public.push_subscriptions b
  where a.ctid < b.ctid and a.user_id = b.user_id;
create unique index if not exists push_subscriptions_user_id_key on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push select" on public.push_subscriptions;
drop policy if exists "own push insert" on public.push_subscriptions;
drop policy if exists "own push update" on public.push_subscriptions;
drop policy if exists "own push delete" on public.push_subscriptions;
create policy "own push select" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "own push insert" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "own push update" on public.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push delete" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);
-- (Netlify function service key দিয়ে চলে, তাই সবার subscription পড়তে পারে)
