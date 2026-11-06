-- PRA Admin: emails about lesson requests (5 November 2026). Run once in Supabase >
-- SQL Editor, after updates-2026-10-22-mail.sql and updates-2026-11-05-lessons.sql.
-- Safe to run again.
--
-- The Current writes these into the outbox (adm_mail_queue); the admin@ script sends them
-- like the other outbox emails. Each email is in English, then Vietnamese.
--   to the teacher   the request is ready to check (with the links)
--                    the builder asked a question
--   to the operator  a teacher sent a request (or sent a draft or a cancelled one again)
--                    a teacher asked for changes
-- The operator's address is a setting: adm_mail_templates row 'lessons'
-- { on, to, teacher_on, office_on }. It starts as admin@pra.edu.vn.
-- An email problem never stops a request from saving: the trigger catches every error.

-- ================================================================
-- 1. Room for the new emails in the outbox and the settings
-- ================================================================
alter table adm_mail_queue drop constraint if exists adm_mail_queue_kind_check;
alter table adm_mail_queue add constraint adm_mail_queue_kind_check
  check (kind in ('enroll_family', 'enroll_office', 'web_family', 'web_office', 'newsletter', 'notice', 'test',
                  'lesson_teacher', 'lesson_office'));

alter table adm_mail_templates drop constraint if exists adm_mail_templates_key_check;
alter table adm_mail_templates add constraint adm_mail_templates_key_check
  check (key in ('enroll_family', 'web_family', 'office', 'lessons'));

insert into adm_mail_templates (key, data) values
('lessons', jsonb_build_object('on', true, 'to', 'admin@pra.edu.vn', 'teacher_on', true, 'office_on', true))
on conflict (key) do nothing;

-- ================================================================
-- 2. Pieces of the email
-- ================================================================

-- 'Maths · Year 5' / 'Toán · Year 5', as the Lessons page writes a class.
create or replace function adm_lesson_mail_class(p_class text, p_lang text default 'en') returns text
language sql immutable as $$
  select concat_ws(' · ',
    case split_part(coalesce(p_class, ''), ':', 1)
      when 'english' then case when p_lang = 'vi' then 'Tiếng Anh' else 'English' end
      when 'math' then case when p_lang = 'vi' then 'Toán' else 'Maths' end
      when 'science' then case when p_lang = 'vi' then 'Khoa học' else 'Science' end
      when 'history' then case when p_lang = 'vi' then 'Khoa học xã hội' else 'Social Studies' end
      when 'technology' then case when p_lang = 'vi' then 'Công nghệ' else 'Technology' end
      when 'cooking' then case when p_lang = 'vi' then 'Nấu ăn' else 'Cooking' end
      when 'art_craft' then case when p_lang = 'vi' then 'Mỹ thuật & Thủ công' else 'Art & Crafts' end
      when 'applied_english' then case when p_lang = 'vi' then 'Tiếng Anh ứng dụng' else 'Applied English' end
      else initcap(replace(split_part(coalesce(p_class, ''), ':', 1), '_', ' '))
    end,
    nullif(split_part(coalesce(p_class, ''), ':', 2), ''))
$$;

-- The teacher as the email names them: 'Ms. Kiu' (en), 'cô Kiu' (vi), and how the
-- Vietnamese text says "you": 'cô', 'thầy' or 'thầy cô'.
create or replace function adm_lesson_mail_teacher(p_email text, out name_en text, out name_vi text, out you_vi text)
language plpgsql stable security definer set search_path = public as $$
declare
  t adm_teachers;
  first_part text := initcap(split_part(split_part(coalesce(p_email, ''), '@', 1), '.', 1));
begin
  select * into t from adm_teachers where lower(email) = lower(coalesce(p_email, ''))
   order by coalesce(active, true) desc limit 1;
  you_vi := case when lower(coalesce(t.title, '')) in ('mr', 'mr.') then 'thầy'
                 when lower(coalesce(t.title, '')) in ('ms', 'ms.', 'mrs', 'mrs.', 'miss') then 'cô'
                 else 'thầy cô' end;
  name_en := coalesce(nullif(trim(concat_ws(' ', nullif(trim(t.title), ''), nullif(trim(t.name), ''))), ''), first_part);
  name_vi := case when you_vi = 'thầy cô' then coalesce(nullif(trim(t.name), ''), first_part)
                  else you_vi || ' ' || coalesce(nullif(trim(t.name), ''), first_part) end;
