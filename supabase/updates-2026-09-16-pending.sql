-- Student status: 'active' | 'pending' | 'inactive'.
--
-- Replaces the old `active` boolean with three states. New and returning
-- students start as 'pending': they can be invoiced, but they stay out of the
-- register, the reports and the enrolled counts until the office marks them
-- active. The `active` column stays and the app keeps it in step
-- (active = status is 'active') so older rows and scripts keep working.
--
-- Safe to run more than once.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'adm_students' and column_name = 'status'
  ) then
    alter table adm_students add column status text;
    update adm_students set status = case when active is false then 'inactive' else 'active' end;
    alter table adm_students alter column status set default 'pending';
  end if;
end $$;

update adm_students set status = case when active is false then 'inactive' else 'active' end where status is null;

alter table adm_students drop constraint if exists adm_students_status_check;
alter table adm_students add constraint adm_students_status_check check (status in ('active', 'pending', 'inactive'));

create index if not exists adm_students_status_idx on adm_students (status);
