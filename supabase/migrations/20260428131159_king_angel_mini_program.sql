create table if not exists public.wechat_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    openid text not null,
    unionid text,
    session_version integer not null default 1 check (session_version > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_login_at timestamptz not null default now(),
    unique (user_id),
    unique (openid),
    unique (unionid)
);

create index if not exists wechat_accounts_user_idx
    on public.wechat_accounts (user_id);

alter table public.wechat_accounts enable row level security;

drop policy if exists "Users can view their own WeChat account" on public.wechat_accounts;
create policy "Users can view their own WeChat account"
on public.wechat_accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.bump_wechat_accounts_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists wechat_accounts_touch_updated_at on public.wechat_accounts;
create trigger wechat_accounts_touch_updated_at
before update on public.wechat_accounts
for each row execute procedure private.bump_wechat_accounts_updated_at();
