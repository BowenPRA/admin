-- PRA Admin: emails The Current sends by itself (22 October 2026). Run once in
-- Supabase > SQL Editor, after the earlier update files. Safe to run again.
--
-- 1. Website forms (To-Do #75, Yvonne). When a family sends the enrollment form
--    or the contact / book-a-tour form on pra.edu.vn, the family gets a short
--    thank-you email (in the language they used, then the other one) and the
--    office gets an alert (Yvonne and admin@). The office edits the thank-you
--    wording in The Current (Office > Emails).
-- 2. Scheduled newsletters. Anyone in the office can schedule an issue for a day
--    and time; Seth or Bowen approves it (their own scheduling counts as the
--    approval). Ten minutes before the time its page goes on pra.edu.vn; at the
--    time the email goes to the edition's parent group and allstaff@.
--
-- Nothing in the database sends mail. Emails wait in adm_mail_queue (the
-- outbox). A small Google Apps Script in the admin@ account
-- (scripts/mailer/the-current-mailer.gs) asks every five minutes what is due,
-- sends it from admin@ and says how it went. The script has no account: it
-- calls four functions with its own key (adm_mailer_key, made by this file),
-- and that key can only read and report on the outbox.
--
-- After running: copy the key from the result at the bottom into the script
-- (scripts/mailer/README.md).

-- ---------------- 1. The outbox ----------------
create table if not exists adm_mail_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('enroll_family', 'enroll_office', 'web_family', 'web_office', 'newsletter', 'notice', 'test')),
  ref_id uuid,                              -- the enrollment form, website message or newsletter issue it is about
  to_addr text not null default '',         -- 'a@x.com, b@y.com'
  cc_addr text not null default '',
  bcc_addr text not null default '',
  subject text not null default '',
  body text not null default '',            -- plain text
  html text not null default '',
  attachments jsonb not null default '[]'::jsonb,  -- [{ url, name }]: public files the script attaches
  lang text,
  send_at timestamptz not null default now(),
  status text not null default 'ready'
    check (status in ('waiting', 'ready', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
    -- waiting: a newsletter waiting for Seth or Bowen; ready: goes at send_at;
    -- sending: the script has it now; skipped: never sent, on purpose (see error)
  extra jsonb not null default '{}'::jsonb, -- newsletter: { edition, label, page, pending, round, print, published_at, build }
  requested_by text,
  requested_at timestamptz default now(),
  approved_by text,
  approved_at timestamptz,
  cancelled_by text,
  cancelled_at timestamptz,
  tries int not null default 0,
  next_try_at timestamptz,                  -- after a failed try
  claimed_at timestamptz,
  sent_at timestamptz,
  message_id text,                          -- the Gmail message in admin@ Sent
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- 'test' (a scheduled newsletter sent to one person before it is approved) came
-- later the same day: a table made by an earlier run gets the wider check here.
alter table adm_mail_queue drop constraint if exists adm_mail_queue_kind_check;
alter table adm_mail_queue add constraint adm_mail_queue_kind_check
  check (kind in ('enroll_family', 'enroll_office', 'web_family', 'web_office', 'newsletter', 'notice', 'test'));
create index if not exists adm_mail_queue_due on adm_mail_queue (status, send_at);
create index if not exists adm_mail_queue_ref on adm_mail_queue (ref_id);
-- One live schedule per newsletter issue.
create unique index if not exists adm_mail_queue_one_newsletter on adm_mail_queue (ref_id)
  where kind = 'newsletter' and status in ('waiting', 'ready', 'sending');

create or replace function adm_mail_queue_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists adm_mail_queue_stamp on adm_mail_queue;
create trigger adm_mail_queue_stamp before update on adm_mail_queue
  for each row execute function adm_mail_queue_stamp();

-- ---------------- 2. The wording, and who gets the alerts ----------------
-- enroll_family, web_family: { on, subject: { en, vi }, body: { en, vi } }
--   Spots in {braces} are filled in: see adm_mail_enrollment / adm_mail_web_message.
-- office: { on, to, approvers }: the form alerts go to `to`; newsletter approval
--   requests and newsletter failures go to `approvers`.
create table if not exists adm_mail_templates (
  key text primary key check (key in ('enroll_family', 'web_family', 'office')),
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz default now()
);

insert into adm_mail_templates (key, data) values
('enroll_family', jsonb_build_object(
  'on', true,
  'subject', jsonb_build_object(
    'en', 'Enrollment form received: {child}',
    'vi', 'PRA đã nhận được đơn đăng ký học của {child}'),
  'body', jsonb_build_object(
    'en', E'Dear {parent},\n\nThank you for sending the enrollment form for {child}. We received it on {date}.\n\nOur admissions team will read it and contact you about the next step.\n\nIf you have a question in the meantime, reply to this email or call us on 0968 49 42 45.\n\nThe Admissions Team\nPalm River Academy',
    'vi', E'Kính gửi ba mẹ của {child},\n\nCảm ơn ba mẹ đã gửi đơn đăng ký học cho {child}. PRA đã nhận được đơn vào {date}.\n\nBộ phận tuyển sinh sẽ xem đơn và liên hệ với ba mẹ về bước tiếp theo.\n\nNếu ba mẹ có câu hỏi, vui lòng trả lời email này hoặc gọi cho PRA theo số 0968 49 42 45.\n\nBộ phận tuyển sinh\nTrung tâm Anh ngữ Palm River Academy'))),
('web_family', jsonb_build_object(
  'on', true,
  'subject', jsonb_build_object(
    'en', 'We have your message',
    'vi', 'PRA đã nhận được tin nhắn của ba mẹ'),
  'body', jsonb_build_object(
    'en', E'Dear {name},\n\nThank you for contacting Palm River Academy. {request}\n\nSomeone from the office will reply by email or phone.\n\nIf it is urgent, call us on 0968 49 42 45.\n\nThe Admissions Team\nPalm River Academy',
    'vi', E'Kính gửi ba mẹ,\n\nCảm ơn ba mẹ đã liên hệ với Palm River Academy. {request}\n\nVăn phòng sẽ liên hệ lại với ba mẹ qua email hoặc điện thoại.\n\nNếu cần gấp, ba mẹ vui lòng gọi cho PRA theo số 0968 49 42 45.\n\nBộ phận tuyển sinh\nTrung tâm Anh ngữ Palm River Academy'))),
('office', jsonb_build_object(
  'on', true,
  'to', 'yvonne@pra.edu.vn, admin@palmriveracademy.edu.vn',
  'approvers', 'seth@pra.edu.vn, bowen@pra.edu.vn'))
on conflict (key) do nothing;

create or replace function adm_mail_templates_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  return new;
end $$;
drop trigger if exists adm_mail_templates_stamp on adm_mail_templates;
create trigger adm_mail_templates_stamp before update on adm_mail_templates
  for each row execute function adm_mail_templates_stamp();

-- ---------------- 3. The script's key ----------------
-- One row. Nobody can read it except in the SQL Editor. last_seen is when the
-- script last asked for work: The Current warns when that was long ago.
create table if not exists adm_mailer_key (
  id int primary key default 1 check (id = 1),
  key text not null,
  last_seen timestamptz,
  created_at timestamptz default now()
);
insert into adm_mailer_key (key)
values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- ---------------- 4. Who may do what ----------------
-- office (super_admin, head, admin, or a head teacher)  read the outbox and the wording; change the wording;
--                                                       schedule, cancel and retry
-- Seth and Bowen (head, super_admin)                    approve a newsletter
-- the script (its key)                                  read what is due; report what it sent
-- Nobody writes to the outbox directly: only through the functions below.
create or replace function adm_mail_approver() returns boolean
language sql stable as $$ select adm_role() in ('super_admin', 'head') $$;

alter table adm_mail_queue enable row level security;
alter table adm_mail_templates enable row level security;
alter table adm_mailer_key enable row level security;
revoke all on adm_mail_queue, adm_mail_templates, adm_mailer_key from anon;
revoke all on adm_mailer_key from authenticated;
revoke insert, update, delete on adm_mail_queue from authenticated;
revoke insert, delete on adm_mail_templates from authenticated;
-- From 30 October 2026 Supabase gives new tables to nobody by itself (supabase/README.md).
grant select on adm_mail_queue to authenticated;
grant select, update on adm_mail_templates to authenticated;
grant all on adm_mail_queue, adm_mail_templates, adm_mailer_key to service_role;

drop policy if exists office_read on adm_mail_queue;
create policy office_read on adm_mail_queue for select to authenticated
  using (adm_is_staff() or adm_newsletter_office());

drop policy if exists office_read on adm_mail_templates;
create policy office_read on adm_mail_templates for select to authenticated
  using (adm_is_staff() or adm_newsletter_office());
drop policy if exists office_change on adm_mail_templates;
create policy office_change on adm_mail_templates for update to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

-- ---------------- 5. Writing an email ----------------
create or replace function adm_mail_esc(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- Fills the {spots} from vars ({ "child": "Minh Anh" }). A spot not in vars stays as written.
create or replace function adm_mail_fill(t text, vars jsonb) returns text
language plpgsql immutable as $$
declare
  k text;
  v text;
  out text := coalesce(t, '');
begin
  for k, v in select key, value from jsonb_each_text(coalesce(vars, '{}'::jsonb)) loop
    out := replace(out, '{' || k || '}', coalesce(v, ''));
  end loop;
  return out;
end $$;

-- Plain text to HTML: a blank line starts a paragraph, a single line break stays,
-- web addresses become links.
create or replace function adm_mail_paras(t text) returns text
language plpgsql immutable as $$
declare
  p text;
  out text := '';
begin
  foreach p in array regexp_split_to_array(replace(coalesce(t, ''), E'\r', ''), E'\n[ \t]*\n') loop
    p := btrim(p, E' \t\n');
    continue when p = '';
    p := regexp_replace(adm_mail_esc(p), '(https?://[^[:space:]<>"]*[^[:space:]<>".,;:!?)])', '<a href="\1" style="color:#116DFF">\1</a>', 'g');
    out := out || '<p style="margin:0 0 14px">' || replace(p, E'\n', '<br>') || '</p>';
  end loop;
  return out;
end $$;

-- The page around an email: the logo, then the blocks (each already HTML), a line between them.
create or replace function adm_mail_page(blocks text[], langs text[] default null) returns text
language plpgsql immutable as $$
declare
  i int;
  inner_html text := '';
begin
  for i in 1 .. coalesce(array_length(blocks, 1), 0) loop
    if i > 1 then
      inner_html := inner_html || '<hr style="border:0;border-top:1px solid #D3E4FF;margin:26px 0">';
    end if;
    inner_html := inner_html || '<div' || coalesce(' lang="' || langs[i] || '"', '') || '>' || blocks[i] || '</div>';
  end loop;
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>'
    || '<body style="margin:0;padding:0;background:#ffffff">'
    || '<div style="max-width:560px;margin:0 auto;padding:24px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1B2A41">'
    || '<img src="https://pra.edu.vn/assets/img/logo.png" width="134" height="54" alt="Palm River Academy" style="display:block;width:134px;height:54px;border:0;margin:0 0 22px">'
    || inner_html || '</div></body></html>';
end $$;

-- 'Thursday 22 October 2026' / 'thứ Năm, 22/10/2026'
create or replace function adm_mail_day(d date, lang text default 'en') returns text
language sql immutable as $$
  select case
    when d is null then ''
    when lang = 'vi' then
      (array['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'])[extract(dow from d)::int + 1]
        || ', ' || extract(day from d)::int || '/' || extract(month from d)::int || '/' || extract(year from d)::int
    else
      (array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])[extract(dow from d)::int + 1]
        || ' ' || extract(day from d)::int || ' '
        || (array['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])[extract(month from d)::int]
        || ' ' || extract(year from d)::int
  end
$$;

-- 'Friday 23 October, 16:30' in Vietnam time (for the office and for Seth and Bowen).
create or replace function adm_mail_moment(t timestamptz) returns text
language sql stable as $$
  select regexp_replace(adm_mail_day((t at time zone 'Asia/Ho_Chi_Minh')::date, 'en'), ' [0-9]{4}$', '')
    || ', ' || to_char(t at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI')
$$;

-- 'Hien' from 'hien.c@pra.edu.vn': the teacher's name if we have it.
create or replace function adm_mail_who(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(t.name), '') from adm_teachers t where lower(t.email) = lower(p_email) limit 1),
    initcap(split_part(split_part(coalesce(p_email, ''), '@', 1), '.', 1)),
    'Someone')
$$;

create or replace function adm_mail_template(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from adm_mail_templates where key = p_key), '{}'::jsonb)
$$;

-- The family's email in their language first, then the other one.
create or replace function adm_mail_family(p_tpl jsonb, p_lang text, p_vars jsonb, p_vars_vi jsonb,
  out subject text, out body text, out html text)
language plpgsql stable as $$
declare
  first_l text := case when p_lang = 'vi' then 'vi' else 'en' end;
  second_l text := case when p_lang = 'vi' then 'en' else 'vi' end;
  t1 text;
  t2 text;
begin
  subject := btrim(adm_mail_fill(p_tpl -> 'subject' ->> first_l, case when first_l = 'vi' then p_vars_vi else p_vars end));
  t1 := btrim(adm_mail_fill(p_tpl -> 'body' ->> first_l, case when first_l = 'vi' then p_vars_vi else p_vars end), E' \n');
  t2 := btrim(adm_mail_fill(p_tpl -> 'body' ->> second_l, case when second_l = 'vi' then p_vars_vi else p_vars end), E' \n');
  if coalesce(t2, '') = '' then
    body := t1;
    html := adm_mail_page(array[adm_mail_paras(t1)], array[first_l]);
  else
    body := t1 || E'\n\n------\n\n' || t2;
    html := adm_mail_page(array[adm_mail_paras(t1), adm_mail_paras(t2)], array[first_l, second_l]);
  end if;
end $$;

-- The office's short email (always English): lines of text, then the link.
create or replace function adm_mail_office_page(p_text text) returns text
language sql immutable as $$
  select adm_mail_page(array[adm_mail_paras(p_text)], array['en'])
$$;

-- One thank-you per address per day. The contact form takes 5 messages an hour
-- from one address, so without this someone could send a stranger thank-you
-- after thank-you by typing the stranger's address in.

-- 'A@x.com, b@y.com ' -> {a@x.com,b@y.com}, in order, each once.
create or replace function adm_mail_addrs(t text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(a order by n), '{}')
    from (select distinct on (lower(btrim(x))) lower(btrim(x)) as a, n
            from unnest(string_to_array(coalesce(t, ''), ',')) with ordinality as u(x, n)
           order by lower(btrim(x)), n) y
   where a like '%@%'
$$;

-- The addresses in p_to that were sent a thank-you in the last 24 hours (sent, or
-- on its way). For an enrollment form (p_child given), a thank-you for another
-- child's enrollment form does not count: siblings sent the same day each get one.
create or replace function adm_mail_recent(p_to text, p_child text default null) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct a), '{}')
    from adm_mail_queue q
    left join adm_enrollments e on q.kind = 'enroll_family' and e.id = q.ref_id
    cross join lateral unnest(adm_mail_addrs(q.to_addr)) as a
   where q.kind in ('enroll_family', 'web_family')
     and q.status in ('ready', 'sending', 'sent')
     and q.created_at > now() - interval '24 hours'
     and a = any(adm_mail_addrs(p_to))
     and not (p_child is not null and q.kind = 'enroll_family'
              and lower(btrim(coalesce(e.student_name, ''))) <> lower(btrim(p_child)))
