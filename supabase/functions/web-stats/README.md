# Website numbers in The Current

pra.edu.vn counts its visitors with **Cloudflare Web Analytics**: a small script
on every page (`analytics.cloudflareToken` in the website's `src/_data/site.json`),
no cookies, nobody identified. The numbers are in Cloudflare's dashboard
(admin@palmriveracademy.edu.vn's account, Observability → Analytics → Web analytics).

The Current's **Website** page (Outreach, office accounts) shows the same numbers.
It asks this function, which holds a read-only Cloudflare key; the key must never
reach the browser, because the app and its repository are public.

It takes about five minutes to set up, once.

## 1. A Cloudflare key that can only read the numbers

1. In Cloudflare, signed in as admin@palmriveracademy.edu.vn: the person icon at
   the top right → **Profile → API Tokens → Create Token → Create Custom Token**.
2. Fill in the form:
   - **Name:** `The Current: website numbers`.
   - **Permissions:** *Account* → *Account Analytics* → *Read*. Nothing else.
   - **Account Resources:** *Include* → the admin@palmriveracademy account.
   - **TTL:** leave empty (the key does not expire).
3. **Continue to summary → Create Token** and copy it. Cloudflare shows it once.

Keep it private. Do not paste it into chat, email, or any file in these projects.

## 2. Supabase

1. **Edge Functions → Secrets:** add `CF_API_TOKEN` with the key.
2. **Edge Functions → Deploy a new function → Via Editor.** The name must be
   exactly `web-stats`. Paste `index.ts` from this folder and deploy.
   Turn **Verify JWT** off. The function checks every caller itself: only an
   office account signed in to The Current gets numbers.
   (Or, from `C:\Users\sbowe\admin`: `npx supabase functions deploy web-stats --no-verify-jwt`.)

Optional secrets: `CF_ACCOUNT_ID` (another Cloudflare account) and `SITE_HOST`
(another address than pra.edu.vn).

## 3. Check

In The Current, open **Outreach → Website**. The four numbers at the top should
match Cloudflare's own page for the same days. If it says the key was not
accepted, the key was deleted or lacks *Account Analytics: Read*: make a new one
(step 1) and replace the `CF_API_TOKEN` secret. Nothing needs redeploying.

## How it counts

- A **visit** is someone arriving from another site, a search, an app or by typing
  the address. Moving between our own pages adds **page views**, not visits.
- Days are Vietnam days (UTC+7). "Last 7 days" is today so far and the six days
  before; the comparison is the same stretch just before.
- Cloudflare answers from a 1-in-10 sample for any stretch longer than about a
  week, which for a site our size turns 3 views into 0 or 10. The function asks
  for 30 and 90 days in pieces of 7 days, all at once, and adds them up, so the
  numbers are exact.
- Cloudflare keeps about six months, so 90 days is the longest the page offers
  (90 days and the 90 before them).
- People who block trackers are not counted.
