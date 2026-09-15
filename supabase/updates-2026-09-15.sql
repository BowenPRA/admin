-- PRA Admin: roles, teacher links, S student IDs, family contacts, attendance.
-- Run once in Supabase > SQL Editor, after supabase-migration.sql (or schema.sql +
-- reports.sql + updates-2026-09-14.sql). Safe to run again: every step checks
-- what is already there.
--
-- Who can do what (app_metadata.role on the Supabase user, set by
-- scripts/create-staff-accounts.mjs):
--   super_admin  Bowen   everything
--   head         Seth    everything
--   admin        Yvonne, Hien, Duyen   invoices, students, families, fees,
--                        attendance; progress reports only where adm_teachers
--                        gives them a learning area (Duyen: Technology Year 1)
--   teacher      David, Kiu, Solo, Caleb, Thanh N, Tham N, Tham V
--                        no invoices or families; reports only for the
--                        subject:year-group pairs on their adm_teachers row and
--                        homeroom parts for their homeroom year groups;
--                        attendance for year groups they teach

create extension if not exists pgcrypto;

-- ================================================================
-- 1. Role helpers
-- ================================================================

create or replace function adm_role() returns text
language sql stable as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

create or replace function adm_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- Office accounts: invoices, families, fees. Teachers are no longer included.
create or replace function adm_is_staff() returns boolean
language sql stable as $$ select adm_role() in ('super_admin', 'head', 'admin') $$;

-- Full access to reports, teachers and report settings.
create or replace function adm_is_head() returns boolean
language sql stable security definer set search_path = public as $$
  select adm_role() in ('super_admin', 'head')
      or exists (select 1 from adm_teachers t where t.email = adm_email() and t.role = 'head' and coalesce(t.active, true))
$$;

create or replace function adm_is_report_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true))
$$;

create or replace function adm_can_homeroom(yg text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true)
                 and (yg = any(t.homeroom_groups) or '*' = any(t.homeroom_groups)))
$$;

-- ================================================================
-- 2. Subject permissions by year group ('english:Year 7')
-- ================================================================

drop policy if exists subj_insert on adm_report_sections;
drop policy if exists subj_update on adm_report_sections;
drop policy if exists subj_insert on adm_course_notes;
drop policy if exists subj_update on adm_course_notes;
drop function if exists adm_can_subject(text);

create or replace function adm_can_subject(sk text, yg text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true)
                 and (sk || ':' || yg) = any(t.subjects))
$$;

-- Sections take their year group from the report. Published reports are
-- locked for everyone except the head.
create or replace function adm_can_subject_in_report(sk text, rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t, adm_reports r
                 where r.id = rid and coalesce(r.status, '') <> 'published'
                   and t.email = adm_email() and coalesce(t.active, true)
                   and (sk || ':' || r.year_group) = any(t.subjects))
$$;

create policy subj_insert on adm_report_sections for insert to authenticated
  with check (adm_can_subject_in_report(subject_key, report_id));
create policy subj_update on adm_report_sections for update to authenticated
  using (adm_can_subject_in_report(subject_key, report_id))
  with check (adm_can_subject_in_report(subject_key, report_id));
create policy subj_insert on adm_course_notes for insert to authenticated
  with check (adm_can_subject(subject_key, year_group));
create policy subj_update on adm_course_notes for update to authenticated
  using (adm_can_subject(subject_key, year_group))
  with check (adm_can_subject(subject_key, year_group));

-- Homeroom teachers cannot change a report after it is published.
drop policy if exists hr_update on adm_reports;
create policy hr_update on adm_reports for update to authenticated
  using (adm_can_homeroom(year_group) and (adm_is_head() or coalesce(status, '') <> 'published'))
  with check (adm_can_homeroom(year_group));