$$;

-- p_to without the addresses in p_skip, as 'a@x.com, b@y.com'.
create or replace function adm_mail_minus(p_to text, p_skip text[]) returns text
language sql immutable as $$
  select array_to_string(array(select a from unnest(adm_mail_addrs(p_to)) with ordinality as u(a, n)
                                where a <> all(coalesce(p_skip, '{}')) order by n), ', ')
$$;

-- ---------------- 6. The enrollment form ----------------
-- Called once for each form sent from the website (the trigger below runs when
-- the form is saved, after the child is placed). Does nothing the second time.
create or replace function adm_mail_enrollment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  f adm_enrollments;
  tpl jsonb := adm_mail_template('enroll_family');
  office jsonb := adm_mail_template('office');
  m record;
  lang text;
  vars jsonb;
  vars_vi jsonb;
  family_line text;
  place text;
  dob_line text;
  send_to text;
begin
  select * into f from adm_enrollments where id = p_id;
  if not found or f.source <> 'website' then return; end if;
  -- Only forms sent after this file first ran (when the key was made): nothing from before, ever.
  -- (By the time the database received it: a parent's device clock can be wrong.)
  if coalesce(f.created_at, f.submitted_at, now()) < (select created_at from adm_mailer_key where id = 1) then return; end if;
  if exists (select 1 from adm_mail_queue where ref_id = p_id and kind in ('enroll_family', 'enroll_office')) then return; end if;
  lang := case when f.lang = 'vi' then 'vi' else 'en' end;

  vars := jsonb_build_object(
    'parent', coalesce(nullif(trim(f.parent_name), ''), 'parents'),
    'child', f.student_name,
    'first_name', coalesce(nullif(trim(f.first_name), ''), f.student_name),
    'date', adm_mail_day((coalesce(f.submitted_at, f.created_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date, 'en'),
    'applying_for', coalesce(f.applying_for, ''));
  vars_vi := vars || jsonb_build_object(
    'parent', coalesce(nullif(trim(f.parent_name), ''), 'ba mẹ'),
    'date', adm_mail_day((coalesce(f.submitted_at, f.created_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date, 'vi'));

  -- The family.
  if coalesce((tpl ->> 'on')::boolean, false) is false then
    insert into adm_mail_queue (kind, ref_id, to_addr, lang, status, error)
    values ('enroll_family', p_id, coalesce(f.parent_email, ''), lang, 'skipped', 'Thank-you emails were switched off.');
    family_line := 'not sent (thank-you emails are switched off)';
  elsif coalesce(f.parent_email, '') !~ '@' then
    insert into adm_mail_queue (kind, ref_id, lang, status, error)
    values ('enroll_family', p_id, lang, 'skipped', 'No email address on the form.');
    family_line := 'not sent (no email address on the form)';
  else
    send_to := adm_mail_minus(f.parent_email, adm_mail_recent(f.parent_email, f.student_name));
    if send_to = '' then
      insert into adm_mail_queue (kind, ref_id, to_addr, lang, status, error)
      values ('enroll_family', p_id, f.parent_email, lang, 'skipped', 'A thank-you already went to this address in the last 24 hours.');
      family_line := 'not sent (a thank-you already went to this address in the last 24 hours)';
    else
      select * into m from adm_mail_family(tpl, lang, vars, vars_vi);
      insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang)
      values ('enroll_family', p_id, send_to, m.subject, m.body, m.html, lang);
      family_line := 'going to ' || send_to;
    end if;
  end if;

  -- The office.
  if coalesce((office ->> 'on')::boolean, false) and coalesce(office ->> 'to', '') ~ '@' then
    place := case
      when f.made_student then 'added as a pending student'
      when f.student_id is not null then 'matched to a child already on the student list'
      else 'not linked to a student yet' end;
    dob_line := case when f.dob is null then '' else ', born ' || adm_mail_day(f.dob, 'en') end;
    insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang)
    select 'enroll_office', p_id, office ->> 'to', x.subject, x.body, adm_mail_office_page(x.body), 'en'
      from (select
        'New enrollment form: ' || f.student_name || coalesce(' (' || nullif(f.applying_for, '') || ')', '') as subject,
        concat_ws(E'\n',
          'A family has sent the enrollment form on pra.edu.vn.',
          '',
          'Child: ' || f.student_name || dob_line,
          'Applying for: ' || coalesce(nullif(f.applying_for, ''), '(not given)'),
          'Parent: ' || coalesce(nullif(f.parent_name, ''), '(not given)'),
          'Email: ' || coalesce(nullif(f.parent_email, ''), '(none)'),
          'Phone: ' || coalesce(nullif(f.parent_phone, ''), '(none)'),
          'Filled in: ' || case when lang = 'vi' then 'in Vietnamese' else 'in English' end,
          'In The Current: ' || place,
          'Thank-you email to the family: ' || family_line,
          '',
          'Open the form in The Current:',
          'https://current.pra.edu.vn/#/enrollments?form=' || p_id) as body) x;
  end if;
end $$;

create or replace function adm_mail_on_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- An email problem must never stop a form from saving.
  begin
    perform adm_mail_enrollment(new.id);
  exception when others then
    raise warning 'adm_mail_on_enrollment %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
-- Deferred: it runs when the form's save is finished, so the child is placed by then.
drop trigger if exists adm_mail_on_enrollment on adm_enrollments;
create constraint trigger adm_mail_on_enrollment after insert on adm_enrollments
  deferrable initially deferred
  for each row when (new.source = 'website') execute function adm_mail_on_enrollment();

-- ---------------- 7. The contact / book-a-tour form ----------------
create or replace function adm_mail_web_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  w adm_web_messages;
  tpl jsonb := adm_mail_template('web_family');
  office jsonb := adm_mail_template('office');
  m record;
  lang text;
  day_en text;
  day_vi text;
  when_en text;
  when_vi text;
  req_en text;
  req_vi text;
  want_en text;
  family_line text;
  send_to text;
begin
  select * into w from adm_web_messages where id = p_id;
  if not found then return; end if;
  if coalesce(w.created_at, now()) < (select created_at from adm_mailer_key where id = 1) then return; end if;
  if exists (select 1 from adm_mail_queue where ref_id = p_id and kind in ('web_family', 'web_office')) then return; end if;
  lang := case when w.lang = 'vi' then 'vi' else 'en' end;
  send_to := adm_mail_minus(w.email, adm_mail_recent(w.email));

  -- 'Tuesday 27 October, in the morning' / 'thứ Ba, 27/10/2026, buổi sáng'
  day_en := regexp_replace(adm_mail_day(w.visit_date, 'en'), ' [0-9]{4}$', '');
  day_vi := adm_mail_day(w.visit_date, 'vi');
  when_en := nullif(concat_ws(', ', nullif(day_en, ''), case w.visit_time when 'morning' then 'in the morning' when 'afternoon' then 'in the afternoon' end), '');
  when_vi := nullif(concat_ws(', ', nullif(day_vi, ''), case w.visit_time when 'morning' then 'buổi sáng' when 'afternoon' then 'buổi chiều' end), '');
  req_en := case w.want
    when 'tour' then case when when_en is null then 'You asked for a campus tour. We will contact you to agree a day and time.'
                     else 'You asked for a campus tour on ' || when_en || '. We will confirm the day and time with you.' end
    when 'call' then case when when_en is null then 'You asked for a video call. We will contact you to agree a day and time.'
                     else 'You asked for a video call on ' || when_en || '. We will confirm the day and time with you.' end
    when 'global' then 'You asked about the Global Program.'
    else '' end;
  req_vi := case w.want
    when 'tour' then case when when_vi is null then 'Ba mẹ muốn đặt lịch tham quan. PRA sẽ liên hệ để hẹn ngày giờ với ba mẹ.'
                     else 'Ba mẹ đã đặt lịch tham quan vào ' || when_vi || '. PRA sẽ xác nhận lại ngày giờ với ba mẹ.' end
    when 'call' then case when when_vi is null then 'Ba mẹ muốn trò chuyện qua video. PRA sẽ liên hệ để hẹn ngày giờ với ba mẹ.'
                     else 'Ba mẹ đã hẹn trò chuyện qua video vào ' || when_vi || '. PRA sẽ xác nhận lại ngày giờ với ba mẹ.' end
    when 'global' then 'Ba mẹ muốn tìm hiểu về Global Program.'
    else '' end;
  want_en := case w.want when 'tour' then 'campus tour request' when 'call' then 'video call request'
    when 'global' then 'Global Program question' else 'message' end;

  if coalesce((tpl ->> 'on')::boolean, false) is false then
    insert into adm_mail_queue (kind, ref_id, to_addr, lang, status, error)
    values ('web_family', p_id, coalesce(w.email, ''), lang, 'skipped', 'Thank-you emails were switched off.');
    family_line := 'not sent (thank-you emails are switched off)';
  elsif coalesce(w.email, '') !~ '@' then
    insert into adm_mail_queue (kind, ref_id, lang, status, error)
    values ('web_family', p_id, lang, 'skipped', 'No email address in the message.');
    family_line := 'not sent (no email address)';
  elsif send_to = '' then
    insert into adm_mail_queue (kind, ref_id, to_addr, lang, status, error)
    values ('web_family', p_id, w.email, lang, 'skipped', 'A thank-you already went to this address in the last 24 hours.');
    family_line := 'not sent (a thank-you already went to this address in the last 24 hours)';
  else
    select * into m from adm_mail_family(tpl, lang,
      jsonb_build_object('name', coalesce(nullif(trim(w.name), ''), 'parents'), 'request', req_en, 'when', coalesce(when_en, '')),
      jsonb_build_object('name', coalesce(nullif(trim(w.name), ''), 'ba mẹ'), 'request', req_vi, 'when', coalesce(when_vi, '')));
    insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang)
    values ('web_family', p_id, send_to, m.subject, m.body, m.html, lang);
    family_line := 'going to ' || send_to;
  end if;

  if coalesce((office ->> 'on')::boolean, false) and coalesce(office ->> 'to', '') ~ '@' then
    insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang)
    select 'web_office', p_id, office ->> 'to', x.subject, x.body, adm_mail_office_page(x.body), 'en'
      from (select
        'Website: ' || want_en || ' from ' || coalesce(nullif(trim(w.name), ''), w.email) as subject,
        concat_ws(E'\n',
          'A family has written through the form on pra.edu.vn.',
          '',
          'Name: ' || coalesce(nullif(trim(w.name), ''), '(not given)'),
          'Email: ' || coalesce(nullif(w.email, ''), '(none)'),
          'Phone: ' || coalesce(nullif(w.phone, ''), '(none)'),
          case when when_en is not null then 'Day asked for: ' || when_en end,
          case when nullif(w.child_age, '') is not null then 'Child''s age: ' || w.child_age end,
          'Written: ' || case when lang = 'vi' then 'in Vietnamese' else 'in English' end,
          case when nullif(trim(w.message), '') is not null then E'\nTheir message:\n' || trim(w.message) end,
          '',
          'Thank-you email to the family: ' || family_line,
          '',
          'It is waiting on the Leads page of The Current:',
          'https://current.pra.edu.vn/#/leads') as body) x;
  end if;
end $$;

create or replace function adm_mail_on_web_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform adm_mail_web_message(new.id);
  exception when others then
    raise warning 'adm_mail_on_web_message %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists adm_mail_on_web_message on adm_web_messages;
create constraint trigger adm_mail_on_web_message after insert on adm_web_messages
  deferrable initially deferred
  for each row execute function adm_mail_on_web_message();

-- ---------------- 8. Newsletters ----------------
-- Who each edition goes to. Keep in step with EDITIONS in src/lib/newsletter/constants.js.
create or replace function adm_newsletter_groups(p_edition text) returns text
language sql immutable as $$
  select case p_edition
    when 'ey' then 'parents_ey@palmriveracademy.edu.vn, allstaff@pra.edu.vn'
    else 'parents_all@palmriveracademy.edu.vn, allstaff@pra.edu.vn' end
$$;

-- A short email to Seth and Bowen (the `approvers` in the office settings).
create or replace function adm_mail_notice(p_ref uuid, p_subject text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare
  office jsonb := adm_mail_template('office');
begin
  if coalesce(office ->> 'approvers', '') !~ '@' then return; end if;
  insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang)
  values ('notice', p_ref, office ->> 'approvers', p_subject, p_text, adm_mail_office_page(p_text), 'en');
end $$;

-- Schedules an issue. The Current has already copied its photos and PDFs to the
-- public folder and made the email; p_mail = { subject, html, text, attachments:
-- [{ url, name }] }. p_pending is the page to put on the website ten minutes
-- before (null when the issue is on the website already and only the email is
-- left to send); p_round is its publish_count, p_print its fingerprint.
-- Replaces an earlier schedule of the same issue that has not gone yet.
create or replace function adm_newsletter_schedule(p_issue uuid, p_send_at timestamptz, p_mail jsonb,
  p_pending jsonb default null, p_round int default null, p_print text default null)
returns adm_mail_queue
language plpgsql security definer set search_path = public as $$
declare
  n adm_newsletters;
  q adm_mail_queue;
  approver boolean := adm_mail_approver();
  at timestamptz := greatest(coalesce(p_send_at, now()), now());
  ed_name text;
  label text;
  a jsonb;
  extra jsonb;
begin
  if not adm_newsletter_office() then
    raise exception 'Only the office can schedule a newsletter.' using errcode = '42501';
  end if;
  select * into n from adm_newsletters where id = p_issue for update;
  if not found then raise exception 'This issue no longer exists.'; end if;
  if exists (select 1 from adm_mail_queue where ref_id = p_issue and kind = 'newsletter' and status = 'sending') then
    raise exception 'This issue is being sent right now.';
  end if;
  if exists (select 1 from adm_mail_queue where ref_id = p_issue and kind = 'newsletter' and status = 'sent') then
    raise exception 'This issue has already been emailed to families. To send it again, use Publish and the Gmail draft.';
  end if;
  if coalesce(p_mail ->> 'subject', '') = '' or coalesce(p_mail ->> 'html', '') = '' then
    raise exception 'The email is empty.';
  end if;
  if p_pending is null and n.status <> 'published' then
    raise exception 'The issue is not on the website and nothing was prepared to put there.';
  end if;
  for a in select * from jsonb_array_elements(coalesce(p_mail -> 'attachments', '[]'::jsonb)) loop
    if coalesce(a ->> 'url', '') !~ '^https://' then raise exception 'An attachment is not at a public https address.'; end if;
  end loop;

  update adm_mail_queue set status = 'cancelled', cancelled_by = adm_email(), cancelled_at = now(),
         error = 'Replaced by a new schedule.'
   where ref_id = p_issue and kind = 'newsletter' and status in ('waiting', 'ready');

  ed_name := case n.edition when 'ey' then 'Early Years Weekly Newsletter' else 'The Palm River Post' end;
  label := case when n.quarter is not null then 'Quarter ' || n.quarter || ' · Week ' || n.week else adm_mail_day(n.issue_date, 'en') end;
  -- The page is kept exactly as The Current made it (no nulls taken out).
  extra := jsonb_build_object('edition', n.edition, 'name', ed_name, 'label', label,
                              'page', 'https://pra.edu.vn/newsletter/' || n.slug || '/');
  if p_pending is not null then
    extra := extra || jsonb_build_object('pending', p_pending, 'round', coalesce(p_round, n.publish_count + 1));
  end if;
  if p_print is not null then
    extra := extra || jsonb_build_object('print', p_print);
  end if;

  insert into adm_mail_queue (kind, ref_id, to_addr, bcc_addr, subject, body, html, attachments, lang, send_at, status,
                              extra, requested_by, approved_by, approved_at)
  values ('newsletter', p_issue, '', adm_newsletter_groups(n.edition), p_mail ->> 'subject',
          coalesce(p_mail ->> 'text', ''), p_mail ->> 'html', coalesce(p_mail -> 'attachments', '[]'::jsonb), 'en', at,
          case when approver then 'ready' else 'waiting' end,
          extra,
          adm_email(),
          case when approver then adm_email() end,
          case when approver then now() end)
  returning * into q;

  if not approver then
    perform adm_mail_notice(p_issue,
      'Newsletter to approve: ' || ed_name || ', ' || label,
      concat_ws(E'\n',
        adm_mail_who(adm_email()) || ' has scheduled ' || ed_name || ', ' || label || ', for ' || adm_mail_moment(at) || '.',
        'It goes to ' || adm_newsletter_groups(n.edition) || ' once Seth or Bowen approves it.',
        '',
        'Read it and approve it in The Current:',
        'https://current.pra.edu.vn/#/newsletter/' || p_issue));
  end if;
  return q;
end $$;

create or replace function adm_newsletter_approve(p_job uuid) returns adm_mail_queue
language plpgsql security definer set search_path = public as $$
declare
  q adm_mail_queue;
begin
  if not adm_mail_approver() then
    raise exception 'Only Seth or Bowen can approve a newsletter.' using errcode = '42501';
  end if;
  -- Approved after its time: it goes straight away.
  update adm_mail_queue set status = 'ready', approved_by = adm_email(), approved_at = now(), send_at = greatest(send_at, now())
   where id = p_job and kind = 'newsletter' and status = 'waiting'
  returning * into q;
  if not found then raise exception 'This schedule is not waiting for approval any more. Reload the page.'; end if;
  return q;
end $$;

-- A test of a newsletter, to staff only, at any stage: the scheduled email exactly
-- as it will go (p_job), or the issue as it is now (p_mail = { subject, html, text },
-- made by The Current). A yellow box at the top says it is a test, from whom, and
-- the note they wrote (p_note); the subject starts "[Test]". It goes to the sender
-- unless p_to names other staff: at most six addresses, all @pra.edu.vn or
-- @palmriveracademy.edu.vn. Ten tests an hour for each person.
create or replace function adm_newsletter_send_test(p_issue uuid, p_job uuid default null, p_mail jsonb default null,
  p_to text default null, p_note text default null)
returns adm_mail_queue
language plpgsql security definer set search_path = public as $$
declare
  j adm_mail_queue;
  q adm_mail_queue;
  me text := adm_email();
  rcpt text[];
  a text;
  subj text;
  html text;
  body text;
  files jsonb := '[]'::jsonb;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  box text;
  i int;
  k int;
begin
  if not adm_newsletter_office() then
    raise exception 'Only the office can send a test.' using errcode = '42501';
  end if;
  if me !~ '@' then raise exception 'This login has no email address to send the test to.'; end if;
  rcpt := adm_mail_addrs(coalesce(nullif(btrim(coalesce(p_to, '')), ''), me));
  if coalesce(array_length(rcpt, 1), 0) = 0 then raise exception 'Give at least one address to send the test to.'; end if;
  if array_length(rcpt, 1) > 6 then raise exception 'A test goes to six addresses at most.'; end if;
  foreach a in array rcpt loop
    if a !~ '@(pra\.edu\.vn|palmriveracademy\.edu\.vn)$' then
      raise exception 'Tests go to staff addresses only (@pra.edu.vn): % is not one.', a;
    end if;
  end loop;
  if (select count(*) from adm_mail_queue where kind = 'test' and requested_by = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You have sent ten tests in the last hour. Look in your inbox, or wait a little.';
  end if;

  if p_job is not null then
    select * into j from adm_mail_queue where id = p_job and kind = 'newsletter';
    if not found or j.html = '' then raise exception 'This schedule no longer exists. Reload the page.'; end if;
    p_issue := j.ref_id;
    subj := j.subject; html := j.html; body := j.body; files := j.attachments;
  else
    if not exists (select 1 from adm_newsletters where id = p_issue) then raise exception 'This issue no longer exists.'; end if;
    subj := p_mail ->> 'subject'; html := p_mail ->> 'html'; body := coalesce(p_mail ->> 'text', '');
    if coalesce(subj, '') = '' or coalesce(html, '') = '' then raise exception 'The test email is empty.'; end if;
  end if;

  box := '<div style="max-width:600px;margin:12px auto;padding:12px 16px;background:#FFF6DE;border:1px solid #FFE4A0;border-radius:8px;'
    || 'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#7A5000"><b>Test</b> from '
    || adm_mail_esc(adm_mail_who(me)) || '. Families have not received this.'
    || case when note is not null then '<br><br>' || replace(adm_mail_esc(note), E'\n', '<br>') else '' end || '</div>';
  -- Straight after <body ...>, or on top when there is none.
  i := position('<body' in lower(html));
  if i > 0 then
    k := i + position('>' in substr(html, i)) - 1;
    html := substr(html, 1, k) || box || substr(html, k + 1);
  else
    html := box || html;
  end if;
  body := 'TEST from ' || adm_mail_who(me) || '. Families have not received this.'
    || coalesce(E'\n\n' || note, '') || E'\n\n------\n\n' || body;

  insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, attachments, lang, requested_by)
  values ('test', p_issue, array_to_string(rcpt, ', '), '[Test] ' || subj, body, html, files, 'en', me)
  returning * into q;
  return q;
end $$;

-- The first version of the button (scheduled email, to the sender, no note).
create or replace function adm_newsletter_test(p_job uuid) returns adm_mail_queue
language sql security definer set search_path = public as $$
  select * from adm_newsletter_send_test(null, p_job, null, null, null)
$$;

create or replace function adm_newsletter_unschedule(p_job uuid) returns adm_mail_queue
language plpgsql security definer set search_path = public as $$
declare
  q adm_mail_queue;
begin
  if not adm_newsletter_office() then
    raise exception 'Only the office can cancel a schedule.' using errcode = '42501';
  end if;
  update adm_mail_queue set status = 'cancelled', cancelled_by = adm_email(), cancelled_at = now()
   where id = p_job and kind = 'newsletter' and status in ('waiting', 'ready', 'failed')
  returning * into q;
  if not found then raise exception 'This schedule cannot be cancelled now (it is being sent, or has gone). Reload the page.'; end if;
  return q;
end $$;

-- Sends a failed or skipped email again (a thank-you, an alert, or a newsletter that did not go).
create or replace function adm_mail_retry(p_id uuid) returns adm_mail_queue
language plpgsql security definer set search_path = public as $$
declare
  q adm_mail_queue;
begin
  if not (adm_is_staff() or adm_newsletter_office()) then
    raise exception 'Only the office can send an email again.' using errcode = '42501';
  end if;
  select * into q from adm_mail_queue where id = p_id for update;
  if not found then raise exception 'This email no longer exists.'; end if;
  if q.status not in ('failed', 'skipped') then raise exception 'Only an email that was not sent can be sent again.'; end if;
  if q.html = '' or (q.to_addr = '' and q.bcc_addr = '') then
    raise exception 'There is nothing to send: %', coalesce(q.error, 'the email is empty.');
  end if;
  if q.kind = 'newsletter' and exists (select 1 from adm_mail_queue where ref_id = q.ref_id and kind = 'newsletter' and status in ('waiting', 'ready', 'sending', 'sent') and id <> q.id) then
    raise exception 'This issue has another schedule, or has gone already.';
  end if;
  update adm_mail_queue set status = 'ready', send_at = now(), tries = 0, next_try_at = null, claimed_at = null,
         error = null, requested_by = adm_email()
   where id = p_id
  returning * into q;
  return q;
end $$;

-- When the script last asked for work, and how much is waiting.
create or replace function adm_mailer_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when adm_is_staff() or adm_newsletter_office() then jsonb_build_object(
    'last_seen', (select last_seen from adm_mailer_key),
    'ready', (select count(*) from adm_mail_queue where status = 'ready' and send_at <= now()),
    'failed', (select count(*) from adm_mail_queue where status = 'failed' and created_at > now() - interval '14 days'))
  end
$$;

-- ---------------- 9. The script ----------------
create or replace function adm_mailer_ok(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select length(coalesce(p_key, '')) >= 32 and exists (select 1 from adm_mailer_key where key = p_key)
$$;

-- What to send now: { build, jobs: [{ id, kind, to, cc, bcc, subject, html, text,
-- attachments, send_at, page, build_ok }] }. On the way it tidies the outbox and
-- puts on the website every approved newsletter due in the next ten minutes;
-- `build` says the website needs building.
create or replace function adm_mailer_due(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q adm_mail_queue;
  built boolean := false;
  jobs jsonb;
begin
  if not adm_mailer_ok(p_key) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update adm_mailer_key set last_seen = now() where id = 1;  -- Supabase refuses an update with no WHERE through the API

  -- Taken by a run that never said how it went: Gmail may have sent it, so it is never sent again by itself.
  update adm_mail_queue set status = 'failed',
         error = 'Sending did not finish. Look in admin@ Sent before sending it again.'
   where status = 'sending' and claimed_at < now() - interval '20 minutes';
  -- Thank-yous and alerts more than two days late are not worth sending.
  update adm_mail_queue set status = 'skipped',
         error = 'Not sent: more than two days late (the admin@ script was not running).'
   where status = 'ready' and kind <> 'newsletter' and send_at < now() - interval '2 days';
  -- A newsletter more than twelve hours late waits for someone to decide.
  for q in update adm_mail_queue set status = 'failed',
                  error = 'Not sent: the admin@ script did not run at the time. Send it again, or send it from Gmail.'
            where status = 'ready' and kind = 'newsletter' and send_at < now() - interval '12 hours'
           returning * loop
    perform adm_mail_notice(q.ref_id, 'Newsletter not sent: ' || (q.extra ->> 'name') || ', ' || (q.extra ->> 'label'),
      concat_ws(E'\n', q.error, '', 'https://current.pra.edu.vn/#/newsletter/' || q.ref_id));
  end loop;

  -- Put approved newsletters on the website ten minutes before they go (unless
  -- someone has published the issue by hand since it was scheduled).
  for q in select * from adm_mail_queue
            where kind = 'newsletter' and status = 'ready' and send_at <= now() + interval '10 minutes'
              and extra ? 'pending' and not extra ? 'published_at'
            for update skip locked loop
    update adm_newsletters
       set status = 'published', published = q.extra -> 'pending',
           publish_count = coalesce((q.extra ->> 'round')::int, publish_count + 1),
           settings = settings || jsonb_strip_nulls(jsonb_build_object('published_print', q.extra ->> 'print')),
           published_by = coalesce(q.approved_by, q.requested_by)
     where id = q.ref_id and publish_count < coalesce((q.extra ->> 'round')::int, 2147483647);
    if found then built := true; end if;
    update adm_mail_queue set extra = extra || jsonb_build_object('published_at', now()) where id = q.id;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'kind', kind, 'to', to_addr, 'cc', cc_addr, 'bcc', bcc_addr,
           'subject', subject, 'html', html, 'text', body, 'attachments', attachments,
           'send_at', send_at, 'page', case when kind = 'newsletter' then extra ->> 'page' end,
           'build_ok', coalesce((extra -> 'build' ->> 'ok')::boolean, false)) order by send_at), '[]'::jsonb)
    into jobs
    from (select * from adm_mail_queue
           where status = 'ready' and send_at <= now() and coalesce(next_try_at, send_at) <= now()
           order by send_at limit 20) x;
  return jsonb_build_object('build', built, 'jobs', jobs);
