# The Current's mailer

A small Google Apps Script in the **admin@palmriveracademy.edu.vn** account. Every five minutes it asks The Current's database which emails are due, sends them from admin@ with Gmail, and reports back. It sends:

- **Thank-you emails** to families who send the enrollment form or the contact / book-a-tour form on pra.edu.vn. They go in the language the family used, then the other one. The office edits the wording in The Current: Enrollments → **Emails**.
- **Alerts** about each form to Yvonne and admin@.
- **Scheduled newsletters**, once Seth or Bowen has approved them. Ten minutes before the time, the page goes on pra.edu.vn and the script starts a website build. At the time, the email goes to the edition's parent group and allstaff@, with both PDFs attached.
- Short notes to Seth and Bowen: "newsletter to approve" and "newsletter not sent".

The database decides who gets what and when. The script only carries the emails, so it rarely needs to change. It uses no Claude, no laptop and no GitHub.

The code is `the-current-mailer.gs`. The copy that runs is the one pasted into Apps Script, and this file is the record of it. If you change it here, paste it there again.

## Installing it (about fifteen minutes, once)

1. **The database.** In Supabase, open the SQL Editor and run `supabase/updates-2026-10-22-mail.sql`. The run ends with a table holding one long key (**MAILER_KEY**). Copy it. Keep it out of email and chat. If the run stops with "The form emails do not work yet", send Claude the message.
2. **The project.** In Chrome, signed in as **admin@palmriveracademy.edu.vn**, open https://script.google.com and click **New project**. Name it **The Current mailer** (top left). Delete what is in `Code.gs`, paste the whole of `the-current-mailer.gs`, and save with Ctrl+S. Then switch on the Gmail service: on the left, click **+** beside **Services**, choose **Gmail API**, and click **Add**. Without it, emails still go, but through Google's older mailer, which spoils emoji, so the script leaves emoji out of subjects.
3. **The settings.** Click **Project Settings** (the gear). Set **Time zone** to (GMT+07:00) Ho Chi Minh. Under **Script Properties**, add three:
   - `SUPABASE_URL`: `https://gpfycuxltrjeeyxnnktu.supabase.co`
   - `SUPABASE_KEY`: the publishable key, starting `sb_publishable_`. It is the `VITE_SUPABASE_PUBLISHABLE_KEY` line in `C:\Users\sbowe\admin\.env`, and the website has the same one in `src/_data/site.json`. It is public.
   - `MAILER_KEY`: the key from step 1.
4. **The check.** Back in the **Editor**, pick `check` in the function list at the top and click **Run**. Google asks to let the script send mail as admin@ and connect to an outside service. Allow it. If Google says it "hasn't verified this app", that is normal for a script you made yourself: click **Advanced**, then **Go to The Current mailer**. A "The Current mailer: test" email should arrive in admin@'s inbox.
5. **Switch it on.** Pick `install` and click **Run**. Under **Triggers** (the clock icon), there is now one trigger: `run`, every 5 minutes.
6. **In The Current.** Open **Office** → **Emails** → **Outbox**. Within five minutes it should say the mailer last checked in "just now".

Do step 1 first. Forms sent before the script is switched on (step 5) still get their emails, as long as that is within two days. Anything older is marked "not sent" rather than arriving late.

## Newsletters need the website build

A scheduled newsletter's page goes on the website ten minutes before its email. That only works if the `newsletter-build` function is set up (`supabase/functions/newsletter-build/README.md`). Deploy it with **Verify JWT off**. Without it, the email still goes out at its time, but its "read on the website" link shows nothing until the nightly build at 02:30.

## Pausing it

Add the script property `PAUSED` with the value `yes`. Nothing is sent until you delete it. Emails wait in the meantime: forms for up to two days, newsletters for up to twelve hours after their time. The Current shows that the mailer has stopped checking in.

## Sending as admin@pra.edu.vn

Once admin@pra.edu.vn is set up in admin@'s Gmail as a **Send mail as** address (Gmail settings → Accounts), add the script property `FROM` with that address. Without it, emails come from admin@palmriveracademy.edu.vn. Run `check` once afterwards: the test email shows the From line.

## A new key

If the key has been seen by someone it should not have, run this in the SQL Editor:

```sql
update adm_mailer_key set key = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
select key from adm_mailer_key;
```

Then paste the new key into `MAILER_KEY`. The old one stops working at once.

## Changing the script

Paste the new `the-current-mailer.gs` over the old one in `Code.gs` and save. Then run `check` once: Google may ask to allow a new permission (it did when the Gmail service was added on 22 October 2026), and until someone allows it, the five-minute runs fail.

## When something goes wrong

- **Emoji arrive as rows of "�" or "?".** The Gmail service is not switched on (step 2). Add it, then run `check`: its test email has a pumpkin and a flag in it.

- **The Outbox says the mailer has not checked in for a while.** Open the project, then **Executions** (the list icon). Each run is listed, and a failed run shows the error. "answered 401" or "Not allowed" means `SUPABASE_KEY` or `MAILER_KEY` is wrong.
- **An email shows "Sending did not finish".** The script took it but never said how it went. Look in admin@'s **Sent** before clicking **Send again**. It is never sent twice by itself.
- **Google's daily limit.** A Workspace account can send to about 1,500 recipients a day from a script. A Google Group counts as one recipient, so the newsletters use very little of it.
- **Removing it.** **Triggers** → the three dots → **Delete trigger**. Emails then wait in the Outbox, as when it is paused.

The triage watch (`C:\Users\sbowe\pra-triage\watch`) is a separate script in the same account. It does not depend on this one.
