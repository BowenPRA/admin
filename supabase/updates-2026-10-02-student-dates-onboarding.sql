-- PRA Admin: student dates and the new-student process (2 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run
-- again. The app can be deployed before or after it: until it has run, students
-- save without an expected end date, a lead or the checklist's ticks (lib/db.js).
--
--   Part 1. Expected end date (To-Do #37)
--   Part 2. New-student checklist, and students linked to their lead (To-Do #38)
--
-- Grants (To-Do #22): from 30 October 2026 Supabase no longer gives new tables in
-- `public` to the API roles by itself, so every part that creates a table grants
-- what it needs explicitly (supabase/README.md). Neither part creates a table:
-- both add columns to adm_students, and the grant lines restate the ones the
-- table already has, so nothing changes for it.


-- ===========================================================================
-- Part 1. Expected end date (To-Do #37)
-- ===========================================================================
--
-- end_date is the last day a student is expected to come. It only informs:
-- after it the attendance register and summaries stop expecting the student,
-- the invoice builder leaves them out of quarters that begin after it, and Home
-- and Students show who finishes this quarter. The status (active, pending,
-- past) is never changed by it; the office still sets that by hand.

alter table adm_students add column if not exists end_date date;
comment on column adm_students.end_date is
  'Expected last day at PRA. Informs attendance, the invoice builder and Home; never changes the status by itself.';

grant select, insert, update, delete on adm_students to authenticated;

-- Gene (BLE0055), Hunter (BLE0056) and Oliver (S0136) finish at the end of
-- Quarter 1 (Bowen, 2 October 2026). Matched by student code, and only where no
-- end date is set yet, so a date the office has typed since is kept. The date
-- is Quarter 1's last day in the calendar the app uses (Settings), or 8 October
-- 2026 as in the app's built-in calendar when none is saved or the saved one is
-- not a real day (adm_try_date, from updates-2026-09-30-enrollments.sql, gives
-- no date for something like 2026-02-30 instead of stopping the file).
update adm_students
set end_date = coalesce(
      (select adm_try_date(q ->> 'end')
       from adm_settings,
            jsonb_array_elements(case when key = 'calendar' and jsonb_typeof(value -> 'quarters') = 'array' then value -> 'quarters' end) q
       where key = 'calendar' and q ->> 'id' = 'q1' and q ->> 'end' ~ '^\d{4}-\d{2}-\d{2}$'
         and adm_try_date(q ->> 'end') is not null
       limit 1),
      date '2026-10-08'),
    updated_at = now()
where student_code in ('BLE0055', 'BLE0056', 'S0136') and end_date is null;

notify pgrst, 'reload schema';

select 'Expected end dates are set up. ' || coalesce(
  (select string_agg(coalesce(nullif(nickname, ''), full_name) || ' (' || student_code || '): ' || to_char(end_date, 'DD Mon YYYY'), ', ' order by student_code)
   from adm_students where student_code in ('BLE0055', 'BLE0056', 'S0136') and end_date is not null),
  'Gene, Hunter and Oliver were not found by their student codes.') as result;


-- ===========================================================================
-- Part 2. New-student checklist, and students linked to their lead (To-Do #38)
-- ===========================================================================
--
-- Two columns on adm_students. No new table, so no new grants or rules: the
-- table's own (office accounts change students, teachers read them) apply.
--
--   lead_id     the family on the Leads list the student came from. The office
--               makes pending students from a lead (Leads > a family > Make the
--               student records), and the link keeps the two in step: the lead
--               shows its students, and a lead marked Enrolled with none is flagged.
--   onboarding  the new-student checklist: what people ticked (supply check sent,
--               parents added to the Google Groups, ...) with who and when, and
--               when the checklist started and closed. Blank for students from
--               before; the app works out everything else on the checklist from
--               the records (src/lib/onboarding.js).
--
-- The function behind the website's enrollment form (adm_enrollment_place) is
-- replaced by a copy that also:
--   - gives a student it adds the lead it found, and starts their checklist;
--   - puts a form on a student already on the list only when it is clearly that
--     child: every word of the student's full name is in the name on the form,
--     every word of the form's first name is in the student's name (word order
--     and accents do not matter), and exactly one student fits. It looks first for
--     the same birthday among all students (those who are not Past counted first),
--     then for a pending student made from the same lead whose birthday is not on
--     record or is the same, so a form sent after the office made the record early
--     links to it instead of adding the child twice;
--   - in every other case adds a new pending student, linked to the lead, and the
--     office merges the two if they are the same child. That covers twins and
--     siblings who share name words, a family name typed alone in the first-name
--     box, and a record with a nickname or middle name the form leaves out. The new
--     student joins the family of the lead's children the form may have been meant
--     for, when they are all in one family; otherwise the family is found by the
--     parents' email as before;
--   - links an existing student to the lead (and the form to the student's lead)
--     where one of them has it;
--   - fills in what a pending student's record leaves blank (birthday, gender,
--     nationality, address, allergies, start date, parent contact) from the form.
--     Nothing already written is changed, and an enrolled student is not touched.
-- The website form itself is unchanged and keeps working; the test at the end
-- sends a made-up form through it and takes it back out.

alter table adm_students add column if not exists lead_id uuid references adm_leads(id) on delete set null;
alter table adm_students add column if not exists onboarding jsonb;
create index if not exists adm_students_lead on adm_students (lead_id) where lead_id is not null;
comment on column adm_students.lead_id is
  'The family on the Leads list this student came from (adm_leads.id). Set by the app or the enrollment form.';
comment on column adm_students.onboarding is
  'New-student checklist: {started_at, started_by, from, returning, closed_at, closed_by, steps: {key: {at, by, ...}}}. Blank for students from before.';

grant select, insert, update, delete on adm_students to authenticated;

-- Links a saved form to its student, family and lead. With p_create, a child who
-- is not on the list yet is added as a pending student. (First written in
-- updates-2026-09-30-enrollments.sql; the changes are marked "Part 2".)
create or replace function adm_enrollment_place(p_id uuid, p_create boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  r adm_enrollments%rowtype;
  s jsonb;
  ps jsonb;
  p1 jsonb;
  v_emails text[];
  v_first text;
  v_student uuid;
  v_family uuid;
  v_lead uuid;
  v_name text;
  v_pick uuid;
  v_pick_family uuid;
  v_matches int;
  v_tie_family uuid;
  v_found_lead boolean := false;
  v_made boolean := false;
  v_start int;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_received date;
  v_notes text;
begin
  perform set_config('adm.enrollment_save', '1', true);
  select * into r from adm_enrollments where id = p_id;
  if not found then return; end if;

  s := coalesce(r.data->'student', '{}'::jsonb);
  ps := case when jsonb_typeof(r.data->'parents') = 'array' then r.data->'parents' else '[]'::jsonb end;
  p1 := coalesce(ps->0, '{}'::jsonb);
  v_first := adm_fold(coalesce(r.first_name, r.student_name));
  -- Part 2: the whole name on the form (both name boxes), folded like v_first.
  v_name := adm_fold(coalesce(r.student_name, '') || ' ' || coalesce(r.first_name, ''));
  v_emails := coalesce(array(select distinct x from regexp_split_to_table(lower(coalesce(r.parent_email, '')), '[\s;,]+') x where x like '%@%'), '{}');
  v_student := r.student_id;
  v_family := r.family_id;
  v_lead := r.lead_id;
  v_received := (coalesce(r.submitted_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date;

  -- Part 2: the family on the Leads list is looked up first, by either parent's
  -- email, so that a student the office already made from that lead can be found.
  if v_lead is null and cardinality(v_emails) > 0 then
    select l.id into v_lead from adm_leads l
     where exists (select 1 from unnest(v_emails) em where em = any (regexp_split_to_array(coalesce(l.email, ''), '[\s;,]+')))
     order by l.archived, l.created_at
     limit 1;
    v_found_lead := v_lead is not null;
  end if;

  -- A form is put on a student already on the list only when it is clearly that
  -- child. The name test, in both steps below: every word of the form's first name
  -- is in the student's name (full name, first name or nickname), and (Part 2) every
  -- word of the student's full name is in the name on the form. Word order and
  -- accents do not matter: "Nguyễn Gia Huy" fits a form with First "Gia Huy", Last
  -- "Nguyen", and "Lan Pham" fits First "Pham", Last "Lan". A record with a word
  -- the form does not have (a sibling's given name, a nickname or a middle name
  -- the parents left out) does not fit, and the form adds a new pending student.

  -- The same child: the same birthday and the name test. Part 2: only when exactly
  -- one student fits, counting the students who are not Past first (a returning
  -- child can also have an old record set to Past). With two, or none, it goes on
  -- to the lead.
  if v_student is null and r.dob is not null then
    select x.id, x.family_id, x.n into v_pick, v_pick_family, v_matches from (
      select st.id, st.family_id, coalesce(st.status, 'active') = 'inactive' as past,
             count(*) over (partition by coalesce(st.status, 'active') = 'inactive') as n
        from adm_students st
       where st.dob = r.dob
         and not exists (
           select 1 from regexp_split_to_table(v_first, ' ') tok
            where tok <> ''
              and position(' ' || tok || ' ' in ' ' || adm_fold(st.full_name || ' ' || coalesce(st.first_name, '') || ' ' || coalesce(st.nickname, '')) || ' ') = 0)
         and adm_fold(st.full_name) <> ''
         and not exists (
           select 1 from regexp_split_to_table(adm_fold(st.full_name), ' ') w
            where w <> ''
              and position(' ' || w || ' ' in ' ' || v_name || ' ') = 0)
    ) x order by x.past limit 1;
    if v_matches = 1 then
      v_student := v_pick;
      v_family := v_pick_family;
    end if;
  end if;

  -- Part 2: or a pending student made from the same lead whose birthday is not on
  -- record or is the same, with the name test. Only when exactly one of the lead's
  -- pending students fits. Otherwise the form adds a new pending student linked to
  -- the lead, and the office merges if it is the same child. v_tie_family is the
  -- family of the lead's pending students the form may have been meant for (every
  -- word of its first name is in their name), when they are all in one family: the
  -- new student goes there.
  if v_student is null and v_lead is not null then
    select count(*) filter (where c.whole), (array_agg(c.id) filter (where c.whole))[1], (array_agg(c.family_id) filter (where c.whole))[1],
           case when count(distinct c.family_id) = 1 and count(c.family_id) = count(*) then (array_agg(c.family_id))[1] end
      into v_matches, v_pick, v_pick_family, v_tie_family
      from (
        select st.id, st.family_id,
               adm_fold(st.full_name) <> '' and not exists (
                 select 1 from regexp_split_to_table(adm_fold(st.full_name), ' ') w
                  where w <> ''
                    and position(' ' || w || ' ' in ' ' || v_name || ' ') = 0) as whole
          from adm_students st
         where st.lead_id = v_lead and coalesce(st.status, 'active') = 'pending'
           and (st.dob is null or r.dob is null or st.dob = r.dob)
           and not exists (
             select 1 from regexp_split_to_table(v_first, ' ') tok
              where tok <> ''
                and position(' ' || tok || ' ' in ' ' || adm_fold(st.full_name || ' ' || coalesce(st.first_name, '') || ' ' || coalesce(st.nickname, '')) || ' ') = 0)
      ) c;
    if v_matches = 1 then
      v_student := v_pick;
      v_family := v_pick_family;
    end if;
  end if;

  if v_student is null and p_create then
    -- Part 2: the family of the lead's children the form may have been meant for.
    if v_family is null then
      v_family := v_tie_family;
    end if;
    -- The family: one that already has a parent's email (on the family, in its contacts, or on a sibling).
    if v_family is null and cardinality(v_emails) > 0 then
      select f.id into v_family from adm_families f
       where exists (
         select 1 from unnest(v_emails) em
          where em = any (regexp_split_to_array(lower(coalesce(f.email, '')), '[\s;,]+'))
             or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(f.contacts) = 'array' then f.contacts else '[]'::jsonb end) c
                         where lower(trim(c->>'email')) = em))
       order by f.created_at
       limit 1;
      if v_family is null then
        select st.family_id into v_family from adm_students st
         where st.family_id is not null
           and exists (select 1 from unnest(v_emails) em where em = any (regexp_split_to_array(lower(coalesce(st.parents_email, '')), '[\s;,]+')))
         order by st.created_at
         limit 1;
      end if;
    end if;
    if v_family is null then
      insert into adm_families (name, email, phone, language, notes, contacts)
      values (coalesce(r.first_name, r.student_name) || '''s family',
              nullif(array_to_string(v_emails, ', '), ''),
              r.parent_phone,
              case when lower(coalesce(p1->>'language', '')) like 'viet%' then 'vi' else 'en' end,
              'From the enrollment form received ' || to_char(v_received, 'FMDD Mon YYYY') || '.',
              coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p->>'name', ''), 'relation', coalesce(p->>'relation', ''),
                                                           'email', lower(coalesce(p->>'email', '')), 'phone', coalesce(p->>'phone', '')))
                          from jsonb_array_elements(ps) p
                         where coalesce(p->>'name', '') <> '' or coalesce(p->>'email', '') <> '' or coalesce(p->>'phone', '') <> ''), '[]'::jsonb))
      returning id into v_family;
    end if;

    -- "Academic Year 26-27" starts in 2026; otherwise the year running now (it starts in August).
    v_start := coalesce(2000 + (substring(r.applying_for from '(\d{2})-\d{2}'))::int,
                        extract(year from v_today)::int - case when extract(month from v_today) >= 8 then 0 else 1 end);
    v_notes := 'From the enrollment form received ' || to_char(v_received, 'FMDD Mon YYYY')
      || coalesce(' (' || nullif(r.applying_for, '') || ')', '') || '. Class worked out from the birthday: please check it.'
      || case when r.photo_consent = 'private' then ' Photos: private use only (class chat and internal use, not the website or Facebook).' else '' end;
    -- Part 2: the lead it found, and a started checklist.
    insert into adm_students (family_id, full_name, first_name, level, program, is_new, q4_full, status, active, dob, nationality, gender,
                              parents_email, parent_phone, address, allergies, start_date, notes, lead_id, onboarding)
    values (v_family, r.student_name, r.first_name, coalesce(adm_level_for_birthday(r.dob, v_start), 'Year 1'), 'regular', true, true, 'pending', false,
            r.dob, nullif(s->>'nationality', ''),
            case when lower(coalesce(s->>'gender', '')) in ('male', 'female') then lower(s->>'gender') end,
            nullif(array_to_string(v_emails, ', '), ''), r.parent_phone, nullif(s->>'address', ''),
            nullif(r.data->'health'->>'allergies', ''), adm_try_date(s->>'start_date'), v_notes,
            v_lead, jsonb_build_object('started_at', now(), 'started_by', 'enrollment form', 'from', 'form'))
    returning id into v_student;
    v_made := true;
  end if;

  -- Part 2: an existing student and the lead are linked both ways where one has it,
  -- and a pending student's blanks are filled in from the form.
  if v_student is not null and not v_made then
    if v_lead is null then
      select st.lead_id into v_lead from adm_students st where st.id = v_student;
      v_found_lead := v_lead is not null;
    end if;
    update adm_students st set
      lead_id = coalesce(st.lead_id, v_lead),
      first_name = case when st.status = 'pending' then coalesce(nullif(trim(st.first_name), ''), r.first_name) else st.first_name end,
      dob = case when st.status = 'pending' then coalesce(st.dob, r.dob) else st.dob end,
      nationality = case when st.status = 'pending' then coalesce(nullif(trim(st.nationality), ''), nullif(s->>'nationality', '')) else st.nationality end,
      gender = case when st.status = 'pending' and coalesce(trim(st.gender), '') = '' and lower(coalesce(s->>'gender', '')) in ('male', 'female') then lower(s->>'gender') else st.gender end,
      address = case when st.status = 'pending' then coalesce(nullif(trim(st.address), ''), nullif(s->>'address', '')) else st.address end,
      allergies = case when st.status = 'pending' then coalesce(nullif(trim(st.allergies), ''), nullif(r.data->'health'->>'allergies', '')) else st.allergies end,
      start_date = case when st.status = 'pending' then coalesce(st.start_date, adm_try_date(s->>'start_date')) else st.start_date end,
      parents_email = case when st.status = 'pending' then coalesce(nullif(trim(st.parents_email), ''), nullif(array_to_string(v_emails, ', '), '')) else st.parents_email end,
      parent_phone = case when st.status = 'pending' then coalesce(nullif(trim(st.parent_phone), ''), r.parent_phone) else st.parent_phone end,
      updated_at = now()
     where st.id = v_student;
  end if;

  -- A form that has just come in means the family is enrolling.
  if v_found_lead and p_create and r.source <> 'import' then
    update adm_leads set stage = 'enrolled', archived = false, updated_by = 'enrollment form'
     where id = v_lead and (stage <> 'enrolled' or archived);
  end if;

  update adm_enrollments
     set student_id = v_student, family_id = v_family, lead_id = v_lead, made_student = made_student or v_made
   where id = p_id;
end $$;

revoke all on function adm_enrollment_place(uuid, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- The test. Two made-up forms go through the same function the website calls:
-- one for a child nobody has heard of (a pending student is added, with a
-- checklist), and one for a child the office already made from a lead (the form
-- finds that record and fills in its blanks). Everything they add is undone when
-- the block ends, whether it worked or not. If anything is wrong, this file stops
-- here with the reason in red.
do $$
declare
  v_lead uuid;
  v_kid uuid;
  e record;
begin
  perform adm_enroll_submit('{
    "submission_id": "00000000-0000-4000-8000-0000000c0de2",
    "lang": "en", "website": "", "applying_for": "Academic Year 26-27", "photo_consent": "total", "terms": true,
    "signature": "data:image/png;base64,iVBORw0KGgo=",
    "student": {"first": "Zzselftest", "last": "Zzform", "dob": "2019-02-03", "gender": "female", "nationality": "Test",
                "languages": "English", "place_of_birth": "Test", "id_number": "TEST-0000", "start_date": "2026-10-15",
                "address": {"line1": "1 Test Road", "city": "Hoi An", "country": "Vietnam"}},
    "parents": [{"first": "Zzparent", "last": "Zzform", "relation": "Mother", "nationality": "Test", "id_number": "TEST-0001",
                 "issue_date": "2022-02-01", "issue_place": "Test", "language": "English", "profession": "Test",
                 "same_address": true, "phone": "+84 000 000 000", "email": "selftest@enroll-selftest.invalid"}],
    "emergency": [], "pickup": [], "schools": [],
    "background": {"repeated": "no", "academic": "no", "behavioral": "no", "developmental": "no", "disciplinary": "no", "explain": ""},
    "health": {"surgery": "no", "physician": "no", "emotional": "no", "exercise": "no", "glasses": "no", "dental": "no", "explain": "",
               "allergy_medication": "no", "allergy_food": "no", "dietary": "no", "allergies": ""},
    "files": []
  }'::jsonb);
  select en.made_student, s.status, s.onboarding->>'started_by' as started_by into e
    from adm_enrollments en join adm_students s on s.id = en.student_id
   where en.submission_id = '00000000-0000-4000-8000-0000000c0de2';
  if not found or not e.made_student or e.status <> 'pending' or e.started_by is distinct from 'enrollment form' then
    raise exception 'a new child''s form did not add a pending student with a checklist';
  end if;

  insert into adm_leads (family, email, stage) values ('Zzlead Zzform', 'selftest-lead@enroll-selftest.invalid', 'trial') returning id into v_lead;
  insert into adm_students (full_name, level, status, active, lead_id, student_code)
  values ('Zzlinked Zzform', 'Year 2', 'pending', false, v_lead, 'ZZTEST1') returning id into v_kid;
  perform adm_enroll_submit('{
    "submission_id": "00000000-0000-4000-8000-0000000c0de3",
    "lang": "en", "website": "", "applying_for": "Academic Year 26-27", "photo_consent": "total", "terms": true, "signature": "",
    "student": {"first": "Zzlinked", "last": "Zzform", "dob": "2019-05-06", "gender": "male", "nationality": "Test", "start_date": "2026-10-15",
                "address": {"line1": "2 Test Road", "city": "Hoi An", "country": "Vietnam"}},
    "parents": [{"first": "Zzparent", "last": "Zzform", "relation": "Father", "language": "English", "same_address": true,
                 "phone": "+84 000 000 002", "email": "selftest-lead@enroll-selftest.invalid"}],
    "emergency": [], "pickup": [], "schools": [], "background": {}, "health": {}, "files": []
  }'::jsonb);
  select en.student_id, en.made_student, en.lead_id, s.dob, s.gender, s.lead_id as kid_lead, l.stage into e
    from adm_enrollments en join adm_students s on s.id = en.student_id join adm_leads l on l.id = v_lead
   where en.submission_id = '00000000-0000-4000-8000-0000000c0de3';
  if not found or e.student_id <> v_kid or e.made_student or e.lead_id is distinct from v_lead
     or e.dob is distinct from date '2019-05-06' or e.gender is distinct from 'male' or e.stage <> 'enrolled' then
    raise exception 'a form for a child made from a lead did not find that record (%)', row_to_json(e);
  end if;
  raise exception 'PRA_ONBOARD_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_ONBOARD_TEST_OK' then
    raise exception 'Part 2 is not working: %', sqlerrm;
  end if;
end $$;

select 'Expected end dates are set up. ' || coalesce(
  (select string_agg(coalesce(nullif(nickname, ''), full_name) || ' (' || student_code || '): ' || to_char(end_date, 'DD Mon YYYY'), ', ' order by student_code)
   from adm_students where student_code in ('BLE0055', 'BLE0056', 'S0136') and end_date is not null),
  'Gene, Hunter and Oliver were not found by their student codes.')
  || ' The new-student checklist is set up, and the enrollment form saves (the test forms were taken back out: nothing was added).' as result;
