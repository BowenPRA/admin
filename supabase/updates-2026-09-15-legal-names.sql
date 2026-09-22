-- PRA Admin: legal first name on the student record, used on progress reports
-- instead of the nickname. Run in Supabase > SQL Editor. Safe to run again.
-- Until someone types one, the app works it out from the full name
-- (e.g. "Nguyễn Minh Anh" -> "Minh Anh"), so leaving it blank is fine.

alter table adm_students add column if not exists first_name text;
