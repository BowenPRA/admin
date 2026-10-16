-- PRA Admin: the weekly newsletter (16 October 2026). Run once in Supabase >
-- SQL Editor, after the earlier update files. Safe to run again.
--
-- The Palm River Post and the Early Years newsletter are written in The Current
-- (Outreach > Newsletter). Teachers can write their own class corner (Teaching >
-- Newsletter). Publish puts an issue on pra.edu.vn: the website reads published
-- issues through adm_newsletters_public() when it is built. See
-- src/lib/newsletter/README.md.
--
-- Who may do what:
--   office (super_admin, head, admin, or a head teacher)  everything
--   teachers                                               read issues; change their own class corner only
--   anyone (the website)                                   read published issues; count a page being opened

-- 1. One row per issue.
create table if not exists adm_newsletters (
  id uuid primary key default gen_random_uuid(),
  edition text not null check (edition in ('post', 'ey')),
  issue_date date not null,                 -- the Friday it goes out
  school_year text not null,                -- '2026-2027'
  quarter int,
  week int,
  slug text not null unique,                -- '2026-27-q1-week-10', its address on the website
  status text not null default 'draft' check (status in ('draft', 'english_done', 'published')),
  settings jsonb not null default '{}'::jsonb,   -- subject, cover photo, who translates, publish fingerprint
  published jsonb,                          -- what the website shows; null while not on the website
  published_at timestamptz,
  published_by text,
  publish_count int not null default 0,
  email jsonb not null default '{}'::jsonb,      -- the Gmail draft: { draft_id, message_id, saved_at, saved_by }
  english_done_at timestamptz,
  english_done_by text,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (edition, issue_date)
);

