-- PRA Admin: updates of 21 September 2026. Run once in Supabase > SQL Editor,
-- after the earlier update files. Safe to run again.
--
-- Early Years progress reports (Nursery and Kindergarten): link the teachers of
-- the new learning areas, from Schedule 2026-2027. No table changes are needed;
-- the Early Years template itself arrives with the app (Report settings).
--
--   Ms. Tham N  Nursery homeroom      Communication & Language, Mathematics,
--   Ms. Thanh   Kindergarten homeroom Understanding the World, Physical
--                                     Development, Expressive Arts & Design
--   Ms. Solo    Applied English, Nursery (the afternoon session)
--   Ms. Kiu     Applied English, Kindergarten (Literacy)
--
-- Early Years reports have no English or Science area, so the English and
-- Science links that Tham N and Thanh were given in September are removed.
-- (The Teachers page button "Add … new classes from the schedule" adds the same
-- links, but does not remove the old ones.)

with extra(email, keys) as (values
  ('tham.n@pra.edu.vn',  array['communication:Nursery', 'math:Nursery', 'understanding_world:Nursery', 'physical:Nursery', 'expressive_arts:Nursery']),
  ('thanh.n@pra.edu.vn', array['communication:Kindergarten', 'math:Kindergarten', 'understanding_world:Kindergarten', 'physical:Kindergarten', 'expressive_arts:Kindergarten']),
  ('solo@pra.edu.vn',    array['applied_english:Nursery']),
  ('kiu@pra.edu.vn',     array['applied_english:Kindergarten'])
)
update adm_teachers t
set subjects = (
      select coalesce(array_agg(distinct k order by k), '{}')
      from unnest(coalesce(t.subjects, '{}') || e.keys) k
      where k not in ('english:Nursery', 'science:Nursery', 'english:Kindergarten', 'science:Kindergarten')
    ),
    updated_at = now()
from extra e
where t.email = e.email;
