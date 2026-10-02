-- PRA Admin: the enrollment form could not be sent (1 October 2026). Run once in
-- Supabase > SQL Editor, after updates-2026-09-30-enrollments.sql. Safe to run again.
--
-- On the live database the table adm_enrollments was made by an earlier version
-- of the enrollments file (the one written for Jotform), and "create table if
-- not exists" leaves an existing table as it is. Two things in it stopped every
-- form sent from pra.edu.vn/admissions/enroll/, and the page said "That did
-- not send":
--   - it has no "lang" column (which version of the site a form was filled in on);
--   - its rule for where a form came from does not allow 'website'.
--
-- This brings the table into the shape the final file describes, and then
-- sends one made-up form through the same function the website calls and takes
-- it back out again, so nothing is left on the Enrollments or Students pages.
-- If anything else stops a form from saving, this file fails with the reason in
-- red. If it ends with "The enrollment form saves", the form works.

-- 1. The missing column.
alter table adm_enrollments add column if not exists lang text;

-- 2. The rules and defaults of the final file, whatever the old ones were.
do $$
declare
  c record;
begin
  -- Lets the lines below change rows that only the save functions may write.
  perform set_config('adm.enrollment_save', '1', true);

  -- Every old "must be one of ..." rule goes; the two real ones come back below.
  for c in select conname from pg_constraint where conrelid = 'adm_enrollments'::regclass and contype = 'c' loop
    execute format('alter table adm_enrollments drop constraint %I', c.conname);
  end loop;

  -- A column the final file does not know cannot be filled in by it, so it must be allowed to stay empty.
  for c in select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'adm_enrollments' and is_nullable = 'NO'
              and column_name not in ('id', 'submission_id', 'source', 'student_name', 'data', 'made_student') loop
    execute format('alter table adm_enrollments alter column %I drop not null', c.column_name);
  end loop;
  for c in select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'adm_enrollment_private' and is_nullable = 'NO'
              and column_name not in ('enrollment_id', 'ids', 'files') loop
    execute format('alter table adm_enrollment_private alter column %I drop not null', c.column_name);
  end loop;

  -- A form already in the table from the old version counts as an old form brought in.
  update adm_enrollments set source = 'import' where source is null or source not in ('website', 'import');
  -- The page knows two answers about photos. Any other answer on an old form is kept in its notes and cleared here.
  update adm_enrollments
     set data = data || jsonb_build_object('photo_consent_was', photo_consent), photo_consent = null
   where photo_consent is not null and photo_consent not in ('total', 'private');
end $$;

alter table adm_enrollments alter column id set default gen_random_uuid();
alter table adm_enrollments alter column source set default 'website';
alter table adm_enrollments alter column data set default '{}'::jsonb;
alter table adm_enrollments alter column made_student set default false;
alter table adm_enrollments alter column created_at set default now();
alter table adm_enrollments alter column updated_at set default now();
alter table adm_enrollments add constraint adm_enrollments_source_check check (source in ('website', 'import'));
alter table adm_enrollments add constraint adm_enrollments_photo_consent_check check (photo_consent in ('total', 'private'));

alter table adm_enrollment_private alter column ids set default '{}'::jsonb;
alter table adm_enrollment_private alter column files set default '[]'::jsonb;
alter table adm_enrollment_private alter column created_at set default now();
alter table adm_enrollment_private alter column updated_at set default now();

-- 3. "Sent twice counts once" relies on a form's number being unique.
create unique index if not exists adm_enrollments_submission_uq on adm_enrollments (submission_id);

notify pgrst, 'reload schema';

-- 4. The test. A made-up family that matches nobody; everything it adds is
--    undone when the block ends, whether it worked or not.
do $$
begin
  perform adm_enroll_submit('{
    "submission_id": "00000000-0000-4000-8000-00000000c0de",
    "lang": "en", "website": "", "applying_for": "Academic Year 26-27", "photo_consent": "private", "terms": true,
    "signature": "data:image/png;base64,iVBORw0KGgo=",
    "student": {"first": "Zzselftest", "last": "Zzform", "dob": "2019-02-03", "gender": "female", "nationality": "Test",
                "languages": "English", "place_of_birth": "Test", "id_number": "TEST-0000", "start_date": "",
                "address": {"line1": "1 Test Road", "city": "Hoi An", "country": "Vietnam"}},
    "parents": [{"first": "Zzparent", "last": "Zzform", "relation": "Mother", "nationality": "Test", "id_number": "TEST-0001",
                 "issue_date": "2022-02-01", "issue_place": "Test", "language": "English", "profession": "Test",
                 "same_address": true, "phone": "+84 000 000 000", "email": "selftest@enroll-selftest.invalid"}],
    "emergency": [{"first": "Zzaunt", "last": "Zzform", "relation": "Aunt", "phone": "+84 000 000 001", "email": ""}],
    "pickup": [], "schools": [{"name": "Test", "years": "2024-2026"}], "school_language": "English",
    "background": {"repeated": "no", "academic": "no", "behavioral": "no", "developmental": "no", "disciplinary": "no", "explain": ""},
    "health": {"surgery": "no", "physician": "no", "emotional": "no", "exercise": "no", "glasses": "no", "dental": "no", "explain": "",
               "allergy_medication": "no", "allergy_food": "no", "dietary": "no", "allergies": ""},
    "files": []
  }'::jsonb);
  if not exists (select 1 from adm_enrollments e join adm_students s on s.id = e.student_id
                  join adm_enrollment_private p on p.enrollment_id = e.id
                  where e.submission_id = '00000000-0000-4000-8000-00000000c0de' and s.status = 'pending' and e.lang = 'en') then
    raise exception 'the test form was accepted but no form with a pending student was saved';
  end if;
  raise exception 'PRA_ENROLL_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_ENROLL_TEST_OK' then
    raise exception 'The enrollment form still cannot be saved: %', sqlerrm;
  end if;
end $$;

select 'The enrollment form saves. The test form was taken back out: nothing was added.' as result;
