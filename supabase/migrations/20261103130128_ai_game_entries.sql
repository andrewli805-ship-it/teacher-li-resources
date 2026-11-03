-- AI mini-game exhibition for 2627 2D and 2H.
-- Non-destructive: does not drop tables, rows, or existing policies on
-- profiles, assignments, or submission_versions.
--
-- Why a new table: submission_versions is append-only per auth user, and
-- private.guard_submission() forces student_id = auth.uid() plus the
-- profile class. The shared student account submits for classmates, and
-- the same year + class + student number updates one row. Public reads
-- must not open other homework payloads.
--
-- Due dates stay on the existing one-assignment-per-class rows.
-- Authorization uses public.profiles (role, status), same as
-- private.is_teacher(). It does not read user_metadata.
-- Applied on project juxxddgkownhkxuofdjl as 20261103130128.
-- Do not reset that database and do not re-apply this file on it.

alter table public.assignments
  add column if not exists kind text not null default 'homework';

alter table public.assignments
  drop constraint if exists assignments_kind_check;

alter table public.assignments
  add constraint assignments_kind_check
  check (kind in ('homework', 'ai_game'));

comment on column public.assignments.kind is
  'homework: versioned portal work. ai_game: one row per class for the exhibition due date.';

update public.assignments
set kind = 'ai_game'
where class_code in ('2D', '2H')
  and title = 'AI 小遊戲展示'
  and kind = 'homework';

create unique index if not exists assignments_one_ai_game_per_class
  on public.assignments (class_code)
  where kind = 'ai_game';

insert into public.assignments (class_code, title, due_at, accept_late, late_score_factor, kind)
select seed.class_code, 'AI 小遊戲展示', null, true, 0.8, 'ai_game'
from (values ('2D'), ('2H')) as seed(class_code)
where not exists (
  select 1
  from public.assignments a
  where a.kind = 'ai_game'
    and a.class_code = seed.class_code
);

create table if not exists public.ai_game_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  school_year integer not null,
  class_code text not null,
  student_no integer not null,
  student_name text not null,
  game_url text not null,
  submitted_at timestamptz not null default pg_catalog.now(),
  is_late boolean not null default false,
  submitted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint ai_game_entries_year_check check (school_year between 2000 and 9999),
  constraint ai_game_entries_class_check check (class_code in ('2D', '2H')),
  constraint ai_game_entries_seat_check check (student_no between 1 and 99),
  constraint ai_game_entries_name_check check (
    char_length(student_name) between 1 and 80
    and student_name !~ '[[:cntrl:]]'
  ),
  constraint ai_game_entries_url_check check (
    char_length(game_url) between 8 and 2000
    and game_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint ai_game_entries_identity_key unique (school_year, class_code, student_no)
);

comment on table public.ai_game_entries is
  'One current AI mini-game link per school year, class, and student number.';

create index if not exists ai_game_entries_class_seat_idx
  on public.ai_game_entries (class_code, student_no);

create index if not exists ai_game_entries_class_submitted_idx
  on public.ai_game_entries (class_code, submitted_at desc);

create index if not exists ai_game_entries_assignment_idx
  on public.ai_game_entries (assignment_id);

create index if not exists ai_game_entries_submitted_by_idx
  on public.ai_game_entries (submitted_by);

alter table public.ai_game_entries enable row level security;
alter table public.ai_game_entries force row level security;

create or replace function private.is_active_student()
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
      and p.role = 'student'
      and p.status = 'active'
  );
$$;

revoke all on function private.is_active_student() from public;
grant execute on function private.is_active_student() to authenticated, service_role;

create or replace function private.guard_ai_game_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher boolean;
  v_student boolean;
  v_assignment uuid;
  v_due timestamptz;
  v_accept boolean;
