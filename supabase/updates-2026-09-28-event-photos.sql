-- PRA Admin: event photos (28 September 2026). Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- The Photos tab shows each event's curated photos, an internal description of
-- the event and draft Facebook posts. The photos are chosen, edited and
-- described on Bowen's laptop and sent up with
--   node scripts/upload-event-photos.mjs "<event folder>\current"
-- Office accounts (super_admin, head, admin) are the only ones who can see or
-- change any of it. No child's name is stored anywhere in these tables.

-- 1. One row per event.
create table if not exists adm_photo_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- '2026-09-25-mid-autumn-festival'
  name text not null,
  event_date date,
  school_year text,                       -- '2026-27'
  drive_folder text,                      -- where the originals are
  -- 'requested' (asked for in the tab) | 'working' | 'ready' (photos are in)
  status text default 'ready' check (status in ('requested', 'working', 'ready')),
  request_note text,
  requested_by text,
  description text,                       -- for staff: what happened, what is missing
  notes jsonb default '{}'::jsonb,        -- counts, coverage, questions for the office
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. One row per curated photo.
create table if not exists adm_event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references adm_photo_events(id) on delete cascade,
  code text not null,                     -- 'p0054', the photo's id in the laptop library
  seq int,                                -- place in the album
  hero boolean default false,
  title text,
  caption text,
  score numeric(3,1) check (score >= 0 and score <= 10),
  score_parts jsonb default '{}'::jsonb,  -- moment, people, light, frame, story
  judge_note text,                        -- why it got that score
  tags jsonb default '{}'::jsonb,         -- { stage: [...], activity: [...], shot: '...', ... }
  privacy_flags jsonb default '[]'::jsonb,
  privacy_note text,
  -- Which edit is showing: 'original' | 'A' | 'B' | 'C'. Every look is already
  -- in Storage, so changing it needs no editing.
  look text default 'B' check (look in ('original', 'A', 'B', 'C')),
  files jsonb default '{}'::jsonb,        -- { original, A, B, C, original_thumb, A_thumb, B_thumb, C_thumb }: paths in Storage
  focus jsonb,                            -- [x, y] as fractions: the point a crop for a post must keep
  width int,
  height int,
  original_name text,                     -- the file's name on the shared drive
  taken_at timestamptz,
  listed boolean default true,            -- false = delisted: kept, but out of the album and the posts
  cleared boolean default false,          -- checked against the no-photo list
  cleared_by text,
  cleared_on date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, code)
);
create index if not exists adm_event_photos_event on adm_event_photos (event_id, seq);

-- 3. Draft posts for Facebook.
create table if not exists adm_event_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references adm_photo_events(id) on delete cascade,
  kind text not null,                     -- 'recap' | 'spotlight' | 'thanks' | ...
  seq int default 1,
  title text,                             -- for the office, not part of the post
  caption text,
  other_first_lines jsonb default '[]'::jsonb,
  photo_codes jsonb default '[]'::jsonb,  -- the photos to use, in order; the first leads
  shape text default '4:5',
  suggested_time text,
  notes text,                             -- what to check before posting
  status text default 'draft' check (status in ('draft', 'posted', 'dropped')),
  posted_at timestamptz,
  posted_by text,
  results jsonb default '{}'::jsonb,      -- reach, reactions, comments, shares
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, kind, seq)
);

-- 4. Office accounts only.
alter table adm_photo_events enable row level security;
alter table adm_event_photos enable row level security;
alter table adm_event_posts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['adm_photo_events', 'adm_event_photos', 'adm_event_posts'] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format('create policy staff_all on %I for all to authenticated using (adm_is_staff()) with check (adm_is_staff())', t);
  end loop;
end $$;

-- 5. A private bucket for the pictures: nothing in it has a public link; the app
--    asks for signed links once an office account has signed in. This is a
--    separate bucket from adm-photos, which teachers can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-event-photos', 'adm-event-photos', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists adm_event_photos_office on storage.objects;
create policy adm_event_photos_office on storage.objects for all to authenticated
  using (bucket_id = 'adm-event-photos' and adm_is_staff())
  with check (bucket_id = 'adm-event-photos' and adm_is_staff());
