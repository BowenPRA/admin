-- PRA Admin: messages from the website (30 September 2026). Run once in
-- Supabase > SQL Editor, after updates-2026-09-30-leads.sql. Safe to run again.
--
-- The form on pra.edu.vn/contact/ ("Book a tour") saves what a family sends
-- straight into The Current. The website has no account. It may call one
-- function, adm_web_submit, and nothing else: it cannot read or change a
-- single row by itself.
--
-- The function keeps the message as it was sent (adm_web_messages) and makes
-- sure the family is on the Leads list. A new family is added as a new lead
-- with source "Website form". A family already there (same email) is left as
-- the office wrote it, only taken out of the archive; the message waits at the
-- top of the Leads page until someone marks it done.

-- 1. Every message, as sent.
create table if not exists adm_web_messages (
  id uuid primary key default gen_random_uuid(),
  want text not null check (want in ('tour', 'call', 'global', 'question')),
  name text not null,
  email text not null,
  phone text,
  child_age text,                         -- '5 to 7', as on the form
  visit_date date,                        -- the day asked for; the office confirms it
  visit_time text check (visit_time in ('morning', 'afternoon', 'any')),
  message text,
  lang text check (lang in ('en', 'vi')), -- which version of the site they wrote from
  lead_id uuid references adm_leads(id) on delete set null,
  done_at timestamptz,                    -- when someone in the office dealt with it
  done_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists adm_web_messages_created on adm_web_messages (created_at);
create index if not exists adm_web_messages_lead on adm_web_messages (lead_id);

-- 2. Who marked it done, taken from the signed-in account.
create or replace function adm_web_messages_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.done_at is null then
    new.done_by := null;
  elsif old.done_at is null then
    new.done_by := coalesce(nullif(adm_email(), ''), new.done_by);
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end $$;

drop trigger if exists adm_web_messages_stamp on adm_web_messages;
create trigger adm_web_messages_stamp before update on adm_web_messages
  for each row execute function adm_web_messages_stamp();

-- 3. Office accounts read, mark done and delete. The triage account reads.
--    Nobody who is not signed in can touch the table.
alter table adm_web_messages enable row level security;
revoke all on adm_web_messages from anon;

drop policy if exists staff_all on adm_web_messages;
create policy staff_all on adm_web_messages for all to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists triage_read on adm_web_messages;
create policy triage_read on adm_web_messages for select to authenticated
  using (adm_role() = 'triage');

-- 4. The one thing the website may do. It answers with nothing either way, so
--    it cannot be used to find out whether a family is already on the list.
create or replace function adm_web_submit(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_want text := coalesce(nullif(trim(p->>'want'), ''), 'question');
  v_name text := left(regexp_replace(trim(coalesce(p->>'name', '')), '\s+', ' ', 'g'), 120);
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_phone text := nullif(left(trim(coalesce(p->>'phone', '')), 40), '');
  v_age text := nullif(left(trim(coalesce(p->>'child_age', '')), 40), '');
  v_msg text := nullif(left(trim(coalesce(p->>'message', '')), 4000), '');
  v_lang text := case when p->>'lang' = 'vi' then 'vi' else 'en' end;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_date date;
  v_time text;
  v_when text := '';
  v_step text;
  v_lead uuid;
begin
  -- A box on the form that people never see. Anything typed in it came from a
  -- robot: keep nothing, and do not say so.
  if coalesce(p->>'website', '') <> '' then return; end if;

  if v_name = '' or length(v_email) > 200 or v_email !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$'
     or v_want not in ('tour', 'call', 'global', 'question') then
    raise exception 'A name and an email address are needed.' using errcode = '22023';
  end if;

  if v_want in ('tour', 'call') then
    begin
      v_date := nullif(trim(p->>'visit_date'), '')::date;
    exception when others then
      v_date := null;
    end;
    if v_date < v_today or v_date > v_today + 366 then v_date := null; end if;
    v_time := case when p->>'visit_time' in ('morning', 'afternoon') then p->>'visit_time' else 'any' end;
    if v_date is not null then
      v_when := ': ' || to_char(v_date, 'Dy FMDD Mon') || case when v_time = 'any' then '' else ', ' || v_time end;
    elsif v_time <> 'any' then
      v_when := ': ' || v_time;
    end if;
  end if;

  -- The same message sent twice (a double tap on Send) is kept once.
  if exists (select 1 from adm_web_messages m
             where m.email = v_email and m.want = v_want
               and coalesce(m.message, '') = coalesce(v_msg, '')
               and m.visit_date is not distinct from v_date
               and m.created_at > now() - interval '10 minutes') then
    return;
  end if;

  -- A flood is refused; the form then tells the person to email or call.
  if (select count(*) from adm_web_messages m where m.email = v_email and m.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from adm_web_messages m where m.created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many messages just now.' using errcode = '22023';
  end if;

  -- A family's email box can hold two addresses ("a@x.com, b@y.com"); either one is a match.
  select l.id into v_lead from adm_leads l
   where v_email = any (regexp_split_to_array(coalesce(l.email, ''), '[\s;,]+'))
   order by l.archived, l.created_at
   limit 1;

  if v_lead is null then
    v_step := case v_want
      when 'tour' then 'Confirm a campus tour' || v_when
      when 'call' then 'Confirm a video call' || v_when
      when 'global' then 'Send Global Program information'
      else 'Reply to the website message' end;
    insert into adm_leads (family, email, phone, children, program, source, first_contact, stage, next_step, notes, created_by, updated_by)
    values (v_name, v_email, v_phone,
            case when v_age is not null then 'Age ' || lower(v_age) end,
            case when v_want = 'global' then 'global' end,
            'website', v_today, 'new', v_step, v_msg, 'website', 'website')
    returning id into v_lead;
  else
    update adm_leads set archived = false, updated_by = 'website' where id = v_lead and archived;
  end if;

  insert into adm_web_messages (want, name, email, phone, child_age, visit_date, visit_time, message, lang, lead_id)
  values (v_want, v_name, v_email, v_phone, v_age, v_date, v_time, v_msg, v_lang, v_lead);
end $$;

revoke all on function adm_web_submit(jsonb) from public;
grant execute on function adm_web_submit(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
