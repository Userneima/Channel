create or replace function private.is_channel_owner(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
    select exists (
        select 1
        from public.identities membership
        where membership.channel_id = target_channel_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'owner'
    );
$$;

create or replace function public.list_channel_members(target_channel_id uuid)
returns table (
    identity_id uuid,
    user_id uuid,
    display_name text,
    avatar_url text,
    role text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
    if not private.is_channel_admin(target_channel_id) then
        raise exception 'Only channel admins can view the member directory.'
            using errcode = '42501';
    end if;

    return query
    select
        identity_row.id,
        identity_row.user_id,
        identity_row.display_name,
        identity_row.avatar_url,
        identity_row.role,
        identity_row.created_at
    from public.identities identity_row
    where identity_row.channel_id = target_channel_id
    order by
        case identity_row.role
            when 'owner' then 0
            when 'admin' then 1
            else 2
        end,
        identity_row.created_at asc,
        identity_row.display_name asc;
end;
$$;

create or replace function public.set_channel_member_role(target_identity_id uuid, next_role text)
returns public.identities
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    target_identity public.identities;
    normalized_next_role text;
begin
    normalized_next_role := lower(trim(coalesce(next_role, '')));
    if normalized_next_role not in ('admin', 'member') then
        raise exception 'Only admin/member role changes are supported.'
            using errcode = 'P0001';
    end if;

    select *
    into target_identity
    from public.identities
    where id = target_identity_id
    for update;

    if target_identity.id is null then
        raise exception 'Channel member not found.'
            using errcode = 'P0002';
    end if;

    if not private.is_channel_owner(target_identity.channel_id) then
        raise exception 'Only the channel owner can edit member roles.'
            using errcode = '42501';
    end if;

    if target_identity.role = 'owner' then
        raise exception 'Owner role cannot be changed.'
            using errcode = '42501';
    end if;

    if target_identity.user_id = (select auth.uid()) and normalized_next_role = 'member' then
        raise exception 'Owner cannot remove their own management access.'
            using errcode = '42501';
    end if;

    if target_identity.role = normalized_next_role then
        return target_identity;
    end if;

    update public.identities
    set role = normalized_next_role,
        updated_at = now()
    where id = target_identity.id
    returning *
    into target_identity;

    return target_identity;
end;
$$;

create or replace function public.remove_channel_member(target_identity_id uuid)
returns public.identities
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    target_identity public.identities;
    actor_identity public.identities;
begin
    select *
    into target_identity
    from public.identities
    where id = target_identity_id
    for update;

    if target_identity.id is null then
        raise exception 'Channel member not found.'
            using errcode = 'P0002';
    end if;

    select *
    into actor_identity
    from public.identities
    where channel_id = target_identity.channel_id
      and user_id = (select auth.uid())
    limit 1;

    if actor_identity.id is null or actor_identity.role not in ('owner', 'admin') then
        raise exception 'Only channel admins can remove members.'
            using errcode = '42501';
    end if;

    if target_identity.user_id = (select auth.uid()) then
        raise exception 'You cannot remove yourself from the channel.'
            using errcode = '42501';
    end if;

    if target_identity.role = 'owner' then
        raise exception 'Owner cannot be removed.'
            using errcode = '42501';
    end if;

    if actor_identity.role = 'admin' and target_identity.role <> 'member' then
        raise exception 'Admins can only remove regular members.'
            using errcode = '42501';
    end if;

    update public.channel_join_requests
    set status = 'cancelled',
        review_note = coalesce(review_note, '成员已被移出频道'),
        reviewed_by = (select auth.uid()),
        reviewed_at = now(),
        updated_at = now()
    where channel_id = target_identity.channel_id
      and user_id = target_identity.user_id
      and status = 'pending';

    delete from public.identities
    where id = target_identity.id;

    return target_identity;
end;
$$;

grant execute on function private.is_channel_owner(uuid) to authenticated;
grant execute on function public.list_channel_members(uuid) to authenticated;
grant execute on function public.set_channel_member_role(uuid, text) to authenticated;
grant execute on function public.remove_channel_member(uuid) to authenticated;
