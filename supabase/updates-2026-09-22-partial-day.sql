-- PRA Admin: partial-day students (22 September 2026). Run once in Supabase >
-- SQL Editor, after the earlier update files. Safe to run again.
--
-- partial_from is the time a student arrives (e.g. '11:35'), blank for a full
-- day. The morning lessons are the academic ones (Mathematics, Science,
-- English), so a partial-day student's progress report has only specialist and
-- vocational learning, and attendance does not mark them present in bulk before
-- they arrive. The office can change it on the student record (Enrollment).

alter table adm_students add column if not exists partial_from text;

-- Gene (BLE0055) and Hunter (BLE0056) Knispel join at 11:35.
update adm_students set partial_from = '11:35', updated_at = now()
where student_code in ('BLE0055', 'BLE0056') and partial_from is distinct from '11:35';
