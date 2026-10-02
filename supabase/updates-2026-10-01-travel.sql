-- PRA Admin: students who are traveling (1 October 2026). Run once in Supabase >
-- SQL Editor, after the earlier update files. Safe to run again.
--
-- A family tells PRA that a student will be away: from which day, to which
-- day, and where. One row here per trip. On every PRA day inside a trip the
-- attendance page shows the student as A(T), Absent (Traveling), ahead of
-- time. A(T) is still an absence: the summaries count those days in the
-- attendance rate, in a column of their own. Nothing is written into
-- adm_attendance for a trip: the A(T) is worked out from these rows, so
-- changing or removing a trip corrects every day at once. A Present or Late
-- mark made on a day inside a trip stands (the student came back early).

-- 1. One row per trip.
create table if not exists adm_travel (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references adm_students(id) on delete cascade,
  from_date date not null,                 -- the first day away
  to_date date not null,                   -- the last day away
  place text,                              -- where they are going
  note text,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table adm_travel drop constraint if exists adm_travel_dates_check;
alter table adm_travel add constraint adm_travel_dates_check check (to_date >= from_date);
create index if not exists adm_travel_student on adm_travel (student_id);

-- 2. Who added and last changed a trip is set here, from the signed-in account.
create or replace function adm_travel_stamp() returns trigger
language plpgsql as $$
begin
  new.place := nullif(trim(coalesce(new.place, '')), '');
  new.note := nullif(trim(coalesce(new.note, '')), '');
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

drop trigger if exists adm_travel_stamp on adm_travel;
create trigger adm_travel_stamp before insert or update on adm_travel
  for each row execute function adm_travel_stamp();

-- 3. Anyone who can take a class's attendance can add, change or remove a trip
--    for a student in it; the office and the head for everyone. Everyone who
--    can read attendance can read trips.
create or replace function adm_can_travel(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
      or exists (select 1 from adm_students s where s.id = p_student and adm_can_attendance(s.level))
$$;

alter table adm_travel enable row level security;
revoke all on adm_travel from anon;
grant select, insert, update, delete on adm_travel to authenticated;
grant execute on function adm_can_travel(uuid) to authenticated;

drop policy if exists travel_read on adm_travel;
create policy travel_read on adm_travel for select to authenticated
  using (adm_is_report_staff());

drop policy if exists travel_add on adm_travel;
create policy travel_add on adm_travel for insert to authenticated
  with check (adm_can_travel(student_id));

drop policy if exists travel_change on adm_travel;
create policy travel_change on adm_travel for update to authenticated
  using (adm_can_travel(student_id)) with check (adm_can_travel(student_id));

drop policy if exists travel_remove on adm_travel;
create policy travel_remove on adm_travel for delete to authenticated
  using (adm_can_travel(student_id));

notify pgrst, 'reload schema';

select 'Traveling is set up: ' || (select count(*) from adm_travel) || ' trips so far.' as result;
