create or replace function private.get_current_channel_identity(target_channel_id uuid)
returns table (
    identity_id uuid,
    role text,
    display_name text,
    avatar_url text
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
    select
        identity_row.id,
        identity_row.role,
        identity_row.display_name,
        identity_row.avatar_url
    from public.identities identity_row
    where identity_row.channel_id = target_channel_id
      and identity_row.user_id = (select auth.uid())
    order by
        case identity_row.role
            when 'owner' then 0
            when 'admin' then 1
            else 2
        end asc,
        identity_row.updated_at desc,
        identity_row.created_at desc
    limit 1;
$$;