end $$;

-- What the request is about, in a few words: 'Unit 5.2 Negative numbers, pp. 44-47' or the topic.
create or replace function adm_lesson_mail_title(r adm_lesson_requests, p_lang text default 'en') returns text
language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb := coalesce(r.source, '{}'::jsonb);
  vi boolean := p_lang = 'vi';
  book adm_sources;
  unit jsonb;
  sec jsonb;
  out text := '';
begin
  if coalesce(s ->> 'book_id', '') <> '' then
    select * into book from adm_sources where id = s ->> 'book_id';
    select u into unit from jsonb_array_elements(coalesce(book.units, '[]'::jsonb)) u where u ->> 'n' = s ->> 'unit' limit 1;
    select x into sec from jsonb_array_elements(coalesce(unit -> 'sections', '[]'::jsonb)) x where x ->> 'id' = s ->> 'section' limit 1;
  end if;
  if coalesce(s ->> 'section', '') <> '' then
    out := concat_ws(' ', case when vi then 'Bài' else 'Unit' end || ' ' || (s ->> 'section'), sec ->> 'title');
  elsif coalesce(trim(s ->> 'topic'), '') <> '' then
    out := trim(s ->> 'topic');
  elsif coalesce(s ->> 'unit', '') <> '' then
    out := concat_ws(' ', case when vi then 'Chương' else 'Unit' end || ' ' || (s ->> 'unit'), unit ->> 'title');
  elsif book.title is not null then
    out := book.title;
  end if;
  if coalesce(trim(s ->> 'pages'), '') <> '' then
    out := concat_ws(', ', nullif(out, ''), case when vi then 'trang ' else 'pp. ' end || trim(s ->> 'pages'));
  end if;
  if book.title is not null and out <> book.title and coalesce(s ->> 'section', s ->> 'unit', '') <> '' then
    out := out || ' (' || book.title || ')';
  end if;
  return out;
end $$;

-- The newest message of one kind on a request (a question, a comment), or ''.
create or replace function adm_lesson_mail_last(r adm_lesson_requests, p_kind text) returns text
language sql immutable as $$
  select coalesce((select u ->> 'text' from jsonb_array_elements(coalesce(r.updates, '[]'::jsonb)) with ordinality a(u, i)
                    where u ->> 'kind' = p_kind order by i desc limit 1), '')
$$;

