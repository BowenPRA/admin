-- PRA Admin: lesson requests (5 November 2026). Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- Teachers ask for a lesson on the Lessons page (Teaching > Lessons): slides for the
-- class, a guided review, online practice, a printed worksheet or a review game,
-- based on a book, their own files, a Drive link or a topic. Whoever runs PRA's
-- Claude account works the queue with pra-triage/the_current_lessons.py and the
-- teacher-lessons skill, and puts the links back on the request.
--
-- Three tables:
--   adm_lesson_requests  one row per request, numbered ("Lesson 12")
--   adm_class_profiles   what the builder should know about a class, filled once by its teachers
--   adm_sources          the book catalogue: workbooks, learner's books, schemes of work, with units and pages
--
-- Who can do what:
--   teachers             read and add their own requests and change them until they are done
--                        (comments through adm_lesson_add_update); office staff who teach the same
--   office, head, super  read and change every request (Seth, Bowen, Yvonne, Hien, Duyen)
--   triage               the account the scripts sign in with: reads requests and changes only their
--                        status, outputs and claimed_by, writes comments, reads profiles and files,
--                        reads and upserts sources
--   delete               whoever added a request, while it is a draft or sent; head and super admin any
--   nobody else          a signed-in account that is not staff (a student login, a stranger) gets nothing,
--                        even when its address is on a request
--   profiles             any staff read; a class's teachers and the office write
--   sources              any staff read; the triage account and head teachers write
-- Files on a request go in the private bucket adm-lessons, at <request id>/<file name>.

-- ================================================================
-- 1. The tables
-- ================================================================

create table if not exists adm_lesson_requests (
  id uuid primary key default gen_random_uuid(),
  number integer unique,                        -- the short number people say: "Lesson 12"
  class_key text not null,                      -- a subject key as on the Teachers page: 'english:Year 5'
  teacher_email text not null,                  -- who the lesson is for (the creator unless the office picks someone)
  status text not null default 'sent',          -- draft | sent | building | question | ready | changes | done | cancelled
  wants text[] not null default '{slides,review,practice}',  -- any of slides, review, practice, worksheet, game
  source jsonb not null default '{}'::jsonb,    -- { book_id?, unit?, section?, pages?, topic?, links?: [url] }
  details jsonb not null default '{}'::jsonb,   -- { teach_on?, length_min?, key_words?, hard?, ideas?, avoid?, homework_amount?, homework_due?, other? }
  files jsonb not null default '[]'::jsonb,     -- [{ path, name, size, type, at, by }]; the files are in Storage
  outputs jsonb not null default '{}'::jsonb,   -- { slides?, plan?, review?, practice?, worksheet?, game? } as links, plus note?
  updates jsonb not null default '[]'::jsonb,   -- [{ at, by, name, kind: comment | question | answer | status, text }], oldest first
  previous_id uuid null references adm_lesson_requests(id) on delete set null,  -- the request this one follows on from
  needed_by date,                               -- the teaching date when given
  claimed_by text,                              -- who is building it
  created_at timestamptz default now(),
  created_by text,
  updated_at timestamptz,
  updated_by text,
  done_at timestamptz
);

alter table adm_lesson_requests drop constraint if exists adm_lesson_requests_status_check;
alter table adm_lesson_requests add constraint adm_lesson_requests_status_check
  check (status in ('draft', 'sent', 'building', 'question', 'ready', 'changes', 'done', 'cancelled'));
alter table adm_lesson_requests drop constraint if exists adm_lesson_requests_wants_check;
alter table adm_lesson_requests add constraint adm_lesson_requests_wants_check
  check (wants <@ array['slides', 'review', 'practice', 'worksheet', 'game']::text[]);
create index if not exists adm_lesson_requests_class on adm_lesson_requests (class_key);
create index if not exists adm_lesson_requests_teacher on adm_lesson_requests (teacher_email);
create index if not exists adm_lesson_requests_open on adm_lesson_requests (needed_by) where status not in ('done', 'cancelled');

