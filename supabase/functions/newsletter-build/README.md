# Rebuilding the website when a newsletter is published

When the Newsletter tab's **Publish** finishes, The Current asks this function
to start the website's build on GitHub (the same build a push starts). About two
minutes later the issue is on pra.edu.vn. **Take off the website** does the same,
and so does the mailer script in admin@ when a scheduled newsletter goes on the
website ten minutes before its email.

Without it, nothing breaks: the website still builds itself every night at 02:30
and picks up whatever was published that day. But a scheduled newsletter's
email then links to a page that is not there until that night, so set this up
before the first scheduled issue.

It takes about ten minutes to set up, once.

## 1. A GitHub key that can only start builds

1. On GitHub, signed in as the owner of BowenPRA: **Settings → Developer
   settings → Personal access tokens → Fine-grained tokens → Generate new
   token**.
2. Fill in the form:
   - **Name:** `The Current: rebuild website`.
   - **Expiration:** the longest offered. Put the date in your calendar.
   - **Resource owner:** BowenPRA.
   - **Repository access:** *Only select repositories* → **BowenPRA/website**.
   - **Permissions → Repository permissions → Actions:** *Read and write*. Leave everything else at *No access*.
3. **Generate token** and copy it. GitHub shows it once.

Keep it private. Do not paste it into chat, email, or any file in these projects.

## 2. Supabase

1. **Edge Functions → Secrets:** add `GH_TOKEN` with the key.
2. **Edge Functions → Deploy a new function → Via Editor.** The name must be
   exactly `newsletter-build`. Paste `index.ts` from this folder and deploy.
   Turn **Verify JWT** off. The function checks every caller itself: an office
   account signed in to The Current, or the mailer script in admin@ with its key
   (`scripts/mailer`), which starts a build when a scheduled newsletter goes on
   the website. The script has no sign-in, so Supabase's own check would stop it.

## 3. Check

In The Current, open a published issue and use **Rebuild the website** on its
Publish panel. "Building…" should turn into "On the website" within about three
minutes. If it says the key cannot start builds, the token is missing the
*Actions: Read and write* permission, or it is not for BowenPRA/website.

When the key expires, GitHub emails you. Make a new one (step 1) and replace the
`GH_TOKEN` secret.