-- Settings: office accounts keep fees and calendar; only the head changes
-- report settings.
drop policy if exists staff_all on adm_settings;
drop policy if exists office_write on adm_settings;
create policy office_write on adm_settings for all to authenticated
  using (adm_is_staff() and key <> 'reports') with check (adm_is_staff() and key <> 'reports');

-- ================================================================
-- 3. Teachers linked to the classes they teach (Schedule 2026-2027)
--    New rows are added; existing rows are only filled in when they still
--    have old-style keys, so changes made on the Teachers page are kept.
-- ================================================================

insert into adm_teachers (email, name, title, role, subjects, homeroom_groups, active) values
  ('seth@pra.edu.vn',    'Seth',   'Mr.', 'head',    array['art_of_science:Year 7'], array['*'], true),
  ('bowen@pra.edu.vn',   'Bowen',  'Mr.', 'head',    array['math:Year 7', 'science:Year 7'], array['Year 7'], true),
  ('david@pra.edu.vn',   'David',  'Mr.', 'teacher', array['english:Year 7', 'math:Year 5'], array['Upper Secondary'], true),
  ('solo@pra.edu.vn',    'Solo',   'Ms.', 'teacher', array['english:Year 1', 'math:Year 1', 'science:Year 1'], array['Year 1'], true),
  ('caleb@pra.edu.vn',   'Caleb',  'Mr.', 'teacher', array['english:Year 2', 'english:Year 3', 'math:Year 2', 'math:Year 3', 'science:Year 2', 'science:Year 3',
                                                           'technology:Year 2', 'technology:Year 3', 'technology:Year 4', 'technology:Year 5'], array['Year 2', 'Year 3'], true),
  ('kiu@pra.edu.vn',     'Kiu',    'Ms.', 'teacher', array['english:Year 5', 'science:Year 5', 'history:Year 7', 'executive_function:Year 7', 'wellbeing:Year 7', 'wellbeing:Upper Secondary'], array['Year 5'], true),
  ('thanh.n@pra.edu.vn', 'Thanh',  'Ms.', 'teacher', array['english:Kindergarten', 'math:Kindergarten', 'science:Kindergarten'], array['Kindergarten'], true),
  ('duyen.n@pra.edu.vn', 'Duyen',  'Ms.', 'teacher', array['technology:Year 1'], array[]::text[], true),
  ('tham.n@pra.edu.vn',  'Tham N', 'Ms.', 'teacher', array['english:Nursery', 'math:Nursery', 'science:Nursery'], array['Nursery'], true),
  ('tham.v@pra.edu.vn',  'Thắm V', 'Ms.', 'teacher', array['technology:Year 2', 'technology:Year 3', 'technology:Year 4', 'technology:Year 5'], array[]::text[], true)
on conflict (email) do nothing;

with schedule(email, role, subjects, homeroom) as (values
  ('seth@pra.edu.vn',    'head',    array['art_of_science:Year 7'], array['*']),
  ('bowen@pra.edu.vn',   'head',    array['math:Year 7', 'science:Year 7'], array['Year 7']),
  ('david@pra.edu.vn',   'teacher', array['english:Year 7', 'math:Year 5'], array['Upper Secondary']),
  ('solo@pra.edu.vn',    'teacher', array['english:Year 1', 'math:Year 1', 'science:Year 1'], array['Year 1']),
  ('caleb@pra.edu.vn',   'teacher', array['english:Year 2', 'english:Year 3', 'math:Year 2', 'math:Year 3', 'science:Year 2', 'science:Year 3',
                                          'technology:Year 2', 'technology:Year 3', 'technology:Year 4', 'technology:Year 5'], array['Year 2', 'Year 3']),
  ('kiu@pra.edu.vn',     'teacher', array['english:Year 5', 'science:Year 5', 'history:Year 7', 'executive_function:Year 7', 'wellbeing:Year 7', 'wellbeing:Upper Secondary'], array['Year 5']),
  ('thanh.n@pra.edu.vn', 'teacher', array['english:Kindergarten', 'math:Kindergarten', 'science:Kindergarten'], array['Kindergarten']),
  ('duyen.n@pra.edu.vn', 'teacher', array['technology:Year 1'], array[]::text[])
)
update adm_teachers t set subjects = s.subjects, homeroom_groups = s.homeroom, role = s.role, updated_at = now()
from schedule s
where t.email = s.email
  and not exists (select 1 from unnest(coalesce(t.subjects, '{}')) k where k like '%:%');

