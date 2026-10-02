-- PRA Admin: the To-Do tab (1 October 2026). Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- The To-Do tab replaces the "Team To-Do & Issues Tracker" spreadsheet: one row
-- per task. Office accounts (super_admin, head, admin) can see, add and change
-- all of it. A task can be given to anyone on staff, or to Claude. The inbox
-- triage signs in with its own account (app_metadata.role = 'triage'), which
-- can read, add and update tasks, read and add their files, and nothing else.

-- 1. One row per task.
create table if not exists adm_todos (
  id uuid primary key default gen_random_uuid(),
  number int unique,                       -- the short number people say: "To-Do 23"
  title text not null,
  details text,
  status text not null default 'open'
    check (status in ('open', 'doing', 'waiting', 'check', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assignee text,                           -- a staff email, 'claude', or null while nobody has it
  giver text,                              -- who asked for it, as a name
  due_date date,
  source text not null default 'person' check (source in ('person', 'triage', 'import')),
  files jsonb not null default '[]'::jsonb,    -- [{ path, name, type, size, added_at }]; the files are in Storage
  updates jsonb not null default '[]'::jsonb,  -- [{ at, by, text }], oldest first
  done_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists adm_todos_assignee on adm_todos (assignee) where status <> 'done';

-- 2. The number, who added and last changed each row, and when it was done,
--    are set here so that no page or script can get them wrong.
create or replace function adm_todos_stamp() returns trigger
language plpgsql as $$
begin
  new.assignee := nullif(lower(trim(coalesce(new.assignee, ''))), '');
  new.files := coalesce(new.files, '[]'::jsonb);
  new.updates := coalesce(new.updates, '[]'::jsonb);
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.number is null then
      select coalesce(max(number), 0) + 1 into new.number from adm_todos;
    end if;
    new.created_by := coalesce(nullif(adm_email(), ''), new.created_by);
    new.created_at := coalesce(new.created_at, now());
    if new.status = 'done' then new.done_at := coalesce(new.done_at, now()); else new.done_at := null; end if;
  else
    new.number := old.number;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.status = 'done' then new.done_at := coalesce(old.done_at, now()); else new.done_at := null; end if;
  end if;
  return new;
end $$;

drop trigger if exists adm_todos_stamp on adm_todos;
create trigger adm_todos_stamp before insert or update on adm_todos
  for each row execute function adm_todos_stamp();

-- 3. A note on a task ("called the supplier, waiting for a price"). Added in
--    one step in the database, so two people adding notes at the same moment
--    both keep theirs, and the name on it is the signed-in account's.
create or replace function adm_todo_add_update(p_id uuid, p_text text) returns adm_todos
language plpgsql as $$
declare
  r adm_todos;
begin
  if coalesce(trim(p_text), '') = '' then raise exception 'The note is empty.'; end if;
  update adm_todos
     set updates = coalesce(updates, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'by', adm_email(),
           'text', left(trim(p_text), 4000)))
   where id = p_id
   returning * into r;
  if r.id is null then raise exception 'This task no longer exists, or your account may not change it.'; end if;
  return r;
end $$;

grant execute on function adm_todo_add_update(uuid, text) to authenticated;

-- 4. Office accounts: read, add and update. Who may delete is set in
--    updates-2026-10-01-todo-delete.sql (Seth, Bowen, and whoever asked for
--    the task). The triage account: read, add and update, never delete.
alter table adm_todos enable row level security;

drop policy if exists staff_all on adm_todos;
drop policy if exists staff_read on adm_todos;
create policy staff_read on adm_todos for select to authenticated
  using (adm_is_staff());

drop policy if exists staff_add on adm_todos;
create policy staff_add on adm_todos for insert to authenticated
  with check (adm_is_staff());

drop policy if exists staff_change on adm_todos;
create policy staff_change on adm_todos for update to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists triage_read on adm_todos;
create policy triage_read on adm_todos for select to authenticated
  using (adm_role() = 'triage');

drop policy if exists triage_add on adm_todos;
create policy triage_add on adm_todos for insert to authenticated
  with check (adm_role() = 'triage');

drop policy if exists triage_change on adm_todos;
create policy triage_change on adm_todos for update to authenticated
  using (adm_role() = 'triage') with check (adm_role() = 'triage');

-- 5. Screenshots and files on a task go in a private bucket: nothing in it has
--    a public link; the app asks for a short-lived signed link to open one.
--    Any kind of file, up to 10 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-todo', 'adm-todo', false, 10485760, null)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists adm_todo_office on storage.objects;
create policy adm_todo_office on storage.objects for all to authenticated
  using (bucket_id = 'adm-todo' and adm_is_staff())
  with check (bucket_id = 'adm-todo' and adm_is_staff());

-- The triage account reads them (Claude looks at a screenshot before fixing
-- what it shows) and may add one (a picture of the fix). It cannot remove any.
drop policy if exists adm_todo_triage_read on storage.objects;
create policy adm_todo_triage_read on storage.objects for select to authenticated
  using (bucket_id = 'adm-todo' and adm_role() = 'triage');

drop policy if exists adm_todo_triage_add on storage.objects;
create policy adm_todo_triage_add on storage.objects for insert to authenticated
  with check (bucket_id = 'adm-todo' and adm_role() = 'triage');

notify pgrst, 'reload schema';