create table if not exists adm_class_profiles (
  class_key text primary key,                   -- 'english:Year 5'
  profile jsonb not null default '{}'::jsonb,   -- { english_level?, vietnamese_support?: boolean, devices_at_home?: all | most | some | few, example_name?, book_ids?: [], notes? }
  updated_at timestamptz default now(),
  updated_by text
);

create table if not exists adm_sources (
  id text primary key,                          -- a slug: 'wb-y5-english'
  title text not null,
  subject text,                                 -- the learning-area key as on the Teachers page: english | math | science | ...
  year_group text,                              -- 'Year 5'
  kind text not null,
  series text,
  drive_id text,
  drive_path text,                              -- the path under 'G:/Shared drives/'
  pages integer,                                -- the PDF's page count
  page_offset integer default 0,                -- PDF page = book page + page_offset
  units jsonb not null default '[]'::jsonb,     -- [{ n, title, pages: [first, last], sections?: [{ id, title, pages: [first, last] }] }], book page numbers
  notes text,
  updated_at timestamptz default now()
);
alter table adm_sources drop constraint if exists adm_sources_kind_check;
alter table adm_sources add constraint adm_sources_kind_check
  check (kind in ('workbook', 'learners_book', 'teachers_resource', 'answer_key', 'scheme_of_work', 'framework', 'test', 'teacher_folder', 'other'));

-- ================================================================
-- 2. Who is who (read as the definer, so the policies never recurse)
-- ================================================================

-- Office accounts and head teachers see and change every request.
create or replace function adm_lessons_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
$$;

