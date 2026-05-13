create or replace function public.list_registered_users()
returns table (
    user_id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
    user_row record;
begin
    if not exists (
        select 1
        from auth.users
        where id = auth.uid()
          and lower(coalesce(auth.users.email, '')) = 'wyc1186164839@gmail.com'
    ) then
        raise exception 'Only the designated platform operator can view registered users.'
            using errcode = '42501';
    end if;

    for user_row in
        select
            users.id::uuid as user_id,
            coalesce(users.email, '')::text as user_email,
            coalesce(
                nullif(profiles.display_name, ''),
                nullif(users.raw_user_meta_data ->> 'display_name', ''),
                nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
                '未命名用户'
            )::text as user_display_name,
            coalesce(
                nullif(profiles.avatar_url, ''),
                nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
                ''
            )::text as user_avatar_url,
            users.created_at::timestamptz as user_created_at,
            users.last_sign_in_at::timestamptz as user_last_sign_in_at
        from auth.users users
        left join public.profiles profiles
            on profiles.id = users.id
        order by users.created_at desc nulls last, users.email asc nulls last
    loop
        user_id := user_row.user_id;
        email := user_row.user_email;
        display_name := user_row.user_display_name;
        avatar_url := user_row.user_avatar_url;
        created_at := user_row.user_created_at;
        last_sign_in_at := user_row.user_last_sign_in_at;
        return next;
    end loop;

    return;
end;
$$;

grant execute on function public.list_registered_users() to authenticated;
