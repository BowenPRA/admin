-- PRA Admin: ECAs, the after-class activities (21 October 2026). Run once in
-- Supabase > SQL Editor, after the earlier update files. Safe to run again.
--
-- Each quarter has its own ECA term (dates and times), and each term its own
-- activities: a name, a day of the week, the teacher who runs it and the year
-- groups it is open to. Each activity has a list of students, and a register
-- for each session. ECA registers are kept apart from the daily attendance:
-- they never change a student's attendance rate.

-- 1. A term: when this round of ECAs runs.
create table if not exists adm_eca_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,                      -- 'Quarter 2'
  school_year text,                        -- '2026-2027'
  from_date date not null,                 -- the first day ECAs run
  to_date date not null,                   -- the last day ECAs run
  start_time text not null default '15:30',
  end_time text not null default '16:15',
  note text,                               -- e.g. 'Pick-up at 4:15'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table adm_eca_terms drop constraint if exists adm_eca_terms_dates_check;
alter table adm_eca_terms add constraint adm_eca_terms_dates_check check (to_date >= from_date);

-- 2. An activity in a term.
create table if not exists adm_eca_activities (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references adm_eca_terms(id) on delete cascade,
  name text not null,                      -- 'Table Games'
  name_vi text,                            -- 'Trò chơi trên bàn'
  weekday int not null,                    -- 1 Monday ... 5 Friday
  teacher_email text,                      -- the teacher who runs it and takes its register
  year_groups text[] not null default '{}',-- the year groups it is open to
  description text,
  room text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table adm_eca_activities drop constraint if exists adm_eca_activities_weekday_check;
alter table adm_eca_activities add constraint adm_eca_activities_weekday_check check (weekday between 1 and 7);
create index if not exists adm_eca_activities_term on adm_eca_activities (term_id);

-- 3. The students on an activity's list. `waiting` is the waiting list (a
--    half-day student, or a full activity).
create table if not exists adm_eca_members (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references adm_eca_activities(id) on delete cascade,
  student_id uuid not null references adm_students(id) on delete cascade,
  status text not null default 'joined',
  note text,
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (activity_id, student_id)
);
alter table adm_eca_members drop constraint if exists adm_eca_members_status_check;
alter table adm_eca_members add constraint adm_eca_members_status_check check (status in ('joined', 'waiting'));
create index if not exists adm_eca_members_student on adm_eca_members (student_id);

-- 4. The register: one mark per student per session.
create table if not exists adm_eca_attendance (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references adm_eca_activities(id) on delete cascade,
  student_id uuid not null references adm_students(id) on delete cascade,
  date date not null,
  status text not null default 'present',
  note text,
  taken_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (activity_id, student_id, date)
);
alter table adm_eca_attendance drop constraint if exists adm_eca_attendance_status_check;
alter table adm_eca_attendance add constraint adm_eca_attendance_status_check check (status in ('present', 'absent', 'late'));
create index if not exists adm_eca_attendance_date on adm_eca_attendance (date);

-- 5. Who added a student to a list is set here, from the signed-in account.
create or replace function adm_eca_members_stamp() returns trigger
language plpgsql as $$
begin
  new.note := nullif(trim(coalesce(new.note, '')), '');
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.added_by := coalesce(nullif(adm_email(), ''), new.added_by);
    new.created_at := coalesce(new.created_at, now());
  else
    new.added_by := old.added_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists adm_eca_members_stamp on adm_eca_members;
create trigger adm_eca_members_stamp before insert or update on adm_eca_members
  for each row execute function adm_eca_members_stamp();

-- 6. The office and the head set up terms and activities. They, and the
--    teacher who runs an activity, change its list and take its register.
--    Every member of staff can read all of it.
create or replace function adm_can_eca(p_activity uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
      or exists (select 1 from adm_eca_activities a
                 where a.id = p_activity and lower(coalesce(a.teacher_email, '')) = adm_email() and adm_email() <> '')
$$;

alter table adm_eca_terms enable row level security;
alter table adm_eca_activities enable row level security;
alter table adm_eca_members enable row level security;
alter table adm_eca_attendance enable row level security;
revoke all on adm_eca_terms, adm_eca_activities, adm_eca_members, adm_eca_attendance from anon;
grant select, insert, update, delete on adm_eca_terms, adm_eca_activities, adm_eca_members, adm_eca_attendance to authenticated;
grant execute on function adm_can_eca(uuid) to authenticated;

drop policy if exists eca_read on adm_eca_terms;
create policy eca_read on adm_eca_terms for select to authenticated using (adm_is_report_staff());
drop policy if exists eca_office on adm_eca_terms;
create policy eca_office on adm_eca_terms for all to authenticated
  using (adm_is_staff() or adm_is_head()) with check (adm_is_staff() or adm_is_head());

drop policy if exists eca_read on adm_eca_activities;
create policy eca_read on adm_eca_activities for select to authenticated using (adm_is_report_staff());
drop policy if exists eca_office on adm_eca_activities;
create policy eca_office on adm_eca_activities for all to authenticated
  using (adm_is_staff() or adm_is_head()) with check (adm_is_staff() or adm_is_head());

drop policy if exists eca_read on adm_eca_members;
create policy eca_read on adm_eca_members for select to authenticated using (adm_is_report_staff());
drop policy if exists eca_add on adm_eca_members;
create policy eca_add on adm_eca_members for insert to authenticated with check (adm_can_eca(activity_id));
drop policy if exists eca_change on adm_eca_members;
create policy eca_change on adm_eca_members for update to authenticated
  using (adm_can_eca(activity_id)) with check (adm_can_eca(activity_id));
drop policy if exists eca_remove on adm_eca_members;
create policy eca_remove on adm_eca_members for delete to authenticated using (adm_can_eca(activity_id));

drop policy if exists eca_read on adm_eca_attendance;
create policy eca_read on adm_eca_attendance for select to authenticated using (adm_is_report_staff());
drop policy if exists eca_take on adm_eca_attendance;
create policy eca_take on adm_eca_attendance for insert to authenticated with check (adm_can_eca(activity_id));
drop policy if exists eca_change on adm_eca_attendance;
create policy eca_change on adm_eca_attendance for update to authenticated
  using (adm_can_eca(activity_id)) with check (adm_can_eca(activity_id));
drop policy if exists eca_remove on adm_eca_attendance;
create policy eca_remove on adm_eca_attendance for delete to authenticated using (adm_can_eca(activity_id));

notify pgrst, 'reload schema';

select 'ECAs are set up: ' || (select count(*) from adm_eca_terms) || ' terms, '
    || (select count(*) from adm_eca_activities) || ' activities so far.' as result;
