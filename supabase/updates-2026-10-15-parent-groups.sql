-- PRA Admin: the parent mailing lists follow The Current (15 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run
-- again. The app can be deployed before or after it: until it has run, a
-- student saves without the meals answer (lib/db.js).
--
--   Part 1. Meals at PRA, on the student
--   Part 2. What the parent-groups sync reads
--
-- The Google Groups parents_all@, parents_ey@ and parents_menu@ are kept in
-- step with the student records by parent_groups.py in the triage repository,
-- run on Bowen's laptop (GAM). It signs in with the triage account, which may
-- not read students or families, so Part 2 gives it one narrow reader instead.
--
-- Grants (To-Do #22): neither part creates a table. Part 1 adds a column to
-- adm_students, and its grant line restates the one the table already has.


-- ===========================================================================
-- Part 1. Meals at PRA
-- ===========================================================================
--
-- meals: true when the student has meals at PRA (snacks count as meals, Bowen
-- 15 October 2026), false when not, blank (null)
-- when nobody has said yet. Every student starts blank; the office fills it in
-- by hand in the student window (Bowen, 15 October 2026). It decides who is on
-- parents_menu@, once everyone has an answer, and an invoice made from then on
-- starts with meals unticked for a student marked "no".

alter table adm_students add column if not exists meals boolean;
comment on column adm_students.meals is
  'Has meals at PRA: true, false, or null for not answered yet. Drives parents_menu@ and the invoice builder''s meals box.';

grant select, insert, update, delete on adm_students to authenticated;


-- ===========================================================================
-- Part 2. What the parent-groups sync reads
-- ===========================================================================
--
-- One row per student, past ones too (so the sync can say why an address
-- leaves a list), with only what the lists need: code, name, year group,
-- status, dates, meals, and the parent addresses kept on the family or the
-- student. No dates of birth, phone numbers, home addresses or notes.
-- Office accounts and the triage account may call it; nobody else.

create or replace function adm_parent_groups() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (adm_is_staff() or adm_role() = 'triage') then
    raise exception 'Only office accounts and the triage account can read the parent lists.';
  end if;
  return jsonb_build_object(
    'today', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.student_code,
        'name', coalesce(nullif(trim(s.nickname), ''), s.full_name),
        'full_name', s.full_name,
        'level', s.level,
        'status', coalesce(s.status, case when s.active = false then 'inactive' else 'active' end),
        'start_date', s.start_date,
        'end_date', s.end_date,
        'meals', s.meals,
        'parents_email', s.parents_email,
        'family_id', f.id,
        'family', f.name,
        'family_email', f.email,
        -- null when the family has no contact list (the app then uses the email box)
        'contact_emails', case when jsonb_typeof(f.contacts) = 'array' and jsonb_array_length(f.contacts) > 0
          then (select coalesce(jsonb_agg(c ->> 'email'), '[]'::jsonb) from jsonb_array_elements(f.contacts) c
                where coalesce(c ->> 'email', '') like '%@%')
          end
      ) order by s.full_name)
      from adm_students s left join adm_families f on f.id = s.family_id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function adm_parent_groups() from public, anon;
grant execute on function adm_parent_groups() to authenticated;

notify pgrst, 'reload schema';

select 'Meals and the parent lists are set up. Enrolled students with meals not answered yet: ' ||
  (select count(*) from adm_students where coalesce(status, 'active') = 'active' and meals is null) || '.' as result;