-- ================================================================
-- 3. Writing the email for one event
-- ================================================================
-- p_event: 'ready' or 'question' (to the teacher), 'sent' or 'changes' (to the operator).
create or replace function adm_lesson_mail(p_id uuid, p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r adm_lesson_requests;
  tpl jsonb := adm_mail_template('lessons');
  link text;
  who record;
  cls_en text;
  cls_vi text;
  what_en text;
  what_vi text;
  day_en text := '';
  day_vi text := '';
  links_en text := '';
  links_vi text := '';
  wants_en text;
  wants_vi text;
  msg text;
  to_addr text;
  kind text;
  subject text;
  t1 text;
  t2 text;
  sign_en constant text := 'Palm River Academy English Center';
  sign_vi constant text := 'Trung tâm Anh ngữ Palm River Academy';
begin
  if coalesce((tpl ->> 'on')::boolean, true) is false then return; end if;
  select * into r from adm_lesson_requests where id = p_id;
  if r.id is null then return; end if;

  link := 'https://current.pra.edu.vn/#/lessons?request=' || r.number;
  select * into who from adm_lesson_mail_teacher(r.teacher_email);
  cls_en := adm_lesson_mail_class(r.class_key, 'en');
  cls_vi := adm_lesson_mail_class(r.class_key, 'vi');
  what_en := concat_ws(', ', cls_en, nullif(adm_lesson_mail_title(r, 'en'), ''));
  what_vi := concat_ws(', ', cls_vi, nullif(adm_lesson_mail_title(r, 'vi'), ''));
  if r.needed_by is not null then
    day_en := adm_mail_day(r.needed_by, 'en');
    day_vi := adm_mail_day(r.needed_by, 'vi');
  end if;

  if p_event in ('ready', 'question') then
    if coalesce((tpl ->> 'teacher_on')::boolean, true) is false then return; end if;
    to_addr := lower(trim(coalesce(r.teacher_email, '')));
    kind := 'lesson_teacher';
  elsif p_event in ('sent', 'changes') then
    if coalesce((tpl ->> 'office_on')::boolean, true) is false then return; end if;
    to_addr := trim(coalesce(tpl ->> 'to', ''));
    kind := 'lesson_office';
  else
    return;
  end if;
  if to_addr !~ '@' then return; end if;

  -- A draft sent, taken back and sent again in a few minutes gets one email, not three.
  if p_event = 'sent' and exists (
       select 1 from adm_mail_queue q
        where q.ref_id = r.id and q.kind = 'lesson_office' and q.extra ->> 'event' = 'sent'
          and q.created_at > now() - interval '30 minutes') then
    return;
  end if;

  if p_event = 'ready' then
    select coalesce(string_agg(l.en || ': ' || (r.outputs ->> l.id), E'\n' order by l.n), ''),
           coalesce(string_agg(l.vi || ': ' || (r.outputs ->> l.id), E'\n' order by l.n), '')
      into links_en, links_vi
      from (values (1, 'slides', 'Slides', 'Slide'), (2, 'plan', 'Lesson plan', 'Giáo án'),
                   (3, 'review', 'Guided review', 'Ôn tập có hướng dẫn'), (4, 'practice', 'Practice', 'Luyện tập'),
                   (5, 'worksheet', 'Worksheet', 'Phiếu bài tập'), (6, 'game', 'Game', 'Trò chơi')) l(n, id, en, vi)
     where coalesce(r.outputs ->> l.id, '') ~ '^https?://';
    if coalesce(trim(r.outputs ->> 'note'), '') <> '' then
      links_en := concat_ws(E'\n\n', nullif(links_en, ''), 'Note from the builder: ' || trim(r.outputs ->> 'note'));
      links_vi := concat_ws(E'\n\n', nullif(links_vi, ''), 'Ghi chú của người soạn: ' || trim(r.outputs ->> 'note'));
    end if;
    subject := 'Lesson ' || r.number || ' is ready to check: ' || cls_en;
    t1 := concat_ws(E'\n\n',
      'Hello ' || who.name_en || ',',
      'Your lesson is ready to check: Lesson ' || r.number || ', ' || what_en
        || case when day_en <> '' then ' (for ' || day_en || ')' else '' end || '.',
      nullif(links_en, ''),
      E'Open the request in The Current, look through each part, then press Approve or Ask for changes:\n' || link,
      sign_en);
    t2 := concat_ws(E'\n\n',
      'Chào ' || who.name_vi || ',',
      'Bài giảng số ' || r.number || ' (' || what_vi
        || case when day_vi <> '' then ', dạy ' || day_vi else '' end || ') đã soạn xong, '
        || who.you_vi || ' vui lòng xem lại.',
      nullif(links_vi, ''),
      initcap(left(who.you_vi, 1)) || substr(who.you_vi, 2)
        || E' mở yêu cầu trên The Current, xem từng phần, rồi bấm Duyệt hoặc Yêu cầu sửa:\n' || link,
      sign_vi);

  elsif p_event = 'question' then
    msg := trim(adm_lesson_mail_last(r, 'question'));
    subject := 'A question about Lesson ' || r.number || ': ' || cls_en;
    t1 := concat_ws(E'\n\n',
      'Hello ' || who.name_en || ',',
      'The builder has a question about Lesson ' || r.number || ' (' || what_en || ')'
        || case when msg <> '' then ':' else '.' end,
      case when msg <> '' then '"' || msg || '"' end,
      E'Please answer it on the request in The Current. Your answer sends the request back to the builder:\n' || link,
      sign_en);
    t2 := concat_ws(E'\n\n',
      'Chào ' || who.name_vi || ',',
      'Người soạn có một câu hỏi về bài giảng số ' || r.number || ' (' || what_vi || ')'
        || case when msg <> '' then ':' else '.' end,
      case when msg <> '' then '"' || msg || '"' end,
      initcap(left(who.you_vi, 1)) || substr(who.you_vi, 2)
        || E' vui lòng trả lời ngay trên yêu cầu trong The Current. Khi có câu trả lời, yêu cầu sẽ được chuyển lại cho người soạn:\n' || link,
      sign_vi);

  elsif p_event = 'sent' then
    select coalesce(string_agg(w.en, ', ' order by w.n), ''), coalesce(string_agg(w.vi, ', ' order by w.n), '')
      into wants_en, wants_vi
      from (values (1, 'slides', 'slides and a plan', 'slide và giáo án'), (2, 'review', 'guided review', 'ôn tập có hướng dẫn'),
                   (3, 'practice', 'online practice', 'luyện tập trực tuyến'), (4, 'worksheet', 'printed worksheet', 'phiếu bài tập in'),
                   (5, 'game', 'review game', 'trò chơi ôn tập')) w(n, id, en, vi)
     where w.id = any(coalesce(r.wants, '{}'));
    subject := 'Lesson request ' || r.number || ' from ' || who.name_en || ': ' || cls_en;
    t1 := concat_ws(E'\n\n',
      'Hello,',
      concat_ws(E'\n',
        who.name_en || ' has sent a lesson request: Lesson ' || r.number || ', ' || what_en || '.',
        case when day_en <> '' then 'Teaching on: ' || day_en end,
        case when wants_en <> '' then 'Asked for: ' || wants_en end),
      E'Open it in The Current:\n' || link,
      sign_en);
    t2 := concat_ws(E'\n\n',
      'Xin chào,',
      concat_ws(E'\n',
        initcap(left(who.name_vi, 1)) || substr(who.name_vi, 2) || ' vừa gửi yêu cầu soạn bài: bài giảng số ' || r.number || ', ' || what_vi || '.',
        case when day_vi <> '' then 'Ngày dạy: ' || day_vi end,
        case when wants_vi <> '' then 'Cần: ' || wants_vi end),
      E'Mở yêu cầu trên The Current:\n' || link,
      sign_vi);

  else -- changes
    msg := trim(adm_lesson_mail_last(r, 'comment'));
    subject := who.name_en || ' asked for changes to Lesson ' || r.number || ': ' || cls_en;
    t1 := concat_ws(E'\n\n',
      'Hello,',
      who.name_en || ' asked for changes to Lesson ' || r.number || ' (' || what_en || ')'
        || case when msg <> '' then ':' else '.' end,
      case when msg <> '' then '"' || msg || '"' end,
      E'Open it in The Current:\n' || link,
      sign_en);
    t2 := concat_ws(E'\n\n',
      'Xin chào,',
      initcap(left(who.name_vi, 1)) || substr(who.name_vi, 2) || ' yêu cầu sửa bài giảng số ' || r.number || ' (' || what_vi || ')'
        || case when msg <> '' then ':' else '.' end,
      case when msg <> '' then '"' || msg || '"' end,
      E'Mở yêu cầu trên The Current:\n' || link,
      sign_vi);
  end if;

  insert into adm_mail_queue (kind, ref_id, to_addr, subject, body, html, lang, extra, requested_by)
  values (kind, r.id, to_addr, left(subject, 200), t1 || E'\n\n------\n\n' || t2,
          adm_mail_page(array[adm_mail_paras(t1), adm_mail_paras(t2)], array['en', 'vi']), 'en',
          jsonb_build_object('event', p_event, 'number', r.number), nullif(adm_email(), ''));
end $$;

-- ================================================================
-- 4. The triggers
-- ================================================================
-- Deferred, like the form emails: they run when the save is finished, so a question
-- written and the status changed in one go are both there. Any error is caught.
create or replace function adm_mail_on_lesson() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text;
begin
  begin
    if tg_op = 'INSERT' then
      ev := case when new.status = 'sent' then 'sent' end;
    elsif new.status is distinct from old.status then
      ev := case
        when new.status = 'ready' then 'ready'
        when new.status = 'question' then 'question'
        when new.status = 'changes' then 'changes'
        when new.status = 'sent' and old.status in ('draft', 'cancelled') then 'sent'
      end;
    end if;
    if ev is not null then perform adm_lesson_mail(new.id, ev); end if;
  exception when others then
    raise warning 'adm_mail_on_lesson %: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists adm_mail_on_lesson_new on adm_lesson_requests;
create constraint trigger adm_mail_on_lesson_new after insert on adm_lesson_requests
  deferrable initially deferred
  for each row when (new.status = 'sent') execute function adm_mail_on_lesson();

drop trigger if exists adm_mail_on_lesson_status on adm_lesson_requests;
create constraint trigger adm_mail_on_lesson_status after update on adm_lesson_requests
  deferrable initially deferred
  for each row when (new.status is distinct from old.status) execute function adm_mail_on_lesson();

-- Only the triggers call these.
revoke all on function adm_lesson_mail(uuid, text), adm_mail_on_lesson(),
  adm_lesson_mail_teacher(text), adm_lesson_mail_title(adm_lesson_requests, text) from public, anon, authenticated;
revoke all on function adm_lesson_mail_class(text, text), adm_lesson_mail_last(adm_lesson_requests, text) from public, anon;
grant execute on function adm_lesson_mail_class(text, text), adm_lesson_mail_last(adm_lesson_requests, text) to authenticated;

notify pgrst, 'reload schema';

-- ================================================================
-- 5. The test
-- ================================================================
-- A made-up teacher sends a made-up request; the builder asks a question and marks it
-- ready; the teacher asks for changes. Each step must write its email. Everything is
-- undone when the block ends, whether it worked or not.
do $$
declare
  r adm_lesson_requests;
  teacher text := '{"email": "selftest@pra-selftest.invalid", "app_metadata": {"role": "teacher"}}';
  builder text := '{"email": "triage@pra-selftest.invalid", "app_metadata": {"role": "triage"}}';
  n int;
begin
  set constraints adm_mail_on_lesson_new, adm_mail_on_lesson_status immediate;
  insert into adm_teachers (email, name, title, role, subjects, active)
  values ('selftest@pra-selftest.invalid', 'Selftest', 'Ms.', 'teacher', array['english:Year 5'], true);
  perform set_config('request.jwt.claims', teacher, true);
  insert into adm_lesson_requests (class_key, status, source, details)
  values ('english:Year 5', 'sent', '{"topic": "Self-test"}', '{"teach_on": "2030-01-15"}') returning * into r;
  if not exists (select 1 from adm_mail_queue where ref_id = r.id and kind = 'lesson_office' and body like '%#/lessons?request=%') then
    raise exception 'a sent request did not write the email to the operator';
  end if;
  perform set_config('request.jwt.claims', builder, true);
  perform adm_lesson_add_update(r.id, 'Which pages?', 'question');
  update adm_lesson_requests set status = 'question' where id = r.id;
  if not exists (select 1 from adm_mail_queue where ref_id = r.id and kind = 'lesson_teacher'
                  and to_addr = 'selftest@pra-selftest.invalid' and body like '%Which pages?%') then
    raise exception 'a question did not write the email to the teacher';
  end if;
  update adm_lesson_requests set status = 'ready', outputs = '{"slides": "https://example.invalid/slides"}' where id = r.id;
  if not exists (select 1 from adm_mail_queue where ref_id = r.id and extra ->> 'event' = 'ready' and body like '%https://example.invalid/slides%') then
    raise exception 'a ready request did not write the email with its links';
  end if;
  perform set_config('request.jwt.claims', teacher, true);
  perform adm_lesson_add_update(r.id, 'Fewer slides, please.', 'comment');
  update adm_lesson_requests set status = 'changes' where id = r.id;
  select count(*) into n from adm_mail_queue where ref_id = r.id;
  if n <> 4 or not exists (select 1 from adm_mail_queue where ref_id = r.id and extra ->> 'event' = 'changes' and body like '%Fewer slides%') then
    raise exception 'asking for changes did not write the email to the operator (% emails)', n;
  end if;
  raise exception 'PRA_LESSON_MAIL_TEST_OK';
exception when others then
  if sqlerrm <> 'PRA_LESSON_MAIL_TEST_OK' then
    raise exception 'Lesson emails do not work yet: %', sqlerrm;
  end if;
end $$;

select 'Lesson emails are set up. They go to the teacher and to '
    || coalesce((select data ->> 'to' from adm_mail_templates where key = 'lessons'), '(no address)') || '.' as result;
