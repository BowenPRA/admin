-- PRA Admin: progress reports (added 2026-09-14). Run once in Supabase > SQL
-- editor after schema.sql. Safe to re-run.

-- Extra student details used on reports. `level` is already the year group.
alter table adm_students add column if not exists student_code text;
alter table adm_students add column if not exists gender text;
alter table adm_students add column if not exists class_group text;
alter table adm_students add column if not exists parents_email text;
alter table adm_students add column if not exists parent_phone text;
alter table adm_students add column if not exists address text;
alter table adm_students add column if not exists allergies text;
alter table adm_students add column if not exists start_date date;
alter table adm_students add column if not exists enrollment_status text;
alter table adm_students add column if not exists photo text;

-- Who may edit what on progress reports. `email` must match the login email.
--   role 'head'    – everything
--   role 'teacher' – the subject keys in `subjects`, plus the overview / skills /
--                    homeroom parts of reports whose year_group is in
--                    `homeroom_groups` ('*' = every year group)
create table if not exists adm_teachers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  title text,
  role text default 'teacher',
  subjects text[] default '{}',
  homeroom_groups text[] default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists adm_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references adm_students(id) on delete set null,
  student_name text,
  school_year text,
  period_label text,
  period_index int,
  period_start date,
  period_end date,
  template text,
  year_group text,
  class_name text,
  homeroom_teacher text,
  report_date date,
  glance text,
  overview_note text,
  homeroom_note text,
  homeroom_note_vi text,
  experiences jsonb default '[]',
  experiences_vi jsonb default '[]',
  student_voice text,
  student_voice_vi text,
  skills jsonb default '{}',
  skill_notes jsonb default '{}',
  status text default 'draft',
  lang text default 'en',
  show_course_notes boolean default false,
  signatures jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists adm_reports_student on adm_reports(student_id);
create index if not exists adm_reports_period on adm_reports(school_year, period_label, year_group);

-- One row per learning area per report, so each subject teacher's save only
-- touches their own row and row-level security can limit them to it.
create table if not exists adm_report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references adm_reports(id) on delete cascade,
  subject_key text not null,
  kind text,
  sort int default 0,
  name text,
  level int,
  level_prev int,
  comment text,
  comment_vi text,
  next_focus text,
  next_focus_vi text,
  score_raw text,
  score_pct numeric,
  class_avg numeric,
  summative_raw text,
  summative_pct numeric,
  teacher_name text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (report_id, subject_key)
);
create index if not exists adm_report_sections_report on adm_report_sections(report_id);

-- "What we studied this period": shared by every report of a year group.
create table if not exists adm_course_notes (
  id uuid primary key default gen_random_uuid(),
  school_year text,
  period_label text,
  year_group text,
  subject_key text,
  description text,
  description_vi text,
  teacher_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (school_year, period_label, year_group, subject_key)
);

-- ---------------------------------------------------------------- permissions
-- Helpers read adm_teachers as the definer so the policies never recurse.
create or replace function adm_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function adm_is_head() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      or exists (select 1 from adm_teachers t where t.email = adm_email() and t.role = 'head' and coalesce(t.active, true))
$$;

-- Office accounts (app_metadata teacher/admin) plus anyone listed as a teacher.
create or replace function adm_is_report_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true))
$$;

create or replace function adm_can_subject(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true) and k = any(t.subjects))
$$;

create or replace function adm_can_homeroom(yg text) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t where t.email = adm_email() and coalesce(t.active, true)
                 and (yg = any(t.homeroom_groups) or '*' = any(t.homeroom_groups)))
$$;

alter table adm_teachers enable row level security;
alter table adm_reports enable row level security;
alter table adm_report_sections enable row level security;
alter table adm_course_notes enable row level security;

-- Students: report teachers may read them; office accounts and the head may change them.
drop policy if exists staff_all on adm_students;
drop policy if exists report_read on adm_students;
drop policy if exists office_insert on adm_students;
drop policy if exists office_update on adm_students;
drop policy if exists office_delete on adm_students;
create policy report_read on adm_students for select to authenticated using (adm_is_report_staff());
create policy office_insert on adm_students for insert to authenticated with check (adm_is_staff() or adm_is_head());
create policy office_update on adm_students for update to authenticated using (adm_is_staff() or adm_is_head()) with check (adm_is_staff() or adm_is_head());
create policy office_delete on adm_students for delete to authenticated using (adm_is_staff() or adm_is_head());

-- Report settings live in adm_settings under key 'reports': report teachers
-- read it, the head writes it (office accounts keep their existing full access).
drop policy if exists report_settings_read on adm_settings;
drop policy if exists head_settings on adm_settings;
create policy report_settings_read on adm_settings for select to authenticated using (adm_is_report_staff());
create policy head_settings on adm_settings for all to authenticated using (adm_is_head()) with check (adm_is_head());

-- Teachers list: everyone signed in may read it (it decides their own rights); head writes.
drop policy if exists staff_read on adm_teachers;
drop policy if exists head_insert on adm_teachers;
drop policy if exists head_update on adm_teachers;
drop policy if exists head_delete on adm_teachers;
create policy staff_read on adm_teachers for select to authenticated using (true);
create policy head_insert on adm_teachers for insert to authenticated with check (adm_is_head());
create policy head_update on adm_teachers for update to authenticated using (adm_is_head()) with check (adm_is_head());
create policy head_delete on adm_teachers for delete to authenticated using (adm_is_head());

-- Reports: head creates and deletes; head or the homeroom teacher of that year group edits.
drop policy if exists staff_read on adm_reports;
drop policy if exists hr_insert on adm_reports;
drop policy if exists hr_update on adm_reports;
drop policy if exists head_delete on adm_reports;
create policy staff_read on adm_reports for select to authenticated using (adm_is_report_staff());
create policy hr_insert on adm_reports for insert to authenticated with check (adm_can_homeroom(year_group));
create policy hr_update on adm_reports for update to authenticated using (adm_can_homeroom(year_group)) with check (adm_can_homeroom(year_group));
create policy head_delete on adm_reports for delete to authenticated using (adm_is_head());

-- Sections: only the teacher assigned to that subject (or the head) may write it.
drop policy if exists staff_read on adm_report_sections;
drop policy if exists subj_insert on adm_report_sections;
drop policy if exists subj_update on adm_report_sections;
drop policy if exists head_delete on adm_report_sections;
create policy staff_read on adm_report_sections for select to authenticated using (adm_is_report_staff());
create policy subj_insert on adm_report_sections for insert to authenticated with check (adm_can_subject(subject_key));
create policy subj_update on adm_report_sections for update to authenticated using (adm_can_subject(subject_key)) with check (adm_can_subject(subject_key));
create policy head_delete on adm_report_sections for delete to authenticated using (adm_is_head());

-- Course notes follow the subject permission too.
drop policy if exists staff_read on adm_course_notes;
drop policy if exists subj_insert on adm_course_notes;
drop policy if exists subj_update on adm_course_notes;
drop policy if exists head_delete on adm_course_notes;
create policy staff_read on adm_course_notes for select to authenticated using (adm_is_report_staff());
create policy subj_insert on adm_course_notes for insert to authenticated with check (adm_can_subject(subject_key));
create policy subj_update on adm_course_notes for update to authenticated using (adm_can_subject(subject_key)) with check (adm_can_subject(subject_key));
create policy head_delete on adm_course_notes for delete to authenticated using (adm_is_head());
