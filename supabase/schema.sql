-- PRA Admin: invoices, receipts, students.
-- Run this once in Supabase > SQL editor. Tables are prefixed adm_ so they can
-- live in the same project as the student Dashboard without clashing.

create extension if not exists pgcrypto;

create table if not exists adm_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  language text default 'en',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists adm_students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references adm_families(id) on delete set null,
  full_name text not null,
  nickname text,
  level text,
  program text default 'regular',
  legacy boolean default false,
  is_new boolean default false,
  active boolean default true,
  dob date,
  nationality text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists adm_invoices (
  id uuid primary key default gen_random_uuid(),
  number text unique,
  family_id uuid references adm_families(id) on delete set null,
  family_name text,
  student_ids uuid[] default '{}',
  student_names text,
  school_year text,
  period_label text,
  lang text default 'en',
  status text default 'draft',
  issue_date date,
  due_date date,
  total bigint default 0,
  paid bigint default 0,
  inputs jsonb,
  doc jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists adm_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references adm_invoices(id) on delete cascade,
  student_names text,
  amount bigint not null default 0,
  paid_on date,
  method text default 'transfer',
  reference text,
  note text,
  receipt_number text,
  receipt jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists adm_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Only signed-in staff may touch these tables. A user counts as staff when the
-- server-set app_metadata.role is 'teacher' or 'admin' (set it in
-- Authentication > Users > ... > app metadata, never user_metadata).
create or replace function adm_is_staff() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('teacher', 'admin'), false)
$$;

alter table adm_families enable row level security;
alter table adm_students enable row level security;
alter table adm_invoices enable row level security;
alter table adm_payments enable row level security;
alter table adm_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['adm_families','adm_students','adm_invoices','adm_payments','adm_settings'] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format('create policy staff_all on %I for all to authenticated using (adm_is_staff()) with check (adm_is_staff())', t);
  end loop;
end $$;
