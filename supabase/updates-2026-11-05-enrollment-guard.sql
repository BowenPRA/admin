-- PRA Admin: the website's enrollment form no longer changes records that are
-- already in The Current (5 November 2026). NOT RUN YET. Run once in Supabase >
-- SQL Editor, after updates-2026-10-02-student-dates-onboarding.sql. Safe to run
-- again. Found in the PRA Learn security review (C:\Users\sbowe\learn\docs\DESIGN.md,
-- section 6.2, finding 3; C:\Users\sbowe\learn\REVIEW-SECURITY.md).
--
-- The problem. The form on pra.edu.vn/admissions/enroll/ can be sent by anyone,
-- without signing in. Until now, when a form arrived, adm_enrollment_place could:
--   - fill blank fields of an existing Pending student (parent email, phone,
--     address, allergies, birthday ...) when the form gave that child's name and
--     birthday, so a stranger could put their own email on a real child's record;
--   - add a made-up child to a real family, found by a parent's email;
--   - link a made-up child to a real lead and move that lead to Enrolled.
--
-- What changes. Only adm_enrollment_place (latest copy:
-- updates-2026-10-02-student-dates-onboarding.sql), and only when nobody from the
-- office is signed in, which is the website:
--   - A form from a family The Current does not know (no student fits, no family
--     and no lead has a parent's email) still adds the child as a Pending student
--     in a new family, as before.
--   - A form that WOULD touch what is already there (an existing student fits, or
--     a family or a lead has a parent's email) is saved but left on its own: no
--     student is added or changed, no family gets a new child, no lead moves. The
--     row on Enrollments shows "No student yet".
--   - The office opens such a form, checks it, and presses "Add pending student".
--     That runs the same rules as before, as the office: it links the form to the
--     child already on the list (filling the record's blanks), or adds the child to
--     the right family and lead, and moves the lead to Enrolled.
-- Old forms brought in by the super admin (adm_enrollment_import) and the office's
-- own button (adm_enrollment_make_student) are unchanged. adm_enroll_submit,
-- adm_enrollment_save and the emails are unchanged: the office alert already says
-- "In The Current: not linked to a student yet" for such a form.
--
-- The test at the end sends made-up forms through the website's function and the
-- office's button, checks both, and takes everything back out.

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
  -- Guard: an office account (super_admin, head, admin) is signed in. The website
  -- (and any other login, such as a PRA Learn student or a stranger) is not.
  v_office boolean := adm_is_staff();
begin
  perform set_config('adm.enrollment_save', '1', true);
  select * into r from adm_enrollments where id = p_id;
  if not found then return; end if;

  s := coalesce(r.data->'student', '{}'::jsonb);
  ps := case when jsonb_typeof(r.data->'parents') = 'array' then r.data->'parents' else '[]'::jsonb end;
  p1 := coalesce(ps->0, '{}'::jsonb);
  v_first := adm_fold(coalesce(r.first_name, r.student_name));
  v_name := adm_fold(coalesce(r.student_name, '') || ' ' || coalesce(r.first_name, ''));
  v_emails := coalesce(array(select distinct x from regexp_split_to_table(lower(coalesce(r.parent_email, '')), '[\s;,]+') x where x like '%@%'), '{}');
  v_student := r.student_id;
  v_family := r.family_id;
  v_lead := r.lead_id;
  v_received := (coalesce(r.submitted_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date;

  -- Guard: a form the website placed earlier is never placed again from the website.
  if not v_office and (v_student is not null or v_family is not null or v_lead is not null) then
    return;
  end if;

  -- The family on the Leads list, by either parent's email.
  if v_lead is null and cardinality(v_emails) > 0 then
    select l.id into v_lead from adm_leads l
     where exists (select 1 from unnest(v_emails) em where em = any (regexp_split_to_array(coalesce(l.email, ''), '[\s;,]+')))
     order by l.archived, l.created_at
     limit 1;
    v_found_lead := v_lead is not null;
  end if;

  -- The same child: the same birthday and the name test, when exactly one student fits.
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

  -- Or a pending student made from the same lead, when exactly one fits.
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
  end if;

  -- Guard: from the website, a form that would join or change anything already in
  -- The Current (a student who fits, a family or a lead with a parent's email) is
  -- left as it is, with no student. The office adds the student from the form
  -- ("Add pending student"), and the rules above then run as the office.
  if not v_office and (v_student is not null or v_family is not null or v_lead is not null) then
    return;
  end if;

  if v_student is null and p_create then
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

  -- An existing student and the lead are linked both ways where one has it, and a
  -- pending student's blanks are filled in from the form. (Office only: the guard
  -- above has returned for the website.)
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

  -- A form that has just come in means the family is enrolling. (Office only, as above.)
  if v_found_lead and p_create and r.source <> 'import' and v_office then
    update adm_leads set stage = 'enrolled', archived = false, updated_by = 'enrollment form'
     where id = v_lead and (stage <> 'enrolled' or archived);
  end if;

  update adm_enrollments
     set student_id = v_student, family_id = v_family, lead_id = v_lead, made_student = made_student or v_made
   where id = p_id;
end $$;

revoke all on function adm_enrollment_place(uuid, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- The test. Made-up records and forms; everything is taken back out when the block
-- ends, whether it worked or not. If anything is wrong, this file stops here with
-- the reason in red.
do $$
declare
  v_lead uuid;
  v_family uuid;
  v_kid uuid;
  v_form uuid;
  before_kid text;
  before_lead text;
  before_family text;
  n_students int;
  n_families int;
  e record;
begin
  -- What is already there: a lead, a family made from it, and a Pending child with blanks.
  insert into adm_leads (family, email, stage) values ('Zzguard family', 'selftest-guard@enroll-selftest.invalid', 'trial') returning id into v_lead;
  insert into adm_families (name, email) values ('Zzguard family', 'selftest-guard@enroll-selftest.invalid') returning id into v_family;
  insert into adm_students (family_id, full_name, level, status, active, lead_id, student_code)
  values (v_family, 'Zzguard Zzkid', 'Year 2', 'pending', false, v_lead, 'ZZGUARD1') returning id into v_kid;
  select row_to_json(st)::text into before_kid from adm_students st where st.id = v_kid;
  select row_to_json(l)::text into before_lead from adm_leads l where l.id = v_lead;
  select row_to_json(f)::text into before_family from adm_families f where f.id = v_family;
  select count(*) into n_students from adm_students;
  select count(*) into n_families from adm_families;

  -- 1. The website (nobody signed in): a form for that child, and one for a made-up sibling.
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform adm_enroll_submit(('{"submission_id": "00000000-0000-4000-8000-00000000c0d1", "lang": "en", "website": "", "terms": true,
    "applying_for": "Academic Year 26-27", "photo_consent": "total",
    "student": {"first": "Zzguard", "last": "Zzkid", "dob": "2019-05-06", "gender": "male", "start_date": "2026-11-20",
                "address": {"line1": "9 Stranger Road", "city": "Hoi An"}},
    "parents": [{"first": "Zz", "last": "Stranger", "email": "selftest-guard@enroll-selftest.invalid", "phone": "+84 000 000 009"}],
    "health": {"allergies": "made up"}, "files": []}')::jsonb);
  perform adm_enroll_submit(('{"submission_id": "00000000-0000-4000-8000-00000000c0d2", "lang": "en", "website": "", "terms": true,
    "student": {"first": "Zzmadeup", "last": "Zzsibling", "dob": "2018-01-01"},
    "parents": [{"first": "Zz", "last": "Stranger", "email": "selftest-guard@enroll-selftest.invalid"}], "files": []}')::jsonb);
  if (select row_to_json(st)::text from adm_students st where st.id = v_kid) is distinct from before_kid
     or (select row_to_json(l)::text from adm_leads l where l.id = v_lead) is distinct from before_lead
     or (select row_to_json(f)::text from adm_families f where f.id = v_family) is distinct from before_family
     or (select count(*) from adm_students) <> n_students or (select count(*) from adm_families) <> n_families then
    raise exception 'a form from the website changed or added to records already in The Current';
  end if;
  if exists (select 1 from adm_enrollments where submission_id in ('00000000-0000-4000-8000-00000000c0d1', '00000000-0000-4000-8000-00000000c0d2')
              and (student_id is not null or family_id is not null or lead_id is not null)) then
    raise exception 'a form from the website was linked to records already in The Current';
  end if;
  if (select count(*) from adm_enrollments where submission_id in ('00000000-0000-4000-8000-00000000c0d1', '00000000-0000-4000-8000-00000000c0d2')) <> 2 then
    raise exception 'a form from the website was not saved';
  end if;

  -- 2. A family nobody knows: the website still adds a Pending child in a new family.
  perform adm_enroll_submit(('{"submission_id": "00000000-0000-4000-8000-00000000c0d3", "lang": "en", "website": "", "terms": true,
    "student": {"first": "Zznew", "last": "Zzfamily", "dob": "2019-02-03", "gender": "female"},
    "parents": [{"first": "Zz", "last": "New", "email": "selftest-new@enroll-selftest.invalid"}], "files": []}')::jsonb);
  select en.made_student, s.status, s.family_id, s.lead_id into e
    from adm_enrollments en join adm_students s on s.id = en.student_id
   where en.submission_id = '00000000-0000-4000-8000-00000000c0d3';
  if not found or not e.made_student or e.status <> 'pending' or e.family_id is null or e.family_id = v_family or e.lead_id is not null then
    raise exception 'a form from a new family did not add a Pending child in a new family';
  end if;

  -- 3. The office presses "Add pending student" on the first form: it finds the child,
  --    fills the blanks, and moves the lead to Enrolled, as before.
  perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "selftest-office@pra-selftest.invalid", "app_metadata": {"role": "admin"}}', true);
  select id into v_form from adm_enrollments where submission_id = '00000000-0000-4000-8000-00000000c0d1';
  perform adm_enrollment_make_student(v_form);
  select en.student_id, en.made_student, en.lead_id, s.dob, s.parents_email, l.stage into e
    from adm_enrollments en join adm_students s on s.id = en.student_id join adm_leads l on l.id = v_lead
   where en.id = v_form;
  if not found or e.student_id <> v_kid or e.made_student or e.lead_id is distinct from v_lead or e.dob is distinct from date '2019-05-06'
     or e.parents_email is distinct from 'selftest-guard@enroll-selftest.invalid' or e.stage <> 'enrolled' then
    raise exception 'the office''s Add pending student did not link the form to the child (%)', row_to_json(e);
  end if;
  -- ... and on the sibling's form: a new Pending child in the same family.
  select id into v_form from adm_enrollments where submission_id = '00000000-0000-4000-8000-00000000c0d2';
  perform adm_enrollment_make_student(v_form);
  select en.made_student, s.family_id into e from adm_enrollments en join adm_students s on s.id = en.student_id where en.id = v_form;
  if not found or not e.made_student or e.family_id is distinct from v_family then
    raise exception 'the office''s Add pending student did not put the sibling in the family';
  end if;

  raise exception 'PRA_ENROLL_GUARD_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_ENROLL_GUARD_TEST_OK' then
    raise exception 'The enrollment guard is not working: %', sqlerrm;
  end if;
end $$;

select 'The website''s enrollment form now changes nothing already in The Current; the office''s Add pending student links forms as before. '
    || 'The test forms were taken back out: nothing was added.' as result;
