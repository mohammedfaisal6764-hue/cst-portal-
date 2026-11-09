-- Section C তুলে দেওয়া হয়েছে: সব Section C-এর ডেটা এখন Section B
-- Supabase → SQL Editor-এ একবার Run করুন
update public.homeworks          set section = 'B' where section = 'C';
update public.files              set section = 'B' where section = 'C';
update public.users              set section = 'B' where section = 'C';
update public.push_subscriptions set section = 'B' where section = 'C';
