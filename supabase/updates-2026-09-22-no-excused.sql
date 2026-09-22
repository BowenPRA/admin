-- PRA Admin: attendance without "excused" (22 September 2026). Run once in
-- Supabase > SQL Editor. Safe to run again.
--
-- PRA's attendance is Present, Late or Absent. Marks saved as excused become
-- absent (their notes stay), and the status check no longer allows excused.

update adm_attendance set status = 'absent', updated_at = now() where status = 'excused';

alter table adm_attendance drop constraint if exists adm_attendance_status_check;
alter table adm_attendance add constraint adm_attendance_status_check check (status in ('present', 'absent', 'late'));
