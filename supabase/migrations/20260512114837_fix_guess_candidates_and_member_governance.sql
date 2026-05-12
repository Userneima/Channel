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
    order by
        case role
            when 'owner' then 0
            when 'admin' then 1
            else 2
        end,
        created_at asc
    limit 1;

    if actor_identity.id is null or actor_identity.role not in ('owner', 'admin') then
        raise exception 'Only channel admins can remove members.'
            using errcode = '42501';
    end if;

    if target_identity.role = 'owner' then
        raise exception 'Owner cannot be removed.'
            using errcode = '42501';
    end if;

    if target_identity.user_id = (select auth.uid()) then
        if target_identity.id = actor_identity.id then
            raise exception 'You cannot remove the active identity that grants your current access.'
                using errcode = '42501';
        end if;

        if actor_identity.role = 'admin' and target_identity.role <> 'member' then
            raise exception 'Admins can only remove their own duplicate member identity.'
                using errcode = '42501';
        end if;

        if actor_identity.role = 'owner' and target_identity.role not in ('admin', 'member') then
            raise exception 'Owners can only remove their own duplicate lower-privilege identities.'
                using errcode = '42501';
        end if;
    elsif actor_identity.role = 'admin' and target_identity.role <> 'member' then
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
