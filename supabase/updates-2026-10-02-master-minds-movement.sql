-- PRA Admin: updates of 2 October 2026. Run once in Supabase > SQL Editor,
-- after the app with Master Minds is deployed. Safe to run again.
--
-- Progress reports: Master Minds for Year 1 (Mr. Seth) and Movement for Years
-- 1 to 6 (Mr. Chiến). No table changes are needed; the Master Minds area itself
-- arrives with the app (Report settings). The Teachers page buttons "Add 1 from
-- 2026-27 schedule" and "Add 1 new classes from the schedule" do steps 1 and 2
-- too, and the Reports page button "Add Master Minds to … reports" does step 3.

-- 1. Mr. Chiến teaches Movement in Years 1 to 6 (Year 7 stays with Mr. Caleb).
--    He has no login. His row's email is the stand-in "no-login:chien", which
--    can never match anyone who signs in (every login email contains "@"), so
--    the open sign-up cannot give anyone his row's rights. Reports print
--    "Mr. Chiến"; Mr. Seth writes his comments as head teacher.
insert into adm_teachers (email, name, title, role, subjects, homeroom_groups, active) values
  ('no-login:chien', 'Chiến', 'Mr.', 'teacher',
   array['movement:Year 1', 'movement:Year 2', 'movement:Year 3', 'movement:Year 4', 'movement:Year 5', 'movement:Year 6'],
   array[]::text[], true)
on conflict (email) do nothing;

-- 2. Mr. Seth teaches Master Minds in Year 1 (a level and a comment, like Cooking).
update adm_teachers set subjects = array_append(coalesce(subjects, '{}'), 'master_minds:Year 1'), updated_at = now()
where email = 'seth@pra.edu.vn' and not ('master_minds:Year 1' = any(coalesce(subjects, '{}')));

-- 3. Add Master Minds to Year 1 reports made before it existed (published
--    reports are left alone).
insert into adm_report_sections (report_id, subject_key, kind, sort, name, teacher_name)
select r.id, 'master_minds', 'specialist', 11, 'Master Minds', 'Mr. Seth'
from adm_reports r
where r.year_group = 'Year 1' and coalesce(r.status, '') <> 'published'
  and not exists (select 1 from adm_report_sections s where s.report_id = r.id and s.subject_key = 'master_minds');
