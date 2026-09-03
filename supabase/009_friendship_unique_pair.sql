-- Run after 008_track_release_year.sql. Fixes a bug where two people adding each other before
-- either accepted created two separate rows (one per direction) instead of one — the friendship
-- would get stuck showing contradictory states that never resolved.

-- 1) Clean up any duplicate pair that already exists: keep the accepted row if either side was
--    accepted, otherwise keep the older one. Deterministic tie-break by ctid so exactly one
--    row survives per pair (never both, never neither).
delete from friendships f
using friendships f2
where least(f.requester_id, f.addressee_id) = least(f2.requester_id, f2.addressee_id)
  and greatest(f.requester_id, f.addressee_id) = greatest(f2.requester_id, f2.addressee_id)
  and f.ctid <> f2.ctid
  and (
    (f.status = 'pending' and f2.status = 'accepted')
    or (f.status = f2.status and f.created_at > f2.created_at)
    or (f.status = f2.status and f.created_at = f2.created_at and f.ctid > f2.ctid)
  );

-- 2) Block it from ever happening again — one relationship row per unordered pair of people.
create unique index if not exists friendships_unordered_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
