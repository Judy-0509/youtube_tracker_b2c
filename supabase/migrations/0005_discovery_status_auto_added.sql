-- ============================================================
-- 0005 — discovery_candidates status에 'auto_added' 값 추가
-- ============================================================

alter table public.discovery_candidates
  drop constraint if exists discovery_candidates_status_check;

alter table public.discovery_candidates
  add constraint discovery_candidates_status_check
    check (status in ('pending', 'approved', 'rejected', 'auto_added'));