end $$;

-- Takes one email before sending it; false when another run has it.
create or replace function adm_mailer_claim(p_key text, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not adm_mailer_ok(p_key) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update adm_mail_queue set status = 'sending', claimed_at = now(), tries = tries + 1
   where id = p_id and status = 'ready';
  return found;
end $$;

-- How sending went. A failed email is tried again ten minutes later, three times
-- in all; after that it stays failed, and for a newsletter Seth and Bowen are told.
create or replace function adm_mailer_done(p_key text, p_id uuid, p_ok boolean, p_error text default null, p_message_id text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  q adm_mail_queue;
begin
  if not adm_mailer_ok(p_key) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into q from adm_mail_queue where id = p_id and status = 'sending' for update;
  if not found then return; end if;
  if p_ok then
    update adm_mail_queue set status = 'sent', sent_at = now(), message_id = nullif(p_message_id, ''), error = null, next_try_at = null
     where id = p_id;
  elsif q.tries < 3 then
    update adm_mail_queue set status = 'ready', next_try_at = now() + interval '10 minutes', error = left(coalesce(p_error, 'Gmail refused it.'), 500)
     where id = p_id;
  else
    update adm_mail_queue set status = 'failed', error = left(coalesce(p_error, 'Gmail refused it.'), 500)
     where id = p_id;
    if q.kind = 'newsletter' then
      perform adm_mail_notice(q.ref_id, 'Newsletter not sent: ' || (q.extra ->> 'name') || ', ' || (q.extra ->> 'label'),
        concat_ws(E'\n', 'Gmail refused it three times: ' || left(coalesce(p_error, ''), 300),
          case when q.extra ? 'published_at' then 'Its page is on the website already.' end,
          '', 'Send it again from The Current, or use Publish and the Gmail draft:',
          'https://current.pra.edu.vn/#/newsletter/' || q.ref_id));
    end if;
  end if;
end $$;

-- Whether the website build the script asked for has started, for the newsletters
-- just put on the website. While it has, the script waits (up to 15 minutes) for
-- the page to be live before sending the email.
create or replace function adm_mailer_build(p_key text, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not adm_mailer_ok(p_key) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update adm_mail_queue
     set extra = extra || jsonb_build_object('build', jsonb_strip_nulls(jsonb_build_object('at', now(), 'ok', p_ok, 'error', left(p_error, 300))))
   where kind = 'newsletter' and status in ('ready', 'sending') and extra ? 'published_at' and not extra ? 'build';
end $$;

-- ---------------- 10. Grants ----------------
revoke all on function adm_mail_enrollment(uuid), adm_mail_web_message(uuid), adm_mail_notice(uuid, text, text),
  adm_mail_template(text), adm_mail_who(text), adm_mail_recent(text, text) from public, anon, authenticated;
revoke all on function adm_newsletter_schedule(uuid, timestamptz, jsonb, jsonb, int, text), adm_newsletter_approve(uuid),
  adm_newsletter_unschedule(uuid), adm_newsletter_test(uuid), adm_newsletter_send_test(uuid, uuid, jsonb, text, text),
  adm_mail_retry(uuid), adm_mailer_status() from public, anon;
grant execute on function adm_newsletter_schedule(uuid, timestamptz, jsonb, jsonb, int, text), adm_newsletter_approve(uuid),
  adm_newsletter_unschedule(uuid), adm_newsletter_test(uuid), adm_newsletter_send_test(uuid, uuid, jsonb, text, text),
  adm_mail_retry(uuid), adm_mailer_status() to authenticated;
revoke all on function adm_mailer_ok(text), adm_mailer_due(text), adm_mailer_claim(text, uuid),
  adm_mailer_done(text, uuid, boolean, text, text), adm_mailer_build(text, boolean, text) from public;
grant execute on function adm_mailer_ok(text), adm_mailer_due(text), adm_mailer_claim(text, uuid),
  adm_mailer_done(text, uuid, boolean, text, text), adm_mailer_build(text, boolean, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------- 11. The test ----------------
-- A made-up enrollment form and a made-up website message, each written up as
-- the emails above would be. Everything it adds is undone when the block ends,
-- whether it worked or not. If this run ends with the key, the emails work.
do $$
declare
  e_id uuid;
  w_id uuid;
  fam adm_mail_queue;
begin
  insert into adm_enrollments (submission_id, source, lang, submitted_at, applying_for, student_name, first_name, dob,
                               parent_name, parent_email, parent_phone, data)
  values ('00000000-0000-4000-8000-00000000ma11', 'website', 'vi', now(), 'Academic Year 26-27', 'Zz Selftest', 'Zz',
          '2019-02-03', 'Zz Parent', 'selftest@mail-selftest.invalid', '+84 000 000 000', '{}'::jsonb)
  returning id into e_id;
  perform adm_mail_enrollment(e_id);
  select * into fam from adm_mail_queue where ref_id = e_id and kind = 'enroll_family';
  if not found or fam.status <> 'ready' or fam.html not like '%Zz Selftest%' or fam.subject = '' then
    raise exception 'the thank-you for an enrollment form was not written (%)', coalesce(fam.status || ': ' || fam.error, 'no row');
  end if;
  if not exists (select 1 from adm_mail_queue where ref_id = e_id and kind = 'enroll_office' and body like '%current.pra.edu.vn/#/enrollments?form=%') then
    raise exception 'the office alert for an enrollment form was not written';
  end if;

  insert into adm_web_messages (want, name, email, phone, visit_date, visit_time, lang)
  values ('tour', 'Zz Selftest', 'selftest-web@mail-selftest.invalid', '+84 000 000 000', current_date + 7, 'morning', 'en')
  returning id into w_id;
  perform adm_mail_web_message(w_id);
  if (select count(*) from adm_mail_queue where ref_id = w_id and status = 'ready') <> 2 then
    raise exception 'the emails for a website message were not written';
  end if;
  raise exception 'PRA_MAIL_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_MAIL_TEST_OK' then
    raise exception 'The form emails do not work yet: %', sqlerrm;
  end if;
end $$;

-- The key for the admin@ script (scripts/mailer/README.md, step 3). Keep it out of email and chat.
select key as "MAILER_KEY: paste into the admin@ script" from adm_mailer_key;
