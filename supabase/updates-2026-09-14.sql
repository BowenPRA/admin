-- Run once in Supabase > SQL editor (after schema.sql and reports.sql).
-- Adds: full-price Quarter 4 flag for students enrolled after the 2026-2027
-- fee schedule, and a record of when/to whom an invoice was emailed.

alter table adm_students add column if not exists q4_full boolean default false;

alter table adm_invoices add column if not exists sent_at timestamptz;
alter table adm_invoices add column if not exists sent_to text;
alter table adm_invoices add column if not exists send_log jsonb default '[]'::jsonb;
