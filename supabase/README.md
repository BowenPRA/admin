# Database files

Each `.sql` file here is a change to The Current's database. Bowen runs them by hand
in Supabase > SQL Editor: paste the whole file, press Run. Every file is safe to run
again, and its first lines say what it does and what it must run after.

## Order

A new database runs them in this order. On the live database a new file is run once,
after the ones before it; files not yet run there are noted on the To-Do tab.

1. `schema.sql`, then `reports.sql`
2. The `updates-…` files in date order (the date is in the name):
   - 14 Sep, then 15 Sep (`updates-2026-09-15.sql` first, then `-legal-names`, `-report-tiers`), 16 Sep, 17 Sep
   - 21 Sep (`-early-years`, `-receipt-proof`), 22 Sep (`-no-excused`, `-partial-day`, `-private-photos`)
   - 28 Sep (`-event-photos`, then `-event-photos-website`), 29 Sep (`-facebook`)
   - 30 Sep (`-leads` first, then `-website-forms` and `-enrollments`)
   - 1 Oct (`-enrollment-fix`, then `-enrollment-schools-documents`; `-receipt-numbers`; `-todos`, then `-todo-delete`; `-travel`)
   - 2 Oct (`-master-minds-movement`, `-student-dates-onboarding`)

When one file needs another first, its header says so ("after updates-2026-09-30-leads.sql").

## New tables need explicit grants (from 30 October 2026)

Supabase wrote on 24 September 2026: from **30 October 2026** a table created in the
`public` schema is no longer reachable by the app until it is granted to the app's
roles. Tables made before that date keep their grants; nothing changes for them.

So **every file that creates a table grants it in the same file**, right after the
`create table`. Copy these lines and put the table's name in:

```sql
grant select, insert, update, delete on public.your_table to authenticated;
grant select, insert, update, delete on public.your_table to service_role;
```

`authenticated` is everyone signed in to The Current; `service_role` is the secret key
that scripts use. Supabase's own example also has `grant select on public.your_table to anon;`.
At PRA, `anon` is the public website, and it reads no table directly: the website's
forms go through a database function (`adm_web_submit`, `adm_enroll_submit`). So leave
the `anon` line out unless the website really must read that table, and then write
why next to it.

The grant only opens the door. Who sees which rows is still the table's row level
security, which every table here has:

```sql
alter table your_table enable row level security;
-- then its rules, in the pattern of the neighbouring files, e.g. office accounts only:
create policy staff_all on your_table for all to authenticated
  using (adm_is_staff()) with check (adm_is_staff());
```

Three more things from Supabase's notice:

- A new **function** the app calls needs its own grant; table grants do not cover it.
  The files here already do this: `revoke all on function f(…) from public, anon;`
  then `grant execute on function f(…) to authenticated;`.
- A table whose key is a `serial` number also needs `grant usage on sequence your_table_id_seq to authenticated;`.
  Tables here use `uuid` keys (`default gen_random_uuid()`), which need nothing more.
- A **view** counts as a table: grant it the same way, and create it `with (security_invoker = on)`
  so it does not get round the row rules of the tables under it.

If a grant is missing, the app shows "permission denied for table …", and Supabase
names the grant to run. Sources: Supabase's email "New tables in public need explicit
grants from October 30" (admin@ inbox, 24 September 2026) and
https://github.com/orgs/supabase/discussions/45329.
