-- Homework edit করলে "আপডেট" তারিখ সংরক্ষণের জন্য (Supabase → SQL Editor-এ একবার Run করুন)
alter table public.homeworks add column if not exists updated_at timestamptz;
notify pgrst, 'reload schema';
