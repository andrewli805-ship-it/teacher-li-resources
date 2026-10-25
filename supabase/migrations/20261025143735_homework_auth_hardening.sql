-- Phase-1 hardening on top of 20261025141751_homework_auth_schema.
-- Non-destructive: no table drops, no data reset.
-- Moves SECURITY DEFINER helpers out of the exposed public schema,
-- stops students from editing role/status, and makes submission versions
-- append-only except for a teacher's soft-delete columns.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'teacher'
      and p.status = 'active'
  );
$$;

create or replace function private.current_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.username
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function private.is_teacher() from public;
revoke all on function private.current_username() from public;
grant execute on function private.is_teacher() to authenticated, service_role;
grant execute on function private.current_username() to authenticated, service_role;

-- Version numbers, lateness, and class match are decided here so the
-- browser cannot forge them. security definer sees soft-deleted rows,
-- which students cannot, so version_no does not get reused.
create or replace function private.guard_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
  v_accept boolean;
  v_class text;
  v_student_class text;
  v_next integer;
begin
  if tg_op = 'DELETE' then
    if (select auth.uid()) is not null then
      raise exception 'hard_delete_forbidden';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if (select auth.uid()) is null then
      return new;
    end if;
    if not (select private.is_teacher()) then
      raise exception 'teacher_only';
    end if;
    if new.id is distinct from old.id
       or new.assignment_id is distinct from old.assignment_id
       or new.student_id is distinct from old.student_id
       or new.version_no is distinct from old.version_no
       or new.payload is distinct from old.payload
       or new.submitted_at is distinct from old.submitted_at
       or new.is_late is distinct from old.is_late
    then
      raise exception 'soft_delete_only';
    end if;
    if new.soft_deleted_at is not null and old.soft_deleted_at is null then
      new.soft_deleted_by := (select auth.uid());
    elsif new.soft_deleted_at is null then
      new.soft_deleted_by := null;
    end if;
    return new;
  end if;

  if (select auth.uid()) is not null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    ) then
      raise exception 'not_student';
    end if;

    new.student_id := (select auth.uid());
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.assignment_id::text || new.student_id::text, 0)
    );

    select coalesce(max(v.version_no), 0) + 1
      into v_next
    from public.submission_versions v
    where v.assignment_id = new.assignment_id
      and v.student_id = new.student_id;
    new.version_no := v_next;
    new.submitted_at := pg_catalog.now();
    new.soft_deleted_at := null;
    new.soft_deleted_by := null;

    select a.due_at, a.accept_late, a.class_code
      into v_due, v_accept, v_class
    from public.assignments a
    where a.id = new.assignment_id;
    if not found then
      raise exception 'assignment_missing';
    end if;

    select p.class_code
      into v_student_class
    from public.profiles p
    where p.id = (select auth.uid());
    if v_student_class is distinct from v_class then
      raise exception 'wrong_class';
    end if;

    if v_due is not null and new.submitted_at > v_due then
      if not v_accept then
        raise exception 'late_closed';
      end if;
      new.is_late := true;
    else
      new.is_late := false;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if (select auth.uid()) is not null then
      raise exception 'hard_delete_forbidden';
    end if;
    return old;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if not (select private.is_teacher()) then
    raise exception 'teacher_only';
  end if;

  if tg_op = 'UPDATE' and new.id = (select auth.uid()) then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
    then
      raise exception 'cannot_change_own_role_or_status';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'cannot_change_profile_id';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_submission() from public;
revoke all on function private.guard_profile() from public;
grant execute on function private.guard_submission() to authenticated, service_role;
grant execute on function private.guard_profile() to authenticated, service_role;

drop trigger if exists submission_versions_guard on public.submission_versions;
create trigger submission_versions_guard
  before insert or update or delete on public.submission_versions
  for each row execute function private.guard_submission();

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update or delete on public.profiles
  for each row execute function private.guard_profile();

drop policy if exists profiles_select_own_or_teacher on public.profiles;
drop policy if exists profiles_update_own_or_teacher on public.profiles;
drop policy if exists profiles_insert_teacher on public.profiles;
drop policy if exists assignments_select_authenticated on public.assignments;
drop policy if exists assignments_write_teacher on public.assignments;
drop policy if exists submissions_select_own_or_teacher on public.submission_versions;
drop policy if exists submissions_insert_own_student on public.submission_versions;
drop policy if exists submissions_soft_delete_teacher on public.submission_versions;

create policy profiles_select_own_or_teacher
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_teacher())
  );

create policy profiles_insert_teacher
  on public.profiles for insert to authenticated
  with check ((select private.is_teacher()));

create policy profiles_update_teacher
  on public.profiles for update to authenticated
  using ((select private.is_teacher()))
  with check ((select private.is_teacher()));

create policy assignments_select_authenticated
  on public.assignments for select to authenticated
  using (true);

create policy assignments_insert_teacher
  on public.assignments for insert to authenticated
  with check ((select private.is_teacher()));

create policy assignments_update_teacher
  on public.assignments for update to authenticated
  using ((select private.is_teacher()))
  with check ((select private.is_teacher()));

create policy submissions_select_own_or_teacher
  on public.submission_versions for select to authenticated
  using (
    (
      student_id = (select auth.uid())
      and soft_deleted_at is null
    )
    or (select private.is_teacher())
  );

create policy submissions_insert_own_student
  on public.submission_versions for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and soft_deleted_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
  );

create policy submissions_soft_delete_teacher
  on public.submission_versions for update to authenticated
  using ((select private.is_teacher()))
  with check ((select private.is_teacher()));

drop function if exists public.is_teacher();
drop function if exists public.current_username();

revoke all on table public.profiles from anon, public;
revoke all on table public.assignments from anon, public;
revoke all on table public.submission_versions from anon, public;

revoke all on table public.profiles from authenticated;
grant select, insert on table public.profiles to authenticated;
grant update (username, role, class_code, seat_no, status)
  on table public.profiles to authenticated;

revoke all on table public.assignments from authenticated;
grant select, insert, update on table public.assignments to authenticated;

revoke all on table public.submission_versions from authenticated;
grant select, insert on table public.submission_versions to authenticated;
grant update (soft_deleted_at, soft_deleted_by)
  on table public.submission_versions to authenticated;

alter table public.assignments
  add constraint assignments_late_score_factor_check
  check (late_score_factor >= 0 and late_score_factor <= 1);

alter table public.submission_versions
  add constraint submission_versions_version_no_check
  check (version_no >= 1);

alter table public.submission_versions
  add constraint submission_versions_payload_object_check
  check (jsonb_typeof(payload) = 'object');

alter table public.submission_versions
  add constraint submission_versions_payload_size_check
  check (octet_length(payload::text) <= 20000);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create index if not exists submission_versions_student_active_idx
  on public.submission_versions (student_id, assignment_id, version_no)
  where soft_deleted_at is null;

create index if not exists submission_versions_assignment_submitted_idx
  on public.submission_versions (assignment_id, submitted_at desc);
