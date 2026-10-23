-- PRA Admin: staff signatures (23 October 2026). Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- Setup > Signatures collects one signature per member of staff, drawn on a touch
-- screen (or with a pen) or taken from a photo or scan. Nothing prints them yet: the
-- reports, invoices and receipts are left as they are until we decide where each
-- signature goes.
--
-- The signature is kept as a small PNG picture with a see-through background, in the
-- row itself. A drawn one also keeps its pen strokes, so it can be drawn again later
-- at any size or in another ink colour.

-- 1. The signatures, one per person.
create table if not exists adm_signatures (
  id uuid primary key default gen_random_uuid(),
  person text not null unique,             -- the sign-in email, or 'no-login:chien' for someone without a login
  name text not null default '',           -- 'Kiu', as on the Teachers page
  title text not null default '',          -- 'Ms.'
  image text not null,                     -- 'data:image/png;base64,...', cropped to the ink
  width int,                               -- the picture's size in pixels
  height int,
  method text not null default 'drawn',    -- 'drawn' or 'uploaded'
  strokes jsonb,                           -- drawn only: [[[x, y, pressure], ...], ...]
  captured_by text,                        -- the account that saved it
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table adm_signatures drop constraint if exists adm_signatures_method_check;
alter table adm_signatures add constraint adm_signatures_method_check check (method in ('drawn', 'uploaded'));
-- A PNG, and no bigger than about 1 MB.
alter table adm_signatures drop constraint if exists adm_signatures_image_check;
alter table adm_signatures add constraint adm_signatures_image_check
  check (image like 'data:image/png;base64,%' and length(image) < 1400000);

-- 2. Who saved it, and when, comes from the signed-in account.
create or replace function adm_signatures_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.captured_by := coalesce(nullif(adm_email(), ''), new.captured_by);
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;

drop trigger if exists adm_signatures_stamp on adm_signatures;
create trigger adm_signatures_stamp before insert or update on adm_signatures
  for each row execute function adm_signatures_stamp();

-- 3. Office accounts and head teachers see and save everyone's (the shared tablet is
--    signed in as one of them). A teacher sees and saves only their own.
alter table adm_signatures enable row level security;
revoke all on adm_signatures from anon;
grant select, insert, update, delete on adm_signatures to authenticated;

create or replace function adm_can_signature(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
      or (adm_is_report_staff() and lower(p) = adm_email())
$$;

drop policy if exists signatures_read on adm_signatures;
create policy signatures_read on adm_signatures for select to authenticated using (adm_can_signature(person));
drop policy if exists signatures_add on adm_signatures;
create policy signatures_add on adm_signatures for insert to authenticated with check (adm_can_signature(person));
drop policy if exists signatures_change on adm_signatures;
create policy signatures_change on adm_signatures for update to authenticated
  using (adm_can_signature(person)) with check (adm_can_signature(person));
drop policy if exists signatures_remove on adm_signatures;
create policy signatures_remove on adm_signatures for delete to authenticated using (adm_can_signature(person));

notify pgrst, 'reload schema';

select 'Signatures are set up: ' || (select count(*) from adm_signatures) || ' saved so far.' as result;
