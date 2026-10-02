-- PRA Admin: the enrollment form's previous schools and documents (1 October
-- 2026). Run once in Supabase > SQL Editor, after
-- updates-2026-10-01-enrollment-fix.sql. Safe to run again.
--
-- Two changes to the form on pra.edu.vn/admissions/enroll/, asked for by Yvonne:
--   - each previous school has its own years attended, grade levels and
--     language of instruction (there was one "years and grade levels" box per
--     school and one language question for all of them);
--   - each document is its own question (student photo, the student's passport
--     or ID card, the parents' passports or ID cards, the latest academic
--     report), so every file says which question it answers.
--
-- Only the function the website calls changes: it now keeps the new answers.
-- No table changes. The form as it is on the website today keeps working with
-- this function, so run this first and push the website after.
-- (updates-2026-09-30-enrollments.sql holds the same function, for a new setup.)

create or replace function adm_enroll_submit(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub text := lower(trim(coalesce(p->>'submission_id', '')));
  s jsonb := coalesce(p->'student', '{}'::jsonb);
  ps jsonb := case when jsonb_typeof(p->'parents') = 'array' then p->'parents' else '[]'::jsonb end;
  bg jsonb := coalesce(p->'background', '{}'::jsonb);
  h jsonb := coalesce(p->'health', '{}'::jsonb);
  v_first text := adm_txt(s, 'first', 80);
  v_last text := adm_txt(s, 'last', 80);
  v_dob date := adm_try_date(s->>'dob');
  v_email text := lower(adm_txt(coalesce(ps->0, '{}'::jsonb), 'email', 200));
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_addr text := adm_addr(s->'address');
  v_gender text := lower(trim(coalesce(s->>'gender', '')));
  v_sig text := p->>'signature';
  v_parents jsonb;
  v_parent_ids jsonb;
  v_emergency jsonb;
  v_pickup jsonb;
  v_schools jsonb;
  v_files jsonb;
begin
  -- A box on the form that people never see. Anything typed in it came from a
  -- robot: keep nothing, and do not say so.
  if coalesce(p->>'website', '') <> '' then return; end if;

  if v_sub !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_first = '' or v_dob is null or v_dob > v_today or v_dob < v_today - 9500
     or length(v_email) > 200 or v_email !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$'
     or lower(coalesce(p->>'terms', '')) not in ('true', 'yes', 'on') then
    raise exception 'The form needs the student''s name and date of birth, a parent''s email address, and the agreement to the contract.' using errcode = '22023';
  end if;

  -- Sent twice (a second tap, or a retry after a weak signal): the first one stands.
  if exists (select 1 from adm_enrollments where submission_id = v_sub) then return; end if;

  -- A flood is refused; the page then tells the parent to email or call.
  if (select count(*) from adm_enrollments en where en.source = 'website' and en.created_at > now() - interval '1 hour'
        and v_email = any (regexp_split_to_array(coalesce(en.parent_email, ''), '[\s;,]+'))) >= 6
     or (select count(*) from adm_enrollments en where en.source = 'website' and en.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many forms just now.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(o order by ord), '[]'::jsonb) into v_parents from (
    select ord, jsonb_build_object(
      'name', adm_full_name(adm_txt(par, 'first', 80), adm_txt(par, 'last', 80)),
      'relation', adm_txt(par, 'relation', 60),
      'nationality', adm_txt(par, 'nationality', 60),
      'language', case when lower(coalesce(par->>'language', '')) like 'viet%' then 'Vietnamese'
                       when lower(coalesce(par->>'language', '')) like 'eng%' then 'English' else '' end,
      'profession', adm_txt(par, 'profession', 100),
      'address', case when lower(coalesce(par->>'same_address', '')) in ('true', 'yes', 'on') then v_addr else adm_addr(par->'address') end,
      'phone', adm_txt(par, 'phone', 40),
      'email', lower(adm_txt(par, 'email', 200))) o
    from jsonb_array_elements(ps) with ordinality t(par, ord)
    where ord <= 2) x
  where o->>'name' <> '' or o->>'email' <> '' or o->>'phone' <> '';

  select coalesce(jsonb_agg(o order by ord), '[]'::jsonb) into v_parent_ids from (
    select ord, jsonb_build_object(
      'name', adm_full_name(adm_txt(par, 'first', 80), adm_txt(par, 'last', 80)),
      'id_number', adm_txt(par, 'id_number', 60),
      'issue_date', coalesce(adm_try_date(par->>'issue_date')::text, ''),
      'issue_place', adm_txt(par, 'issue_place', 100)) o
    from jsonb_array_elements(ps) with ordinality t(par, ord)
    where ord <= 2) x
  where o->>'id_number' <> '' or o->>'issue_date' <> '' or o->>'issue_place' <> '';

  select coalesce(jsonb_agg(o order by ord), '[]'::jsonb) into v_emergency from (
    select ord, jsonb_build_object(
      'name', adm_full_name(adm_txt(c, 'first', 80), adm_txt(c, 'last', 80)), 'relation', adm_txt(c, 'relation', 60),
      'phone', adm_txt(c, 'phone', 40), 'email', lower(adm_txt(c, 'email', 200))) o
    from jsonb_array_elements(case when jsonb_typeof(p->'emergency') = 'array' then p->'emergency' else '[]'::jsonb end) with ordinality t(c, ord)
    where ord <= 2) x
  where o->>'name' <> '' or o->>'phone' <> '' or o->>'email' <> '';

  select coalesce(jsonb_agg(o order by ord), '[]'::jsonb) into v_pickup from (
    select ord, jsonb_build_object(
      'name', adm_full_name(adm_txt(c, 'first', 80), adm_txt(c, 'last', 80)), 'relation', adm_txt(c, 'relation', 60),
      'phone', adm_txt(c, 'phone', 40)) o
    from jsonb_array_elements(case when jsonb_typeof(p->'pickup') = 'array' then p->'pickup' else '[]'::jsonb end) with ordinality t(c, ord)
    where ord <= 3) x
  where o->>'name' <> '' or o->>'phone' <> '';

  select coalesce(jsonb_agg(o order by ord), '[]'::jsonb) into v_schools from (
    select ord, jsonb_build_object('name', adm_txt(c, 'name', 200), 'years', adm_txt(c, 'years', 200),
                                   'grades', adm_txt(c, 'grades', 200), 'language', adm_txt(c, 'language', 160)) o
    from jsonb_array_elements(case when jsonb_typeof(p->'schools') = 'array' then p->'schools' else '[]'::jsonb end) with ordinality t(c, ord)
    where ord <= 3) x
  where o->>'name' <> '' or o->>'years' <> '' or o->>'grades' <> '' or o->>'language' <> '';

  -- Only documents that are really in this form's folder are listed. `kind` is
  -- the question a document answers on the form.
  select coalesce(jsonb_agg(jsonb_build_object('path', f->>'path', 'name', adm_txt(f, 'name', 120),
                                               'kind', case when f->>'kind' in ('photo', 'student_id', 'parent_id', 'report') then f->>'kind' else '' end)
                            order by ord), '[]'::jsonb) into v_files
    from jsonb_array_elements(case when jsonb_typeof(p->'files') = 'array' then p->'files' else '[]'::jsonb end) with ordinality t(f, ord)
   where ord <= 12 and (f->>'path') like v_sub || '/%'
     and exists (select 1 from storage.objects o where o.bucket_id = 'adm-enrollment' and o.name = f->>'path');

  perform adm_enrollment_save(jsonb_build_object(
    'submission_id', v_sub,
    'source', 'website',
    'lang', case when p->>'lang' = 'vi' then 'vi' else 'en' end,
    'applying_for', adm_txt(p, 'applying_for', 80),
    'photo_consent', case when p->>'photo_consent' in ('total', 'private') then p->>'photo_consent' else '' end,
    'student', jsonb_build_object(
      'first_name', v_first,
      'full_name', adm_full_name(v_first, v_last),
      'dob', v_dob::text,
      'gender', case v_gender when 'male' then 'Male' when 'female' then 'Female'
                              when 'other' then coalesce(nullif(adm_txt(s, 'gender_other', 60), ''), 'Other') else '' end,
      'nationality', adm_txt(s, 'nationality', 60),
      'languages', adm_txt(s, 'languages', 160),
      'address', v_addr,
      'start_date', coalesce(adm_try_date(s->>'start_date')::text, '')),
    'parents', v_parents,
    'emergency', v_emergency,
    'pickup', v_pickup,
    'schools', v_schools,
    'school_language', adm_txt(p, 'school_language', 160),
    'background', jsonb_build_object(
      'repeated', adm_yes_no(bg, 'repeated'), 'academic', adm_yes_no(bg, 'academic'), 'behavioral', adm_yes_no(bg, 'behavioral'),
      'developmental', adm_yes_no(bg, 'developmental'), 'disciplinary', adm_yes_no(bg, 'disciplinary'), 'explain', adm_long(bg, 'explain')),
    'health', jsonb_build_object(
      'surgery', adm_yes_no(h, 'surgery'), 'physician', adm_yes_no(h, 'physician'), 'emotional', adm_yes_no(h, 'emotional'),
      'exercise', adm_yes_no(h, 'exercise'), 'glasses', adm_yes_no(h, 'glasses'), 'dental', adm_yes_no(h, 'dental'),
      'explain', adm_long(h, 'explain'),
      'allergy_medication', adm_yes_no(h, 'allergy_medication'), 'allergy_food', adm_yes_no(h, 'allergy_food'),
      'dietary', adm_yes_no(h, 'dietary'), 'allergies', adm_long(h, 'allergies')),
    'terms', 'Accepted',
    'private', jsonb_build_object(
      'ids', jsonb_build_object(
        'student', jsonb_build_object('place_of_birth', adm_txt(s, 'place_of_birth', 100), 'id_number', adm_txt(s, 'id_number', 60)),
        'parents', v_parent_ids),
      'files', v_files,
      'signature', case when v_sig like 'data:image/png;base64,%' and length(v_sig) <= 400000 then v_sig else '' end)));
end $$;

revoke all on function adm_enroll_submit(jsonb) from public;
grant execute on function adm_enroll_submit(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

-- The test: one made-up form goes through and is taken back out, so nothing is
-- left on the Enrollments or Students pages. If the new answers are not kept,
-- this file fails with the reason in red.
do $$
declare
  d jsonb;
begin
  perform adm_enroll_submit('{
    "submission_id": "00000000-0000-4000-8000-00000000c0de",
    "lang": "en", "website": "", "applying_for": "Academic Year 26-27", "photo_consent": "private", "terms": true,
    "student": {"first": "Zzselftest", "last": "Zzform", "dob": "2019-02-03", "gender": "female",
                "address": {"line1": "1 Test Road", "city": "Hoi An", "country": "Vietnam"}},
    "parents": [{"first": "Zzparent", "last": "Zzform", "language": "English", "same_address": true,
                 "phone": "+84 000 000 000", "email": "selftest@enroll-selftest.invalid"}],
    "schools": [{"name": "Test School, Da Nang", "years": "2023 to 2025", "grades": "Grade 1 to Grade 2", "language": "Vietnamese"},
                {"name": "", "years": "", "grades": "", "language": ""}],
    "files": []
  }'::jsonb);
  select data into d from adm_enrollments where submission_id = '00000000-0000-4000-8000-00000000c0de';
  if d is null then
    raise exception 'the test form was accepted but not saved';
  end if;
  if jsonb_array_length(d->'schools') <> 1 or d->'schools'->0->>'grades' <> 'Grade 1 to Grade 2'
     or d->'schools'->0->>'language' <> 'Vietnamese' or d->'schools'->0->>'years' <> '2023 to 2025' then
    raise exception 'the previous school was not kept as sent: %', d->'schools';
  end if;
  raise exception 'PRA_ENROLL_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_ENROLL_TEST_OK' then
    raise exception 'The enrollment form cannot be saved: %', sqlerrm;
  end if;
end $$;

select 'The enrollment form keeps the new school and document answers. The test form was taken back out: nothing was added.' as result;