-- 2. The parts of an issue: the opening, the dates, the reminders, stories, class
-- corners, photos and the rest. Each box is saved on its own (adm_newsletter_edit),
-- so several people can work on one issue at once.
create table if not exists adm_newsletter_parts (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references adm_newsletters(id) on delete cascade,
  position double precision not null default 0,
  type text not null check (type in ('opening', 'dates', 'reminders', 'story', 'class', 'photos', 'quote', 'press', 'welcome', 'closing')),
  public boolean not null default true,     -- false: families only (email and PDF, never the website)
  data jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists adm_newsletter_parts_issue on adm_newsletter_parts (newsletter_id, position);

-- 3. How often each published page is opened: per day, language, where the
-- visitor came from (email, chat, facebook, site, pdf, direct) and the part they
-- jumped to. Nothing about the visitor is kept.
create table if not exists adm_newsletter_views (
  slug text not null,
  day date not null,
  lang text not null,
  source text not null,
  anchor text not null default '',
  count int not null default 0,
  primary key (slug, day, lang, source, anchor)
);

-- ---------------- Who is who ----------------
create or replace function adm_newsletter_office() returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_staff() or adm_is_head()
$$;

-- A class corner is its teacher's: the one named on it, or one whose homeroom year groups it covers.
create or replace function adm_newsletter_can_edit(p_type text, p_data jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_newsletter_office() or (
    p_type = 'class' and exists (
      select 1 from adm_teachers t
       where lower(t.email) = adm_email() and coalesce(t.active, true)
         and (lower(coalesce(p_data ->> 'teacher_email', '')) = adm_email()
              or t.homeroom_groups && array(select jsonb_array_elements_text(coalesce(p_data -> 'year_groups', '[]'::jsonb))))
    )
  )
$$;

-- ---------------- Stamps ----------------
create or replace function adm_newsletters_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(nullif(adm_email(), ''), new.created_by);
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published' or new.published is distinct from old.published) then
    new.published_at := now();
    new.published_by := coalesce(nullif(adm_email(), ''), new.published_by);
  end if;
  if new.status <> 'published' then
    new.published := null;
  end if;
  if new.status = 'english_done' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.english_done_at := now();
    new.english_done_by := coalesce(nullif(adm_email(), ''), new.english_done_by);
  end if;
  return new;
end $$;
drop trigger if exists adm_newsletters_stamp on adm_newsletters;
create trigger adm_newsletters_stamp before insert or update on adm_newsletters
  for each row execute function adm_newsletters_stamp();

create or replace function adm_newsletter_parts_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_by := coalesce(nullif(adm_email(), ''), new.updated_by);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(nullif(adm_email(), ''), new.created_by);
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists adm_newsletter_parts_stamp on adm_newsletter_parts;
create trigger adm_newsletter_parts_stamp before insert or update on adm_newsletter_parts
  for each row execute function adm_newsletter_parts_stamp();

-- ---------------- Saving one box ----------------
-- jsonb_set that also makes the objects on the way when they are missing.
create or replace function adm_jsonb_set_deep(target jsonb, path text[], value jsonb) returns jsonb
language plpgsql immutable as $$
declare
  cur jsonb := coalesce(target, '{}'::jsonb);
  i int;
begin
  if path is null or array_length(path, 1) is null then return value; end if;
  for i in 1 .. array_length(path, 1) - 1 loop
    if jsonb_typeof(cur #> path[1:i]) is distinct from 'object' then
      cur := jsonb_set(cur, path[1:i], '{}'::jsonb, true);
    end if;
  end loop;
  return jsonb_set(cur, path, coalesce(value, 'null'::jsonb), true);
end $$;

-- Sets (or removes) one value inside a part: p_path like {en,body} or {items,i3,vi}.
-- Two people changing different boxes of the same part both keep their change.
create or replace function adm_newsletter_edit(p_part uuid, p_path text[], p_value jsonb, p_delete boolean default false)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  r adm_newsletter_parts;
  t timestamptz;
begin
  select * into r from adm_newsletter_parts where id = p_part for update;
  if r.id is null then raise exception 'This part of the newsletter no longer exists. Reload the page.'; end if;
  if not adm_newsletter_can_edit(r.type, r.data) then raise exception 'Your account may not change this part of the newsletter.'; end if;
  if p_path is null or array_length(p_path, 1) is null then raise exception 'Nothing to change.'; end if;
  if not adm_newsletter_office() and p_path[1] in ('class_key', 'class', 'year_groups', 'teacher', 'teacher_email') then
    raise exception 'Only the office can change whose class corner this is.';
  end if;
  update adm_newsletter_parts
     set data = case when p_delete then data #- p_path else adm_jsonb_set_deep(data, p_path, p_value) end
   where id = p_part
   returning updated_at into t;
  return t;
end $$;
grant execute on function adm_newsletter_edit(uuid, text[], jsonb, boolean) to authenticated;

-- ---------------- The website ----------------
-- Published issues, as the website shows them. Nothing else of an issue leaves the database this way.
create or replace function adm_newsletters_public() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select n.published from adm_newsletters n
   where n.status = 'published' and n.published is not null
   order by n.issue_date desc, n.edition desc
$$;
grant execute on function adm_newsletters_public() to anon, authenticated;

-- Counts one opening of a published page. Unknown pages and odd values are ignored or tidied.
create or replace function adm_newsletter_seen(p_slug text, p_lang text default 'en', p_source text default 'direct', p_anchor text default '')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from adm_newsletters where slug = p_slug and status = 'published') then return; end if;
  insert into adm_newsletter_views (slug, day, lang, source, anchor, count)
  values (
    p_slug,
    (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    case when p_lang = 'vi' then 'vi' else 'en' end,
    case when p_source in ('email', 'chat', 'facebook', 'site', 'pdf') then p_source else 'direct' end,
    left(regexp_replace(lower(coalesce(p_anchor, '')), '[^a-z0-9-]', '', 'g'), 24),
    1)
  on conflict (slug, day, lang, source, anchor) do update set count = adm_newsletter_views.count + 1;
end $$;
grant execute on function adm_newsletter_seen(text, text, text, text) to anon, authenticated;

-- ---------------- Row level security ----------------
alter table adm_newsletters enable row level security;
alter table adm_newsletter_parts enable row level security;
alter table adm_newsletter_views enable row level security;

drop policy if exists nl_read on adm_newsletters;
create policy nl_read on adm_newsletters for select to authenticated using (adm_is_report_staff());
drop policy if exists nl_office on adm_newsletters;
create policy nl_office on adm_newsletters for all to authenticated
  using (adm_newsletter_office()) with check (adm_newsletter_office());

drop policy if exists nlp_read on adm_newsletter_parts;
create policy nlp_read on adm_newsletter_parts for select to authenticated using (adm_is_report_staff());
drop policy if exists nlp_office on adm_newsletter_parts;
create policy nlp_office on adm_newsletter_parts for all to authenticated
  using (adm_newsletter_office()) with check (adm_newsletter_office());

drop policy if exists nlv_read on adm_newsletter_views;
create policy nlv_read on adm_newsletter_views for select to authenticated using (adm_newsletter_office());

-- ---------------- Storage ----------------
-- Private: photos while an issue is being written. Teachers add photos to their corner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-newsletter', 'adm-newsletter', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists adm_newsletter_read on storage.objects;
create policy adm_newsletter_read on storage.objects for select to authenticated
  using (bucket_id = 'adm-newsletter' and adm_is_report_staff());
drop policy if exists adm_newsletter_add on storage.objects;
create policy adm_newsletter_add on storage.objects for insert to authenticated
  with check (bucket_id = 'adm-newsletter' and adm_is_report_staff());
drop policy if exists adm_newsletter_change on storage.objects;
create policy adm_newsletter_change on storage.objects for update to authenticated
  using (bucket_id = 'adm-newsletter' and (adm_newsletter_office() or owner = auth.uid()))
  with check (bucket_id = 'adm-newsletter' and (adm_newsletter_office() or owner = auth.uid()));
drop policy if exists adm_newsletter_remove on storage.objects;
create policy adm_newsletter_remove on storage.objects for delete to authenticated
  using (bucket_id = 'adm-newsletter' and (adm_newsletter_office() or owner = auth.uid()));

-- Public: what a published issue shows (photos in two sizes, the PDFs). Anyone can
-- read it, as the website does; only the office puts things in or takes them out.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newsletter', 'newsletter', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists newsletter_office on storage.objects;
create policy newsletter_office on storage.objects for all to authenticated
  using (bucket_id = 'newsletter' and adm_newsletter_office())
  with check (bucket_id = 'newsletter' and adm_newsletter_office());

notify pgrst, 'reload schema';
