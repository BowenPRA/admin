-- PRA Admin: students' documents on Google Drive (19 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run again.
--
-- The office keeps each student's enrollment form, passport or birth certificate and
-- photo in "Students' enrollment forms" on the Palm River Administration shared drive.
-- The files stay there. "Check Drive" in The Current copies the LIST of what is in that
-- folder (each file's name, its folder and its Drive id; never the file itself) into
-- adm_drive_files, and the student window works out from the names whose documents are
-- whose. Opening one goes through Google, so only people who can open the shared drive
-- see the file. adm_drive_doc_links holds the office's corrections: "not this student",
-- "this file is theirs too", "this is a passport, not a photo".
--
-- Office accounts only (super admin, head, admin). Teachers see neither table.

-- 1. The folder's list of files, as Drive last showed it.
create table if not exists adm_drive_files (
  id text primary key,                     -- Drive's id for the file or folder
  parent_id text,                          -- the folder it sits in (null for the top folder)
  name text not null default '',
  mime text,
  is_folder boolean not null default false,
  size bigint,
  md5 text,                                -- Drive's checksum: tells a file filed twice
  modified_at timestamptz,                 -- last changed, in Drive
  link_id text,                            -- for a Drive shortcut: what it points to
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Columns added after the first version of this file (a table made earlier keeps its own).
alter table adm_drive_files add column if not exists parent_id text;
alter table adm_drive_files add column if not exists mime text;
alter table adm_drive_files add column if not exists is_folder boolean not null default false;
alter table adm_drive_files add column if not exists size bigint;
alter table adm_drive_files add column if not exists md5 text;
alter table adm_drive_files add column if not exists modified_at timestamptz;
alter table adm_drive_files add column if not exists link_id text;
create index if not exists adm_drive_files_parent on adm_drive_files (parent_id);

-- 2. The office's corrections, one row per file and student.
create table if not exists adm_drive_doc_links (
  id uuid primary key default gen_random_uuid(),
  file_id text not null,                   -- adm_drive_files.id (no foreign key: the list is replaced on every check)
  student_id uuid not null references adm_students(id) on delete cascade,
  kind text,                               -- what the file is, when the office says so
  hidden boolean not null default false,   -- true: not this student's, whatever its name says
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table adm_drive_doc_links add column if not exists kind text;
alter table adm_drive_doc_links add column if not exists hidden boolean not null default false;
alter table adm_drive_doc_links add column if not exists created_by text;
alter table adm_drive_doc_links add column if not exists updated_by text;
alter table adm_drive_doc_links drop constraint if exists adm_drive_doc_links_kind_check;
alter table adm_drive_doc_links add constraint adm_drive_doc_links_kind_check
  check (kind is null or kind in ('form', 'student_id', 'parent_id', 'photo', 'other'));
create unique index if not exists adm_drive_doc_links_one on adm_drive_doc_links (file_id, student_id);
create index if not exists adm_drive_doc_links_student on adm_drive_doc_links (student_id);

-- Who made and last changed a correction comes from the signed-in account.
create or replace function adm_drive_doc_links_stamp() returns trigger
language plpgsql as $$
begin
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

drop trigger if exists adm_drive_doc_links_stamp on adm_drive_doc_links;
create trigger adm_drive_doc_links_stamp before insert or update on adm_drive_doc_links
  for each row execute function adm_drive_doc_links_stamp();

-- 3. Office accounts read and write both; nobody else sees them.
alter table adm_drive_files enable row level security;
alter table adm_drive_doc_links enable row level security;
revoke all on adm_drive_files from anon;
revoke all on adm_drive_doc_links from anon;
grant select, insert, update, delete on adm_drive_files to authenticated;
grant select, insert, update, delete on adm_drive_doc_links to authenticated;

drop policy if exists office_all on adm_drive_files;
create policy office_all on adm_drive_files for all to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists office_all on adm_drive_doc_links;
create policy office_all on adm_drive_doc_links for all to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

-- Check: the rules are in place and name the office.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'adm_drive_files' and policyname = 'office_all' and qual like '%adm_is_staff%') then
    raise exception 'The office rule on adm_drive_files is missing.';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'adm_drive_doc_links' and policyname = 'office_all' and qual like '%adm_is_staff%') then
    raise exception 'The office rule on adm_drive_doc_links is missing.';
  end if;
end $$;

notify pgrst, 'reload schema';

select 'Drive documents are set up: ' || (select count(*) from adm_drive_files) || ' files listed, '
  || (select count(*) from adm_drive_doc_links) || ' corrections.' as result;
