-- PRA Admin: enrollment forms (30 September 2026). Run once in Supabase >
-- SQL Editor, after updates-2026-09-30-leads.sql. Safe to run again.
--
-- The enrollment form on pra.edu.vn/admissions/enroll/ saves what a parent
-- sends straight into The Current, the same way the contact form does. The
-- website has no account. It may do two things and nothing else: put the
-- documents a parent attaches into a private folder (it cannot read them
-- back), and call one function, adm_enroll_submit.
--
-- Everything on the form is kept:
--
--   adm_enrollments          what the office works with: the student, parents,
--                            emergency contacts, pick-up list, education and
--                            health answers, photo consent. Office accounts.
--   adm_enrollment_private   ID / passport numbers, their issue dates and
--                            places, place of birth, the uploaded documents
--                            and the signature. Super admin only.
--   storage: adm-enrollment  the documents themselves (student photo, passport
--                            copies, last report). Super admin only.
--
-- When a form arrives the child is added to Students as a pending student with
-- a family, unless a student with the same birthday and first name is already
-- there (then the form is linked to that student and nothing is changed). A
-- family already on the Leads list with the same email is marked Enrolled.

-- 1. The form, less the private part.
create table if not exists adm_enrollments (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null unique,     -- the number the form page gave this form; its documents are filed under it
  source text not null default 'website' check (source in ('website', 'import')),
  lang text,                              -- which version of the site it was filled in on: 'en' | 'vi'
  submitted_at timestamptz,               -- when the parent sent it
  applying_for text,                      -- 'Academic Year 26-27'
  student_name text not null,
  first_name text,
  dob date,
  parent_name text,
  parent_email text,                      -- both parents' addresses, lower case: 'a@x.com, b@y.com'
  parent_phone text,
  photo_consent text check (photo_consent in ('total', 'private')),
  data jsonb not null default '{}'::jsonb,
  student_id uuid references adm_students(id) on delete set null,
  family_id uuid references adm_families(id) on delete set null,
  lead_id uuid references adm_leads(id) on delete set null,
  made_student boolean not null default false,  -- this form added the student (false: the child was already on the list)
  checked_at timestamptz,                 -- when someone in the office looked it over
  checked_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists adm_enrollments_student on adm_enrollments (student_id);

-- 2. The private part. One row per form.
create table if not exists adm_enrollment_private (
  enrollment_id uuid primary key references adm_enrollments(id) on delete cascade,
  ids jsonb not null default '{}'::jsonb,    -- { student: { place_of_birth, id_number }, parents: [{ name, id_number, issue_date, issue_place }] }
  files jsonb not null default '[]'::jsonb,  -- [{ path, name }] in the adm-enrollment folder
  signature text,                            -- the signature as drawn (a small picture)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. People change one thing on a form: whether it has been checked. The rest
--    is what the parent sent, and only the functions below write it.
create or replace function adm_enrollments_stamp() returns trigger
language plpgsql as $$
declare
  v_at timestamptz := new.checked_at;
begin
  if coalesce(current_setting('adm.enrollment_save', true), '') <> '1' then
    new := old;
    if v_at is null then
      new.checked_at := null;
      new.checked_by := null;
    elsif old.checked_at is null then
      new.checked_at := v_at;
      new.checked_by := nullif(adm_email(), '');
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists adm_enrollments_stamp on adm_enrollments;
create trigger adm_enrollments_stamp before update on adm_enrollments
  for each row execute function adm_enrollments_stamp();

alter table adm_enrollments enable row level security;
alter table adm_enrollment_private enable row level security;
revoke all on adm_enrollments from anon;
revoke all on adm_enrollment_private from anon;

drop policy if exists office_read on adm_enrollments;
create policy office_read on adm_enrollments for select to authenticated
  using (adm_is_staff());

drop policy if exists office_check on adm_enrollments;
create policy office_check on adm_enrollments for update to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists super_delete on adm_enrollments;
create policy super_delete on adm_enrollments for delete to authenticated
  using (adm_role() = 'super_admin');

drop policy if exists super_read on adm_enrollment_private;
create policy super_read on adm_enrollment_private for select to authenticated
  using (adm_role() = 'super_admin');

-- 4. The documents. A private folder: nothing in it has a public link. The
--    website may add a file to a form that has not been sent yet, under that
--    form's number, and cannot read, replace or remove anything. The super
--    admin opens a file through a short-lived link, and may remove it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-enrollment', 'adm-enrollment', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- '<form number>/<n>-<file name>', at most 12 files a form, and a ceiling of
-- 300 files an hour for the whole site so the folder cannot be flooded.
create or replace function adm_enroll_upload_ok(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,2}-[A-Za-z0-9._-]{1,80}$'
     and not exists (select 1 from adm_enrollments e where e.submission_id = split_part(p_name, '/', 1))
     and (select count(*) from storage.objects o where o.bucket_id = 'adm-enrollment' and o.name like split_part(p_name, '/', 1) || '/%') < 12
     and (select count(*) from storage.objects o where o.bucket_id = 'adm-enrollment' and o.created_at > now() - interval '1 hour') < 300
$$;

drop policy if exists adm_enrollment_upload on storage.objects;
create policy adm_enrollment_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'adm-enrollment' and adm_enroll_upload_ok(name));

drop policy if exists adm_enrollment_open on storage.objects;
create policy adm_enrollment_open on storage.objects for select to authenticated
  using (bucket_id = 'adm-enrollment' and adm_role() = 'super_admin');

drop policy if exists adm_enrollment_remove on storage.objects;
create policy adm_enrollment_remove on storage.objects for delete to authenticated
  using (bucket_id = 'adm-enrollment' and adm_role() = 'super_admin');

-- 5. Small helpers.

-- 'Bảo Châu ' -> 'bao chau': for comparing names typed with and without accents.
create or replace function adm_fold(t text) returns text
language sql immutable as $$
  select lower(trim(regexp_replace(translate(regexp_replace(normalize(coalesce(t, ''), NFD), '[̀-ͯ]', '', 'g'), 'đĐ', 'dd'), '\s+', ' ', 'g')))
$$;

-- A date from text, or nothing when the text is not a date.
create or replace function adm_try_date(t text) returns date
language plpgsql immutable as $$
begin
  return nullif(trim(t), '')::date;
exception when others then
  return null;
end $$;

-- One answer from the form as a single line of text, cut to a sensible length.
create or replace function adm_txt(j jsonb, k text, n int) returns text
language sql immutable as $$
  select left(regexp_replace(trim(coalesce(j->>k, '')), '\s+', ' ', 'g'), n)
$$;

-- A longer answer (an explanation): line breaks kept.
create or replace function adm_long(j jsonb, k text) returns text
language sql immutable as $$
  select left(trim(coalesce(j->>k, '')), 2000)
$$;

create or replace function adm_yes_no(j jsonb, k text) returns text
language sql immutable as $$
  select case lower(trim(coalesce(j->>k, ''))) when 'yes' then 'Yes' when 'no' then 'No' else '' end
$$;

-- '12 Trần Nhân Tông, Hội An, Việt Nam' from the address boxes.
create or replace function adm_addr(j jsonb) returns text
language sql immutable as $$
  select concat_ws(', ', nullif(adm_txt(j, 'line1', 160), ''), nullif(adm_txt(j, 'line2', 160), ''), nullif(adm_txt(j, 'city', 80), ''),
                   nullif(adm_txt(j, 'state', 80), ''), nullif(adm_txt(j, 'postal', 20), ''), nullif(adm_txt(j, 'country', 80), ''))
$$;

-- "Minh Anh" + "Nguyễn" -> "Nguyễn Minh Anh"; "Emma" + "Clarke" -> "Emma Clarke".
-- A Vietnamese family name goes first (the list in src/lib/families.js).
create or replace function adm_full_name(p_first text, p_last text) returns text
language sql immutable as $$
  select trim(case
    when split_part(adm_fold(p_last), ' ', 1) = any (array['nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang', 'bui', 'do', 'ho', 'ngo',
                                                           'duong', 'ly', 'dinh', 'trinh', 'mai', 'ta', 'lai', 'luu', 'luong', 'cao', 'doan', 'vuong', 'truong'])
      then coalesce(p_last, '') || ' ' || coalesce(p_first, '')
    else coalesce(p_first, '') || ' ' || coalesce(p_last, '') end)
$$;

-- The class for a birthday, as src/lib/placement.js works it out: a year takes
-- children born 1 September to 31 August, and Year 1 in 2026-2027 was born
-- September 2020 to August 2021.
create or replace function adm_level_for_birthday(d date, start_year int) returns text
language sql immutable as $$
  select case
    when d is null then null
    when r <= -1 then 'Nursery'
    when r = 0 then 'Kindergarten'
    when r >= 9 then 'Upper Secondary'
    else 'Year ' || r end
  from (select start_year - (extract(year from d)::int + case when extract(month from d) >= 9 then 1 else 0 end) - 4 as r) x
$$;

-- 6. Links a saved form to its student, family and lead. With p_create, a
--    child who is not on the list yet is added as a pending student.
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
  v_emails := coalesce(array(select distinct x from regexp_split_to_table(lower(coalesce(r.parent_email, '')), '[\s;,]+') x where x like '%@%'), '{}');
  v_student := r.student_id;
  v_family := r.family_id;
  v_lead := r.lead_id;
  v_received := (coalesce(r.submitted_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date;

  -- The same child: the same birthday, and every word of the first name somewhere in the name we have.
  if v_student is null and r.dob is not null then
    select st.id, st.family_id into v_student, v_family from adm_students st
     where st.dob = r.dob
       and not exists (
         select 1 from regexp_split_to_table(v_first, ' ') tok
          where tok <> ''
            and position(' ' || tok || ' ' in ' ' || adm_fold(st.full_name || ' ' || coalesce(st.first_name, '') || ' ' || coalesce(st.nickname, '')) || ' ') = 0)
     order by (coalesce(st.status, 'active') = 'inactive'), st.created_at
     limit 1;
  end if;

  if v_student is null and p_create then
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
    insert into adm_students (family_id, full_name, first_name, level, program, is_new, q4_full, status, active, dob, nationality, gender,
                              parents_email, parent_phone, address, allergies, start_date, notes)
    values (v_family, r.student_name, r.first_name, coalesce(adm_level_for_birthday(r.dob, v_start), 'Year 1'), 'regular', true, true, 'pending', false,
            r.dob, nullif(s->>'nationality', ''),
            case when lower(coalesce(s->>'gender', '')) in ('male', 'female') then lower(s->>'gender') end,
            nullif(array_to_string(v_emails, ', '), ''), r.parent_phone, nullif(s->>'address', ''),
            nullif(r.data->'health'->>'allergies', ''), adm_try_date(s->>'start_date'), v_notes)
    returning id into v_student;
    v_made := true;
  end if;

  -- The family on the Leads list, by either parent's email. A form that has just come in means they are enrolling.
  if v_lead is null and cardinality(v_emails) > 0 then
    select l.id into v_lead from adm_leads l
     where exists (select 1 from unnest(v_emails) em where em = any (regexp_split_to_array(coalesce(l.email, ''), '[\s;,]+')))
     order by l.archived, l.created_at
     limit 1;
    if v_lead is not null and p_create and r.source <> 'import' then
      update adm_leads set stage = 'enrolled', archived = false, updated_by = 'enrollment form'
       where id = v_lead and (stage <> 'enrolled' or archived);
    end if;
  end if;

  update adm_enrollments
     set student_id = v_student, family_id = v_family, lead_id = v_lead, made_student = made_student or v_made
   where id = p_id;
end $$;

-- 7. Saves one form that is already in The Current's shape:
--      submission_id, source, lang, submitted_at, applying_for, photo_consent, link_only,
--      student {first_name, full_name, dob, gender, nationality, languages, address, start_date},
--      parents [{name, relation, nationality, language, profession, address, phone, email}],
--      emergency [...], pickup [...], schools [...], school_language, background {...}, health {...}, terms,
--      private {ids {...}, files [...], signature}
--    With link_only a child who is not on the list is left off it (old forms).
--    Nobody calls this directly; adm_enroll_submit and adm_enrollment_import do.
create or replace function adm_enrollment_save(e jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sub text := nullif(trim(e->>'submission_id'), '');
  s jsonb := coalesce(e->'student', '{}'::jsonb);
  ps jsonb := case when jsonb_typeof(e->'parents') = 'array' then e->'parents' else '[]'::jsonb end;
  pr jsonb := coalesce(e->'private', '{}'::jsonb);
  v_name text := nullif(regexp_replace(trim(coalesce(s->>'full_name', '')), '\s+', ' ', 'g'), '');
  v_emails text;
  v_at timestamptz;
  v_id uuid;
begin
  if v_sub is null or v_name is null then
    raise exception 'An enrollment form needs its number and the student''s name.' using errcode = '22023';
  end if;
  perform set_config('adm.enrollment_save', '1', true);

  begin
    v_at := nullif(trim(e->>'submitted_at'), '')::timestamptz;
  exception when others then
    v_at := null;
  end;
  select string_agg(distinct em, ', ') into v_emails
    from (select lower(trim(p->>'email')) em from jsonb_array_elements(ps) p) x
   where em like '%@%';

  insert into adm_enrollments (submission_id, source, lang, submitted_at, applying_for, student_name, first_name, dob,
                               parent_name, parent_email, parent_phone, photo_consent, data)
  values (v_sub, case when e->>'source' = 'import' then 'import' else 'website' end,
          case when e->>'lang' in ('en', 'vi') then e->>'lang' end, coalesce(v_at, now()),
          nullif(e->>'applying_for', ''), v_name, nullif(trim(s->>'first_name'), ''), adm_try_date(s->>'dob'),
          nullif(ps->0->>'name', ''), v_emails, nullif(ps->0->>'phone', ''),
          case when e->>'photo_consent' in ('total', 'private') then e->>'photo_consent' end,
          e - 'private' - 'link_only')
  on conflict (submission_id) do update
    set applying_for = excluded.applying_for, student_name = excluded.student_name,
        first_name = excluded.first_name, dob = excluded.dob, parent_name = excluded.parent_name,
        parent_email = excluded.parent_email, parent_phone = excluded.parent_phone,
        photo_consent = excluded.photo_consent, data = excluded.data,
        submitted_at = coalesce(v_at, adm_enrollments.submitted_at)
  returning id into v_id;

  insert into adm_enrollment_private (enrollment_id, ids, files, signature)
  values (v_id, coalesce(pr->'ids', '{}'::jsonb),
          case when jsonb_typeof(pr->'files') = 'array' then pr->'files' else '[]'::jsonb end,
          nullif(pr->>'signature', ''))
  on conflict (enrollment_id) do update
    set ids = excluded.ids, files = excluded.files, signature = excluded.signature, updated_at = now();

  perform adm_enrollment_place(v_id, not coalesce((e->>'link_only')::boolean, false));
  return v_id;
end $$;

-- 8. The one thing the website may call. `p` is the form as the page sends it;
--    every answer is read, trimmed and cut to length here, and anything the
--    page did not ask for is dropped. It answers with nothing either way.
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
    select ord, jsonb_build_object('name', adm_txt(c, 'name', 200), 'years', adm_txt(c, 'years', 200)) o
    from jsonb_array_elements(case when jsonb_typeof(p->'schools') = 'array' then p->'schools' else '[]'::jsonb end) with ordinality t(c, ord)
    where ord <= 3) x
  where o->>'name' <> '' or o->>'years' <> '';

  -- Only documents that are really in this form's folder are listed.
  select coalesce(jsonb_agg(jsonb_build_object('path', f->>'path', 'name', adm_txt(f, 'name', 120)) order by ord), '[]'::jsonb) into v_files
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

-- 9. Old forms (from before the website form) are brought in by the super
--    admin, and the office may add the student for a form that has none.
create or replace function adm_enrollment_import(e jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if adm_role() <> 'super_admin' then
    raise exception 'Only the super admin can bring enrollment forms in.' using errcode = '42501';
  end if;
  return adm_enrollment_save(e || '{"source": "import"}'::jsonb);
end $$;

create or replace function adm_enrollment_make_student(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
begin
  if not adm_is_staff() then
    raise exception 'Only office accounts can add a student from an enrollment form.' using errcode = '42501';
  end if;
  perform adm_enrollment_place(p_id, true);
  select student_id into v_student from adm_enrollments where id = p_id;
  return v_student;
end $$;

-- 10. Who may call what.
revoke all on function adm_enrollment_place(uuid, boolean) from public, anon, authenticated;
revoke all on function adm_enrollment_save(jsonb) from public, anon, authenticated;
revoke all on function adm_enrollment_import(jsonb) from public, anon;
revoke all on function adm_enrollment_make_student(uuid) from public, anon;
revoke all on function adm_enroll_submit(jsonb) from public;
grant execute on function adm_enroll_upload_ok(text) to anon, authenticated;
grant execute on function adm_enroll_submit(jsonb) to anon, authenticated;
grant execute on function adm_enrollment_import(jsonb) to authenticated;
grant execute on function adm_enrollment_make_student(uuid) to authenticated;

notify pgrst, 'reload schema';
