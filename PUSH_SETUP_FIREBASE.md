# Push Notification সেটআপ (Firebase Hosting + Supabase Edge Function)

Firebase Hosting-এ Netlify function চলে না। তাই notification পাঠানোর ছোট সার্ভার-ফাংশনটা Supabase-এ চলে (বিনামূল্যে, card লাগে না)।

## ধাপ ১ — SQL
Supabase → SQL Editor → `push_setup.sql` পুরোটা paste করে Run।

## ধাপ ২ — VAPID key (একবার)
আপনার কাছে আগের private key থাকলে সেটাই দিন (অ্যাপের কোডের public key-র জোড়া)।
না থাকলে কম্পিউটারে চালান: `npx web-push generate-vapid-keys`
→ নতুন Public key পেলে `src/push.js`-এর `VAPID_PUBLIC_KEY` বদলাতে হবে (আমাকে বলুন), আর সবাইকে notification আবার চালু করতে হবে।

## ধাপ ৩ — Secrets
Supabase → Edge Functions → Secrets (বা Project Settings → Edge Functions) → Add:
- `VAPID_PUBLIC_KEY`  = public key
- `VAPID_PRIVATE_KEY` = private key
- `VAPID_EMAIL`       = আপনার ইমেইল
(SUPABASE_URL ও service key নিজে থেকেই থাকে।)

## ধাপ ৪ — Function deploy
**সহজ (dashboard):** Supabase → Edge Functions → Deploy a new function → Via Editor → নাম `send-push` →
`supabase/functions/send-push/index.ts` ফাইলের পুরো লেখা paste → Deploy।
Function সেটিংসে **"Verify JWT" বন্ধ** রাখুন (ফাংশন নিজেই লগইন ও role যাচাই করে)।

**CLI:** `npx supabase functions deploy send-push --project-ref dzmwjmjefjzxpjoforrk --no-verify-jwt`

## ধাপ ৫ — সাইট আবার deploy
`npm run build` → `firebase deploy`

## পরীক্ষা
Admin → Profile → "🧪 সবাইকে টেস্ট notification পাঠান"। ফলাফলে দেখাবে কতজনের কাছে গেছে।
প্রত্যেক user-কে Home-এর "🔔 চালু করুন" ব্যানারে একবার Allow দিতে হবে।
