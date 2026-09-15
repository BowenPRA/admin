-- PRA Admin: progress report tiers, Movement for Year 7, summative end-of-year
-- test score, and Vietnamese versions of every printed text.
-- Run in Supabase > SQL Editor, after updates-2026-09-15.sql. Safe to run
-- again (including if an earlier copy of this file was already run): every
-- step checks what is already there.

-- 1. Summative end-of-year test score (entered on the last quarter's report,
--    shown in the Q1-Q4 + Summative table on every report).
alter table adm_report_sections add column if not exists summative_raw text;
alter table adm_report_sections add column if not exists summative_pct numeric;

-- 1b. Vietnamese reports print as their own page, so every printed text has a
--     Vietnamese version (comment_vi, homeroom_note_vi and description_vi
--     already exist).
alter table adm_report_sections add column if not exists next_focus_vi text;
alter table adm_reports add column if not exists student_voice_vi text;
alter table adm_reports add column if not exists experiences_vi jsonb default '[]';

-- 2. Art of Science and History are now specialist areas (level + comment);
--    Executive Function, Technology and Wellbeing stay vocational (level +
--    topics covered shared by the year group). The app reads the tier from
--    report settings, so this only keeps the stored rows tidy.
update adm_report_sections set kind = 'specialist'
where subject_key in ('art_of_science', 'history') and coalesce(kind, 'vocational') = 'vocational';

-- 3. Mr. Caleb teaches Movement in Year 7.
update adm_teachers set subjects = array_append(coalesce(subjects, '{}'), 'movement:Year 7'), updated_at = now()
where email = 'caleb@pra.edu.vn' and not ('movement:Year 7' = any(coalesce(subjects, '{}')));

-- 4. Add Movement to Year 7 reports created before it existed (published
--    reports are left alone).
insert into adm_report_sections (report_id, subject_key, kind, sort, name, teacher_name)
select r.id, 'movement', 'specialist', 5, 'Movement', 'Mr. Caleb'
from adm_reports r
where r.year_group = 'Year 7' and coalesce(r.status, '') <> 'published'
  and not exists (select 1 from adm_report_sections s where s.report_id = r.id and s.subject_key = 'movement');