-- Seth and Bowen are head teachers whatever else changed.
update adm_teachers set role = 'head' where email in ('seth@pra.edu.vn', 'bowen@pra.edu.vn') and role <> 'head';

-- ================================================================
-- 4. Student IDs: PAL0115 -> S0115, BLE codes kept, new students get the next S number
-- ================================================================

update adm_students set student_code = null where trim(coalesce(student_code, '')) = '';
update adm_students set student_code = upper(regexp_replace(student_code, '\s+', '', 'g')) where student_code ~ '\s' or student_code <> upper(student_code);
update adm_students set student_code = 'S' || substring(student_code from 4) where student_code ~ '^PAL\d+$'
  and not exists (select 1 from adm_students o where o.student_code = 'S' || substring(adm_students.student_code from 4));

create or replace function adm_next_student_code() returns text
language sql volatile as $$
  select 'S' || lpad((coalesce(max(substring(student_code from '^S(\d+)$')::int), 0) + 1)::text, 4, '0')
  from adm_students where student_code ~ '^S\d+$'
$$;

create or replace function adm_students_assign_code() returns trigger
language plpgsql as $$
begin
  if new.student_code is null or trim(new.student_code) = '' then
    new.student_code := adm_next_student_code();
  end if;
  return new;
end $$;

drop trigger if exists adm_students_assign_code on adm_students;
create trigger adm_students_assign_code before insert on adm_students
  for each row execute function adm_students_assign_code();

do $$
begin
  if exists (select student_code from adm_students where student_code is not null group by student_code having count(*) > 1) then
    raise notice 'Duplicate student IDs exist; fix them on the Students page, then run this file again to add the unique index.';
  else
    create unique index if not exists adm_students_code_unique on adm_students (student_code) where student_code is not null;
  end if;
end $$;

-- ================================================================
-- 5. Family contacts (several parents / guardians per family)
-- ================================================================

alter table adm_families add column if not exists contacts jsonb default '[]'::jsonb;
alter table adm_students add column if not exists q4_full boolean default false;

-- ================================================================
-- 6. Daily attendance
-- ================================================================

create table if not exists adm_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references adm_students(id) on delete cascade,
  date date not null,
  status text not null default 'present',
  note text,
  year_group text,
  taken_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_id, date)
);
create index if not exists adm_attendance_date on adm_attendance(date);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'adm_attendance_status_check') then
    alter table adm_attendance add constraint adm_attendance_status_check check (status in ('present', 'absent', 'late', 'excused'));
  end if;
end $$;

-- Office, head, homeroom teachers of that year group, or anyone teaching a
-- learning area in it.
create or replace function adm_can_attendance(yg text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_can_homeroom(yg)
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true)
                 and exists (select 1 from unnest(t.subjects) k where k like '%:' || yg))
$$;

alter table adm_attendance enable row level security;
drop policy if exists staff_read on adm_attendance;
drop policy if exists take_insert on adm_attendance;
drop policy if exists take_update on adm_attendance;
drop policy if exists office_delete on adm_attendance;
create policy staff_read on adm_attendance for select to authenticated using (adm_is_report_staff());
create policy take_insert on adm_attendance for insert to authenticated with check (adm_can_attendance(year_group));
create policy take_update on adm_attendance for update to authenticated using (adm_can_attendance(year_group)) with check (adm_can_attendance(year_group));
create policy office_delete on adm_attendance for delete to authenticated using (adm_is_staff() or adm_is_head());
