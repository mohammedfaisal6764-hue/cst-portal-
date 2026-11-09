-- Supabase SQL Editor-এ run করুন (বারবার run করলেও error হবে না)
create table if not exists public.site_settings (
  key   text primary key,
  value jsonb
);
alter table public.site_settings enable row level security;

drop policy if exists "read site settings" on public.site_settings;
create policy "read site settings" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "admin insert site settings" on public.site_settings;
create policy "admin insert site settings" on public.site_settings
  for insert to authenticated with check (auth.jwt() ->> 'email' = 'mohammedfaisal6764@gmail.com');

drop policy if exists "admin update site settings" on public.site_settings;
create policy "admin update site settings" on public.site_settings
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'mohammedfaisal6764@gmail.com')
  with check (auth.jwt() ->> 'email' = 'mohammedfaisal6764@gmail.com');

insert into public.site_settings (key, value) values
  ('wallpaper', '{"url":"/wallpapers/photos/foggy-forest.jpg"}'),
  ('wallpaper_access', '{"mode":"none","ids":[]}'),
  ('wallpaper_library', '{"items":[]}')
on conflict (key) do nothing;

-- আগে Unsplash/picsum লিংক বসানো থাকলে সেটা সাইটের নিজের ছবিতে বদলে দেয়
update public.site_settings set value = '{"url":"/wallpapers/photos/foggy-forest.jpg"}'
 where key = 'wallpaper' and (value->>'url' like '%unsplash.com%' or value->>'url' like '%picsum.photos%');
