-- Mirror of remote migration 20261025141751_homework_auth_schema
-- (project juxxddgkownhkxuofdjl). Already applied there.
-- Do not reset the remote database and do not re-apply this file on it.

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('student', 'teacher')),
  class_code text,
  seat_no text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher' and p.status = 'active'
  );
$$;

create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.username from public.profiles p where p.id = auth.uid();
$$;

create policy profiles_select_own_or_teacher
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());

create policy profiles_update_own_or_teacher
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_teacher())
  with check (id = auth.uid() or public.is_teacher());

create policy profiles_insert_teacher
  on public.profiles for insert to authenticated
  with check (public.is_teacher() or id = auth.uid());

-- Assignments
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_code text not null,
  title text not null,
  due_at timestamptz,
  accept_late boolean not null default true,
  late_score_factor numeric not null default 0.8,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

create policy assignments_select_authenticated
  on public.assignments for select to authenticated
  using (true);

create policy assignments_write_teacher
  on public.assignments for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Submission versions
create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  version_no int not null,
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  soft_deleted_at timestamptz,
  soft_deleted_by uuid references public.profiles (id),
  unique (assignment_id, student_id, version_no)
);

create index submission_versions_student_idx
  on public.submission_versions (assignment_id, student_id, version_no);

alter table public.submission_versions enable row level security;

create policy submissions_select_own_or_teacher
  on public.submission_versions for select to authenticated
  using (
    (student_id = auth.uid() and soft_deleted_at is null)
    or public.is_teacher()
  );

create policy submissions_insert_own_student
  on public.submission_versions for insert to authenticated
  with check (
    student_id = auth.uid()
    and soft_deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student' and p.status = 'active'
    )
  );

-- Students cannot update/delete; teachers soft-delete via update
create policy submissions_soft_delete_teacher
  on public.submission_versions for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Auto-create profile hook optional: leave for seed script

-- Seed placeholder assignments for 2D / 2H AI game
insert into public.assignments (class_code, title, due_at, accept_late, late_score_factor)
values
  ('2D', 'AI 小遊戲展示', null, true, 0.8),
  ('2H', 'AI 小遊戲展示', null, true, 0.8);
