-- Posting to Facebook from the Photos tab (supabase/functions/facebook-post).
-- One column on the draft posts: what Facebook said when the post went out.
--   { post_id, link, page, photo_ids, scheduled_for, sent_at, by }
-- or, for the few seconds while a post is being sent, { sending_at, by }.
-- Safe to run more than once.

alter table adm_event_posts add column if not exists facebook jsonb;

notify pgrst, 'reload schema';
