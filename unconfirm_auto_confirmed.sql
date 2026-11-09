-- ⚠️ ধাপ ১: আগে শুধু দেখুন কারা auto-confirmed (কিছু বদলায় না)
select email, created_at, email_confirmed_at
from auth.users
where email_confirmed_at is not null
  and email_confirmed_at - created_at < interval '5 seconds'
order by created_at;

-- ⚠️ ধাপ ২: আগে মাত্র ১ জনকে (নিজের টেস্ট account) দিয়ে পরীক্ষা করুন
-- update auth.users set email_confirmed_at = null where email = 'test@gmail.com';

-- ধাপ ৩: ঠিকঠাক চললে সব auto-confirmed কে unverified করুন (admin/teacher বাদ)
-- নিচের দুই লাইনের শুরুর -- মুছে run করুন
-- update auth.users a set email_confirmed_at = null
-- where a.email_confirmed_at - a.created_at < interval '5 seconds'
--   and a.id in (select id from public.users where coalesce(role,'student') in ('student','group_admin'));
-- (এতে email_verified অটো false হয়ে যাবে — আগের trigger-এর কারণে)
