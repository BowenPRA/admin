-- PRA Admin: updates of 17 September 2026. Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.

-- 1. Attendance: whoever may take attendance for a year group may also take a
--    mark off again (tapping the chosen status a second time). Before this,
--    only office accounts could, so a teacher's un-mark was refused.
drop policy if exists take_delete on adm_attendance;
create policy take_delete on adm_attendance for delete to authenticated using (adm_can_attendance(year_group));

-- 2. Progress reports: only the head teacher publishes. A homeroom teacher who
--    picked "Published" by mistake could not undo it.
drop policy if exists hr_update on adm_reports;
create policy hr_update on adm_reports for update to authenticated
  using (adm_can_homeroom(year_group) and (adm_is_head() or coalesce(status, '') <> 'published'))
  with check (adm_can_homeroom(year_group) and (adm_is_head() or coalesce(status, '') <> 'published'));

-- 3. One report per student per period. Skipped with a notice if duplicates
--    already exist (delete the extra report in the app, then run this again).
do $$
begin
  create unique index if not exists adm_reports_one_per_period on adm_reports (student_id, school_year, period_label);
exception when unique_violation then
  raise notice 'Some students have two reports for the same period; the unique index was not added.';
end $$;

-- 4. Primary progress reports (Years 1 to 6): the teachers of the new learning
--    areas, from Schedule 2026-2027. Only adds classes; nothing is removed.
--    Movement in Primary is taught by Mr. Chiến (part time, no login), so the
--    head teacher writes that part or types his name on the report.
with extra(email, keys) as (values
  ('seth@pra.edu.vn',    array['cooking:Year 1', 'cooking:Year 2', 'cooking:Year 3', 'cooking:Year 4', 'cooking:Year 5']),
  ('solo@pra.edu.vn',    array['presentation_play:Year 1']),
  ('caleb@pra.edu.vn',   array['art_craft:Year 2', 'art_craft:Year 3', 'art_craft:Year 4', 'art_craft:Year 5',
                               'everyday_experts:Year 2', 'everyday_experts:Year 3', 'everyday_experts:Year 4', 'everyday_experts:Year 5']),
  ('kiu@pra.edu.vn',     array['wellbeing:Year 2', 'wellbeing:Year 3', 'wellbeing:Year 4', 'wellbeing:Year 5']),
  ('duyen.n@pra.edu.vn', array['art_craft:Year 1']),
  ('tham.v@pra.edu.vn',  array['art_craft:Year 2', 'art_craft:Year 3', 'art_craft:Year 4', 'art_craft:Year 5'])
)
update adm_teachers t
set subjects = (select array_agg(distinct k order by k) from unnest(coalesce(t.subjects, '{}') || e.keys) k), updated_at = now()
from extra e
where t.email = e.email and not (coalesce(t.subjects, '{}') @> e.keys);
