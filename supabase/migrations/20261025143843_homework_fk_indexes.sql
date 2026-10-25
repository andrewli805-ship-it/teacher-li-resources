-- Cover foreign keys flagged by the performance advisor.
-- Already applied on project juxxddgkownhkxuofdjl as 20261025143843.

create index if not exists assignments_created_by_idx
  on public.assignments (created_by);

create index if not exists submission_versions_soft_deleted_by_idx
  on public.submission_versions (soft_deleted_by);