begin
  if tg_op = 'DELETE' then
    if (select auth.uid()) is not null then
      raise exception 'hard_delete_forbidden';
    end if;
    return old;
  end if;

  v_teacher := (select private.is_teacher());
  v_student := (select private.is_active_student());
  if (select auth.uid()) is null or (not v_teacher and not v_student) then
    raise exception 'not_student';
  end if;

  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'bad_id';
  end if;

  new.student_name := btrim(coalesce(new.student_name, ''));
  new.game_url := btrim(coalesce(new.game_url, ''));
  new.class_code := btrim(coalesce(new.class_code, ''));

  if new.class_code not in ('2D', '2H') then
    raise exception 'bad_class';
  end if;
  if new.school_year is null or new.school_year < 2000 or new.school_year > 9999 then
    raise exception 'bad_year';
  end if;
  if new.student_no is null or new.student_no < 1 or new.student_no > 99 then
    raise exception 'bad_seat';
  end if;
  if new.student_name = '' or char_length(new.student_name) > 80 or new.student_name ~ '[[:cntrl:]]' then
    raise exception 'bad_name';
  end if;
  if new.game_url !~* '^https?://[^[:space:]]+$' or char_length(new.game_url) > 2000 then
    raise exception 'bad_url';
  end if;

  if not v_teacher and tg_op = 'UPDATE' then
    if new.class_code is distinct from old.class_code then
      raise exception 'teacher_only';
    end if;
    if (
      new.school_year is distinct from old.school_year
      or new.student_no is distinct from old.student_no
    ) and old.submitted_by is distinct from (select auth.uid()) then
      raise exception 'teacher_only';
    end if;
  end if;

  select a.id, a.due_at, a.accept_late
    into v_assignment, v_due, v_accept
  from public.assignments a
  where a.kind = 'ai_game'
    and a.class_code = new.class_code;

  if not found then
    raise exception 'assignment_missing';
  end if;

  new.assignment_id := v_assignment;
  new.updated_at := pg_catalog.now();

  if v_teacher and tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;
    new.is_late := old.is_late;
    new.submitted_by := old.submitted_by;
    return new;
  end if;

  if not v_teacher and v_due is not null and pg_catalog.now() > v_due and not v_accept then
    raise exception 'late_closed';
  end if;

  new.submitted_at := pg_catalog.now();
  new.submitted_by := (select auth.uid());
  new.is_late := v_due is not null and pg_catalog.now() > v_due;
  return new;
end;
$$;

revoke all on function private.guard_ai_game_entry() from public;
grant execute on function private.guard_ai_game_entry() to authenticated, service_role;

drop trigger if exists ai_game_entries_guard on public.ai_game_entries;
create trigger ai_game_entries_guard
  before insert or update or delete on public.ai_game_entries
  for each row execute function private.guard_ai_game_entry();

drop policy if exists ai_game_entries_select_anon on public.ai_game_entries;
drop policy if exists ai_game_entries_select_role on public.ai_game_entries;
drop policy if exists ai_game_entries_insert_role on public.ai_game_entries;
drop policy if exists ai_game_entries_update_role on public.ai_game_entries;

create policy ai_game_entries_select_anon
  on public.ai_game_entries
  for select
  to anon
  using (class_code in ('2D', '2H'));

create policy ai_game_entries_select_role
  on public.ai_game_entries
  for select
  to authenticated
  using (
    (select private.is_active_student())
    or (select private.is_teacher())
  );

create policy ai_game_entries_insert_role
  on public.ai_game_entries
  for insert
  to authenticated
  with check (
    (select private.is_active_student())
    or (select private.is_teacher())
  );

create policy ai_game_entries_update_role
  on public.ai_game_entries
  for update
  to authenticated
  using (
    (select private.is_active_student())
    or (select private.is_teacher())
  )
  with check (
    (select private.is_active_student())
    or (select private.is_teacher())
  );

revoke all on table public.ai_game_entries from anon, authenticated, public;

grant select (school_year, class_code, student_no, student_name, game_url, submitted_at)
  on table public.ai_game_entries to anon;

grant select, insert, update
  on table public.ai_game_entries to authenticated;

notify pgrst, 'reload schema';
