-- PRA Admin: leads (30 September 2026). Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- The Leads tab replaces the "Inquiries Tracker" spreadsheet: one row per
-- family that has asked about joining, active or archived. Office accounts
-- (super_admin, head, admin) can see and change all of it. The daily inbox
-- triage signs in with its own account (app_metadata.role = 'triage', made by
-- scripts/create-triage-account.mjs), which can read, add and update leads
-- and nothing else.

-- 1. One row per family.
create table if not exists adm_leads (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  email text unique,                      -- stored in lower case; how the triage finds a family again
  phone text,
  children text,                          -- 'Maia (b. 3 Feb 2022), Leo (b. 9 Jun 2019)'
  kids int check (kids >= 0),
  program text check (program in ('global', 'year', 'nursery', 'summer')),
  timing text,                            -- 'Nov 2026 · 1 month'
  source text check (source in ('email', 'website', 'walk_in', 'whatsapp_zalo', 'facebook', 'other')),
  first_contact date,
  tour_date date,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'tour_booked', 'tour_done', 'trial', 'enrolled', 'lost')),
  owner text,                             -- office email of whoever has the next step
  next_step text,
  follow_up date,                         -- when to chase if nothing has happened
  notes text,
  archived boolean not null default false,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Who added and last changed each row, taken from the signed-in account so
--    the page cannot get it wrong. Email is kept in lower case, blank as null.
create or replace function adm_leads_stamp() returns trigger
language plpgsql as $$
begin
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(nullif(adm_email(), ''), new.created_by);
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists adm_leads_stamp on adm_leads;
create trigger adm_leads_stamp before insert or update on adm_leads
  for each row execute function adm_leads_stamp();

-- 3. Office accounts: everything. The triage account: read, add and update,
--    never delete, and no other table.
alter table adm_leads enable row level security;

drop policy if exists staff_all on adm_leads;
create policy staff_all on adm_leads for all to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists triage_read on adm_leads;
create policy triage_read on adm_leads for select to authenticated
  using (adm_role() = 'triage');

drop policy if exists triage_add on adm_leads;
create policy triage_add on adm_leads for insert to authenticated
  with check (adm_role() = 'triage');

drop policy if exists triage_change on adm_leads;
create policy triage_change on adm_leads for update to authenticated
  using (adm_role() = 'triage') with check (adm_role() = 'triage');

notify pgrst, 'reload schema';
