create or replace function public.ensure_channel_identity(target_channel_id uuid)
returns public.identities
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    existing_identity public.identities;
    profile_row public.profiles;
    user_email text;
    resolved_display_name text;
begin
    if (select auth.uid()) is null or private.current_user_is_anonymous() then
        raise exception 'Anonymous users cannot initialize channel identity.'
            using errcode = '42501';
    end if;

    select *
    into existing_identity
    from public.identities
    where channel_id = target_channel_id
      and user_id = (select auth.uid())
    limit 1;

    if existing_identity.id is not null then
        perform private.ensure_default_alias_sessions(existing_identity.id, target_channel_id);
        return existing_identity;
    end if;

    select *
    into profile_row
    from public.profiles
    where id = (select auth.uid());

    select email
    into user_email
    from auth.users
    where id = (select auth.uid());

    resolved_display_name := nullif(btrim(coalesce(profile_row.display_name, '')), '');
    if resolved_display_name is null then
        resolved_display_name := nullif(split_part(coalesce(user_email, ''), '@', 1), '');
    end if;
    if resolved_display_name is null then
        resolved_display_name := '频道成员';
    end if;

    insert into public.identities (
        channel_id,
        user_id,
        display_name,
        avatar_url,
        role
    )
    values (
        target_channel_id,
        (select auth.uid()),
        resolved_display_name,
        nullif(profile_row.avatar_url, ''),
        'member'
    )
    returning *
    into existing_identity;

    perform private.ensure_default_alias_sessions(existing_identity.id, target_channel_id);

    return existing_identity;
end;
$$;

grant execute on function public.ensure_channel_identity(uuid) to authenticated;
