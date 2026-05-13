create or replace function private.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
    select exists (
        select 1
        from auth.users
        where id = auth.uid()
          and lower(coalesce(email, '')) = 'wyc1186164839@gmail.com'
    );
$$;

create or replace function private.list_registered_users()
returns table (
    user_id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
    if not private.is_platform_operator() then
        raise exception 'Only the designated platform operator can view registered users.'
            using errcode = '42501';
    end if;

    return query
    select
        users.id,
        users.email,
        coalesce(
            nullif(profiles.display_name, ''),
            nullif(users.raw_user_meta_data ->> 'display_name', ''),
            nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
            '未命名用户'
        ) as display_name,
        coalesce(
            nullif(profiles.avatar_url, ''),
            nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
            ''
        ) as avatar_url,
        users.created_at,
        users.last_sign_in_at
    from auth.users users
    left join public.profiles profiles
        on profiles.id = users.id
    order by users.created_at desc, users.email asc;
end;
$$;

create or replace function public.list_registered_users()
returns table (
    user_id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
language sql
stable
security invoker
set search_path = public, private, auth, pg_temp
as $$
    select *
    from private.list_registered_users();
$$;

grant execute on function public.list_registered_users() to authenticated;