-- Whether the signed-in account teaches this class ('english:Year 5' on their Teachers row).
create or replace function adm_teaches(p_class text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_email() <> '' and exists (
    select 1 from adm_teachers t
     where lower(t.email) = adm_email() and coalesce(t.active, true) and p_class = any(coalesce(t.subjects, '{}')))
$$;

-- A request is yours when it is for you or you added it, and you are on staff: an address
-- typed by mistake, a student login (PRA Learn) or a teacher who has left gets nothing.
create or replace function adm_lesson_mine(p_teacher text, p_by text) returns boolean
language sql stable as $$
  select adm_email() <> '' and (lower(coalesce(p_teacher, '')) = adm_email() or lower(coalesce(p_by, '')) = adm_email())
     and adm_is_report_staff()
$$;

-- The name written on a comment or a status change: "Ms. Kiu", "Lesson builder" for the triage account.
create or replace function adm_lesson_name() returns text
language sql stable security definer set search_path = public as $$
  select case
    when adm_role() = 'triage' then 'Lesson builder'
    when adm_email() = '' then ''
    else coalesce(
      (select nullif(trim(concat_ws(' ', nullif(trim(t.title), ''), t.name)), '') from adm_teachers t
        where lower(t.email) = adm_email() order by coalesce(t.active, true) desc limit 1),
      initcap(split_part(split_part(adm_email(), '@', 1), '.', 1)))
  end
$$;

-- The next number. Read as the definer: a teacher sees only their own requests, and
-- counting from those would hand out a number that is taken. Two requests sent at the
-- same moment take turns at the lock (held until each is saved), so both get their own.
-- Only staff and the triage account may ask.
create or replace function adm_lesson_next_number() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  n integer;
begin
  if not (adm_is_report_staff() or adm_role() = 'triage') then
    raise exception 'Only staff can add a lesson request.';
  end if;
  perform pg_advisory_xact_lock(hashtext('adm_lesson_requests.number'));
  select coalesce(max(number), 0) + 1 into n from adm_lesson_requests;
  return n;
end $$;

-- ================================================================
-- 3. The number, the stamps, and what a teacher may change
-- ================================================================
-- Set here so that no page or script can get them wrong. A teacher (anyone who is
-- not office, head or the triage account) cannot choose the number, fill in the
-- outputs, claim a request, hand it to another teacher or rewrite the comments, and
-- can only make these moves:
--   draft -> sent or cancelled      sent -> draft or cancelled     cancelled -> draft or sent
--   ready -> done or changes        changes -> done
-- The triage account changes the status, the outputs and claimed_by only; what the
-- teacher asked for stays as they wrote it, and its notes go through adm_lesson_add_update.
-- An answer to a question moves the request through adm_lesson_add_update.
-- Every change of status is added to `updates` (kind 'status').
create or replace function adm_lesson_requests_stamp() returns trigger
language plpgsql as $$
declare
  manager boolean := adm_lessons_manager();
  full_access boolean := manager or adm_role() = 'triage';
  via_rpc boolean := coalesce(current_setting('adm.lesson_rpc', true), '') = '1';
  who text := nullif(adm_email(), '');
  teach text;
begin
  new.teacher_email := nullif(lower(trim(coalesce(new.teacher_email, ''))), '');
  if tg_op = 'INSERT' then new.teacher_email := coalesce(new.teacher_email, who); end if;
  if tg_op = 'UPDATE' and not full_access then
    new.teacher_email := old.teacher_email;
  elsif tg_op = 'UPDATE' and not manager then
    -- The triage account.
    new.class_key := old.class_key;
    new.teacher_email := old.teacher_email;
    new.wants := old.wants;
    new.source := old.source;
    new.details := old.details;
    new.files := old.files;
    new.previous_id := old.previous_id;
    new.needed_by := old.needed_by;
    if not via_rpc then new.updates := old.updates; end if;
  end if;
  teach := coalesce(new.details ->> 'teach_on', '');
  new.wants := coalesce(new.wants, '{slides,review,practice}');
  new.source := coalesce(new.source, '{}'::jsonb);
  new.details := coalesce(new.details, '{}'::jsonb);
  new.files := coalesce(new.files, '[]'::jsonb);
  new.outputs := coalesce(new.outputs, '{}'::jsonb);
  new.updates := coalesce(new.updates, '[]'::jsonb);
  new.claimed_by := nullif(trim(coalesce(new.claimed_by, '')), '');
  -- The teaching date, when the teacher gave one, is the date it is needed by.
  if teach ~ '^\d{4}-\d{2}-\d{2}$' then
    new.needed_by := teach::date;
  elsif tg_op = 'UPDATE' and coalesce(old.details ->> 'teach_on', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    new.needed_by := null;
  end if;
  new.updated_by := coalesce(who, new.updated_by);
  new.updated_at := now();

  if tg_op = 'INSERT' then
    -- The office and the triage account may bring a number with them (an import); a teacher never.
    if new.number is null or not full_access then
      new.number := adm_lesson_next_number();
    end if;
    new.created_by := coalesce(who, new.created_by);
    new.created_at := case when full_access then coalesce(new.created_at, now()) else now() end;
    if not full_access then
      new.outputs := '{}'::jsonb;
      new.claimed_by := null;
      new.updates := '[]'::jsonb;
      if new.status not in ('draft', 'sent') then
        raise exception 'A new request is saved as a draft or sent.';
      end if;
    end if;
  else
    new.number := old.number;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if not full_access then
      new.outputs := old.outputs;
      new.claimed_by := old.claimed_by;
      if not via_rpc then
        new.updates := old.updates;
        if new.status is distinct from old.status and not (
             (old.status = 'draft' and new.status in ('sent', 'cancelled'))
          or (old.status = 'sent' and new.status in ('draft', 'cancelled'))
          or (old.status = 'cancelled' and new.status in ('draft', 'sent'))
          or (old.status = 'ready' and new.status in ('done', 'changes'))
          or (old.status = 'changes' and new.status = 'done')) then
          raise exception 'Your account cannot move this request from "%" to "%".', old.status, new.status;
        end if;
      end if;
    end if;
    if new.status is distinct from old.status then
      new.updates := new.updates || jsonb_build_array(jsonb_build_object(
        'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'by', coalesce(who, ''), 'name', adm_lesson_name(), 'kind', 'status', 'text', new.status));
    end if;
  end if;

  if new.status = 'done' then
    new.done_at := case when tg_op = 'UPDATE' then coalesce(old.done_at, now()) else coalesce(new.done_at, now()) end;
  else
    new.done_at := null;
  end if;
  return new;
end $$;

drop trigger if exists adm_lesson_requests_stamp on adm_lesson_requests;
create trigger adm_lesson_requests_stamp before insert or update on adm_lesson_requests
  for each row execute function adm_lesson_requests_stamp();

create or replace function adm_class_profiles_stamp() returns trigger
language plpgsql as $$
begin
  new.profile := coalesce(new.profile, '{}'::jsonb);
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists adm_class_profiles_stamp on adm_class_profiles;
create trigger adm_class_profiles_stamp before insert or update on adm_class_profiles
  for each row execute function adm_class_profiles_stamp();

create or replace function adm_sources_stamp() returns trigger
language plpgsql as $$
begin
  new.units := coalesce(new.units, '[]'::jsonb);
  new.page_offset := coalesce(new.page_offset, 0);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists adm_sources_stamp on adm_sources;
create trigger adm_sources_stamp before insert or update on adm_sources
  for each row execute function adm_sources_stamp();

-- ================================================================
-- 4. A comment, a question or an answer on a request
-- ================================================================
-- Added in one step, so two people writing at the same moment both keep theirs, and
-- the name on it is the signed-in account's. A question is asked by the office, a head
-- teacher or the triage account. An answer while the request is waiting on a question
-- sends it back to the builder: 'building' when someone has claimed it, else 'sent'.
create or replace function adm_lesson_add_update(p_id uuid, p_text text, p_kind text default 'comment')
returns adm_lesson_requests
language plpgsql security definer set search_path = public as $$
declare
  r adm_lesson_requests;
  k text := lower(trim(coalesce(p_kind, 'comment')));
  full_access boolean := adm_lessons_manager() or adm_role() = 'triage';
begin
  if coalesce(trim(p_text), '') = '' then raise exception 'The message is empty.'; end if;
  if k not in ('comment', 'question', 'answer', 'status') then raise exception 'Unknown kind of message: %', p_kind; end if;
  if k in ('question', 'status') and not full_access then
    raise exception 'Only the office, a head teacher or the lesson builder can add a % here.', k;
  end if;
  select * into r from adm_lesson_requests where id = p_id;
  if r.id is null or not (full_access or adm_lesson_mine(r.teacher_email, r.created_by)) then
    raise exception 'This request no longer exists, or your account cannot see it.';
  end if;
  perform set_config('adm.lesson_rpc', '1', true);
  update adm_lesson_requests
     set updates = coalesce(updates, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'by', adm_email(), 'name', adm_lesson_name(), 'kind', k, 'text', left(trim(p_text), 4000))),
         status = case when k = 'answer' and status = 'question'
                       then case when claimed_by is not null then 'building' else 'sent' end
                       else status end
   where id = p_id
   returning * into r;
  perform set_config('adm.lesson_rpc', '', true);
  return r;
end $$;

-- ================================================================
-- 5. Row level security and grants
-- ================================================================

alter table adm_lesson_requests enable row level security;
alter table adm_class_profiles enable row level security;
alter table adm_sources enable row level security;

revoke all on adm_lesson_requests, adm_class_profiles, adm_sources from anon;
grant select, insert, update, delete on adm_lesson_requests, adm_class_profiles, adm_sources to authenticated;

revoke all on function adm_lessons_manager(), adm_teaches(text), adm_lesson_mine(text, text), adm_lesson_name(), adm_lesson_next_number(),
  adm_lesson_add_update(uuid, text, text) from public, anon;
grant execute on function adm_lessons_manager(), adm_teaches(text), adm_lesson_mine(text, text), adm_lesson_name(), adm_lesson_next_number(),
  adm_lesson_add_update(uuid, text, text) to authenticated;

-- Requests
drop policy if exists lessons_read on adm_lesson_requests;
create policy lessons_read on adm_lesson_requests for select to authenticated
  using (adm_lessons_manager() or adm_role() = 'triage' or adm_lesson_mine(teacher_email, created_by));

drop policy if exists lessons_add on adm_lesson_requests;
create policy lessons_add on adm_lesson_requests for insert to authenticated
  with check (adm_lessons_manager() or (adm_is_report_staff() and teacher_email = adm_email()));

drop policy if exists lessons_change on adm_lesson_requests;
create policy lessons_change on adm_lesson_requests for update to authenticated
  using (adm_lessons_manager() or adm_role() = 'triage' or (adm_lesson_mine(teacher_email, created_by) and status <> 'done'))
  with check (adm_lessons_manager() or adm_role() = 'triage' or adm_lesson_mine(teacher_email, created_by));

drop policy if exists lessons_remove on adm_lesson_requests;
create policy lessons_remove on adm_lesson_requests for delete to authenticated
  using (adm_is_head() or (adm_lesson_mine(null, created_by) and status in ('draft', 'sent')));

-- Class profiles
drop policy if exists profiles_read on adm_class_profiles;
create policy profiles_read on adm_class_profiles for select to authenticated
  using (adm_is_report_staff() or adm_role() = 'triage');

drop policy if exists profiles_add on adm_class_profiles;
create policy profiles_add on adm_class_profiles for insert to authenticated
  with check (adm_lessons_manager() or adm_teaches(class_key));

drop policy if exists profiles_change on adm_class_profiles;
create policy profiles_change on adm_class_profiles for update to authenticated
  using (adm_lessons_manager() or adm_teaches(class_key))
  with check (adm_lessons_manager() or adm_teaches(class_key));

drop policy if exists profiles_remove on adm_class_profiles;
create policy profiles_remove on adm_class_profiles for delete to authenticated
  using (adm_is_head());

-- Book catalogue
drop policy if exists sources_read on adm_sources;
create policy sources_read on adm_sources for select to authenticated
  using (adm_is_report_staff() or adm_role() = 'triage');

drop policy if exists sources_add on adm_sources;
create policy sources_add on adm_sources for insert to authenticated
  with check (adm_role() = 'triage' or adm_is_head());

drop policy if exists sources_change on adm_sources;
create policy sources_change on adm_sources for update to authenticated
  using (adm_role() = 'triage' or adm_is_head())
  with check (adm_role() = 'triage' or adm_is_head());

drop policy if exists sources_remove on adm_sources;
create policy sources_remove on adm_sources for delete to authenticated
  using (adm_is_head());

-- ================================================================
-- 6. Files on a request
-- ================================================================
-- A private bucket: nothing in it has a public link; the page asks for a short-lived
-- signed link to open a file. Pictures, PDFs and Office files, up to 25 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-lessons', 'adm-lessons', false, 26214400, array[
  'image/*', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Whether the signed-in account may read (p_write false) or add and remove (p_write true)
-- files in a request's folder (its id). The office and head teachers: always. The triage
-- account: read. The teacher: their own requests, adding and removing until done. A folder
-- with no request yet belongs to a request still being written: anyone on staff may use it.
create or replace function adm_can_lesson_folder(p_folder text, p_write boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select adm_lessons_manager()
         or (not p_write and adm_role() = 'triage')
         or (adm_lesson_mine(r.teacher_email, r.created_by) and (not p_write or r.status <> 'done'))
       from adm_lesson_requests r where r.id::text = p_folder),
    adm_is_report_staff())
$$;
revoke all on function adm_can_lesson_folder(text, boolean) from public, anon;
grant execute on function adm_can_lesson_folder(text, boolean) to authenticated;

drop policy if exists adm_lessons_files_read on storage.objects;
create policy adm_lessons_files_read on storage.objects for select to authenticated
  using (bucket_id = 'adm-lessons' and adm_can_lesson_folder((storage.foldername(name))[1], false));

drop policy if exists adm_lessons_files_add on storage.objects;
create policy adm_lessons_files_add on storage.objects for insert to authenticated
  with check (bucket_id = 'adm-lessons' and adm_can_lesson_folder((storage.foldername(name))[1], true));

drop policy if exists adm_lessons_files_remove on storage.objects;
create policy adm_lessons_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'adm-lessons' and adm_can_lesson_folder((storage.foldername(name))[1], true));

notify pgrst, 'reload schema';

-- ================================================================
-- 7. The test
-- ================================================================
-- A made-up teacher (on the Teachers list only for the test) sends a made-up request; the
-- builder claims it, asks a question, the teacher answers, the builder marks it ready and
-- the teacher approves it. Everything it adds is undone when the block ends, whether it
-- worked or not.
do $$
declare
  r adm_lesson_requests;
  teacher text := '{"email": "selftest@pra-selftest.invalid", "app_metadata": {"role": "teacher"}}';
  builder text := '{"email": "triage@pra-selftest.invalid", "app_metadata": {"role": "triage"}}';
  refused boolean;
begin
  insert into adm_teachers (email, name, title, role, subjects, active)
  values ('selftest@pra-selftest.invalid', 'Selftest', 'Mr.', 'teacher', array['english:Year 5'], true);
  perform set_config('request.jwt.claims', teacher, true);
  insert into adm_lesson_requests (class_key, status, source, details, outputs)
  values ('english:Year 5', 'sent', '{"topic": "Self-test"}', '{"teach_on": "2030-01-15"}', '{"slides": "https://example.invalid"}')
  returning * into r;
  if r.number is null or r.teacher_email <> 'selftest@pra-selftest.invalid' or r.created_by <> r.teacher_email then
    raise exception 'a new request did not get its number or its teacher';
  end if;
  if r.needed_by <> date '2030-01-15' then raise exception 'the teaching date did not become needed_by'; end if;
  if r.outputs <> '{}'::jsonb then raise exception 'a teacher could fill in the outputs'; end if;

  refused := false;
  begin
    update adm_lesson_requests set status = 'ready' where id = r.id;
  exception when others then refused := true;
  end;
  if not refused then raise exception 'a teacher could mark a request ready'; end if;

  perform set_config('request.jwt.claims', builder, true);
  update adm_lesson_requests set status = 'building', claimed_by = 'Lesson builder' where id = r.id;
  perform adm_lesson_add_update(r.id, 'Which pages?', 'question');
  update adm_lesson_requests set status = 'question' where id = r.id;

  perform set_config('request.jwt.claims', teacher, true);
  select * into r from adm_lesson_add_update(r.id, 'Pages 10 to 12.', 'answer');
  if r.status <> 'building' then raise exception 'an answer did not send the request back to the builder (%)', r.status; end if;

  perform set_config('request.jwt.claims', builder, true);
  update adm_lesson_requests set status = 'ready', outputs = '{"slides": "https://example.invalid/slides"}' where id = r.id;

  perform set_config('request.jwt.claims', teacher, true);
  update adm_lesson_requests set status = 'done' where id = r.id returning * into r;
  if r.done_at is null or r.outputs ->> 'slides' is null then raise exception 'approving did not stamp done_at'; end if;
  if (select count(*) from jsonb_array_elements(r.updates) u where u ->> 'kind' = 'status') < 4 then
    raise exception 'status changes were not written down';
  end if;
  raise exception 'PRA_LESSONS_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_LESSONS_TEST_OK' then
    raise exception 'Lesson requests do not work yet: %', sqlerrm;
  end if;
end $$;

select 'Lesson requests are set up: ' || (select count(*) from adm_lesson_requests) || ' requests, '
    || (select count(*) from adm_sources) || ' books, ' || (select count(*) from adm_class_profiles) || ' class profiles.' as result;
