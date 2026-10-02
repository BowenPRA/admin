-- PRA Admin: who can delete a To-Do task (1 October 2026). Run once in Supabase >
-- SQL Editor, after updates-2026-10-01-todos.sql. Safe to run again.
--
-- Seth and Bowen (head, super admin) can delete any task. The other office
-- accounts can delete a task they added, or one whose "Asked by" is them: its
-- first word against the first part of their email ("Hien" = hien.c@pra.edu.vn).
-- Seeing, adding and changing tasks stays open to every office account, and the
-- inbox triage still cannot delete anything. The page hides the Delete button
-- by the same rule (canDeleteTodo in src/lib/todos.js).

-- The one "for all" policy becomes one per action, so delete can have its own rule.
drop policy if exists staff_all on adm_todos;

drop policy if exists staff_read on adm_todos;
create policy staff_read on adm_todos for select to authenticated
  using (adm_is_staff());

drop policy if exists staff_add on adm_todos;
create policy staff_add on adm_todos for insert to authenticated
  with check (adm_is_staff());

drop policy if exists staff_change on adm_todos;
create policy staff_change on adm_todos for update to authenticated
  using (adm_is_staff()) with check (adm_is_staff());

drop policy if exists staff_delete on adm_todos;
create policy staff_delete on adm_todos for delete to authenticated
  using (
    adm_role() in ('super_admin', 'head')
    or (adm_is_staff() and adm_email() <> '' and (
          lower(coalesce(created_by, '')) = adm_email()
       or lower(split_part(trim(coalesce(giver, '')), ' ', 1)) = split_part(split_part(adm_email(), '@', 1), '.', 1)
    ))
  );

notify pgrst, 'reload schema';
