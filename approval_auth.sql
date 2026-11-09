-- Supabase SQL Editor এ একবার run করুন (আবার run করলেও সমস্যা নেই)
-- ফাইল approval: নতুন কলাম। আগের সব ফাইল approved থাকবে।
alter table public.files add column if not exists approved boolean not null default true;

-- (ঐচ্ছিক) Dup Roll দ্রুত খুঁজতে
create index if not exists users_roll_idx on public.users (roll);
