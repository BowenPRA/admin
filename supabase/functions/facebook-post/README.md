# Posting to Facebook from The Current

The Photos tab's **Post to Facebook…** button sends a draft post (its saved text
and its photos, cut to the post's shape and in order) to Palm River Academy's
Facebook Page, straight away or at a set time. This function does the posting,
because the key that lets it post to the Page must never be in the app itself:
the app and its repository are public.

The function checks everything again before anything reaches Facebook: the
person must be signed in with an office account, every photo in the post must
be in the album and checked against the no-photo list, and a post that is on
Facebook already cannot be sent again.

Setting it up takes about half an hour, once. Three parts: Meta, Supabase, then
the app.

## 1. Meta: an app and a key for the Page

You need to be an admin of the Palm River Academy Page (full control, or at
least "Create content").

1. Go to <https://developers.facebook.com>, sign in with your own Facebook
   account and choose **My Apps → Create app**.
   - Name: `The Current`. Contact email: admin@.
   - Use case: **Manage everything on your Page**.
   - Business portfolio: choose PRA's if it has one, otherwise skip.
2. In the app, open the use case (**Customize**) and add the permissions
   `pages_manage_posts`, `pages_read_engagement` and `pages_show_list`.
   Only the people with a role on this app will use it, so it needs **no App
   Review**.
3. **App settings → Basic**: fill in the Privacy Policy URL, a category and an
   icon, then set the app to **Live** (the switch at the top).
   *This matters:* while the app is in Development mode, what it posts is shown
   only to the people with a role on the app. Everyone else sees nothing, or the
   post without its photos.
   Meta asks for a privacy policy page before an app can go Live. The website has
   none yet (pra.edu.vn/privacy/ is a 404).
4. Get the Page key:
   1. Open the **Graph API Explorer**
      (<https://developers.facebook.com/tools/explorer>). Meta App: `The
      Current`. User or Page: **Get User Access Token**, tick the three
      permissions above, **Generate Access Token**, and allow the Palm River
      Academy Page when Facebook asks.
   2. Click the **ⓘ** next to the key, then **Open in Access Token Tool**, then
      **Extend Access Token**. Copy the long key it gives you.
   3. Back in the Explorer, paste that long key in the Access Token box and run
      `GET me/accounts?fields=name,id,access_token`.
   4. In the answer, find Palm River Academy. Its `id` is the **Page ID**, and
      its `access_token` is the **Page key**. A Page key made from an extended
      key does not expire. It stops working only if you lose your role on the
      Page, change your Facebook password, or remove the app.

Keep the Page key private. Do not paste it into chat, email, or any file in
these projects.

## 2. Supabase

1. **SQL Editor**: run `supabase/updates-2026-09-29-facebook.sql` (adds one
   column; it is safe to run twice).
2. **Edge Functions → Deploy a new function → Via Editor**. Name it exactly
   `facebook-post`, replace the sample with the whole of
   `supabase/functions/facebook-post/index.ts`, then **Deploy**.
   (Or, from `C:\Users\bowen\admin`: `npx supabase functions deploy facebook-post`.)
3. **Edge Functions → Secrets**: add
   - `FB_PAGE_ID` = the Page ID
   - `FB_TOKEN` = the Page key

## 3. The app

Deploy The Current as usual (`npm run deploy`). Open an event in the Photos tab,
then **Facebook** → **Post to Facebook…** on a post. The dialog names the Page when
everything is connected. If something is missing, it says which step to do.

## Afterwards

- **To post:** the button stays locked until every photo in the post has been
  checked. The text posted is exactly what is in the box.
- **To schedule:** pick a time between 15 minutes and 29 days ahead. A
  scheduled post can be cancelled from its card until it goes out, or changed
  in Meta Business Suite.
- **Once it is out:** edit or delete it on Facebook. **Back to draft** only
  changes The Current; the post stays on Facebook.
- **When the key stops working** (the dialog says Facebook no longer accepts
  it): repeat step 1.4 and replace `FB_TOKEN`. Nothing needs redeploying.
