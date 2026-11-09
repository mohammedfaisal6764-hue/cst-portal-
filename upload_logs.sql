-- Supabase SQL Editor-এ একবার run করুন (Upload Log চালু করতে)
create table if not exists public.upload_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  user_name   text,
  user_email  text,
  user_role   text,
  file_id     uuid,
  subject     text,
  file_type   text,
  section     text,
  chapter     text,
  file_name   text,
  size        text,
  uploaded_at timestamptz default now()
);
alter table public.upload_logs enable row level security;
-- যেকোনো logged-in user নিজের upload log লিখতে পারবে
create policy "insert own upload log" on public.upload_logs
  for insert to authenticated with check (auth.uid() = user_id);
-- শুধু admin দেখতে পারবে
create policy "admin read upload logs" on public.upload_logs
  for select to authenticated
  using (auth.jwt() ->> 'email' = 'mohammedfaisal6764@gmail.com');
