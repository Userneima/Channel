create or replace function private.archive_round_impl(
    target_channel_id uuid,
    requested_mode text,
    requested_reason text default null
)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
    new_round_row public.channel_rounds;
    next_completion_snapshot jsonb;
    total_members integer;
    normal_ready boolean;
begin
    select *
    into channel_row
    from public.channels
    where id = target_channel_id
    for update;

    if channel_row.id is null or channel_row.current_round_id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
    end if;

    if not private.is_channel_admin(target_channel_id) then
        raise exception 'Only channel admins can archive the round.'
            using errcode = '42501';
    end if;

    select *
    into round_row
    from public.channel_rounds
    where id = channel_row.current_round_id
    for update;

    if round_row.id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
    end if;

    if round_row.lifecycle_status <> 'active' then
        raise exception 'Current round has already been archived.'
            using errcode = 'P0001';
    end if;

    if requested_mode not in ('normal', 'forced', 'pre_restore') then
        raise exception 'Unsupported archive mode.'
            using errcode = 'P0001';
    end if;

    if requested_mode = 'forced' and nullif(btrim(coalesce(requested_reason, '')), '') is null then
        raise exception 'Forced archive requires a reason.'
            using errcode = 'P0001';
    end if;

    update public.channels
    set round_operation_state = 'archiving',
        updated_at = now()
    where id = target_channel_id;

    perform set_config('app.round_operation_bypass', 'on', true);

    insert into public.channel_round_members (
        round_id,
        user_id,
        identity_id,
        display_name_snapshot,
        avatar_snapshot,
        role_snapshot,
        claim_post_id,
        claim_selected_at,
        guess_target_name_snapshot,
        guess_target_avatar_snapshot,
        guess_selected_at
    )
    select
        round_row.id,
        identities.user_id,
        identities.id,
        coalesce(nullif(identities.display_name, ''), '频道成员'),
        coalesce(identities.avatar_url, ''),
        coalesce(identities.role, 'member'),
        identities.current_claim_post_id,
        identities.current_claim_selected_at,
        identities.current_guess_name,
        identities.current_guess_avatar,
        identities.current_guess_selected_at
    from public.identities
    where identities.channel_id = target_channel_id
    on conflict (round_id, user_id) do update
    set identity_id = excluded.identity_id,
        display_name_snapshot = excluded.display_name_snapshot,
        avatar_snapshot = excluded.avatar_snapshot,
        role_snapshot = excluded.role_snapshot,
        claim_post_id = coalesce(public.channel_round_members.claim_post_id, excluded.claim_post_id),
        claim_selected_at = coalesce(public.channel_round_members.claim_selected_at, excluded.claim_selected_at),
        guess_target_name_snapshot = coalesce(public.channel_round_members.guess_target_name_snapshot, excluded.guess_target_name_snapshot),
        guess_target_avatar_snapshot = coalesce(public.channel_round_members.guess_target_avatar_snapshot, excluded.guess_target_avatar_snapshot),
        guess_selected_at = coalesce(public.channel_round_members.guess_selected_at, excluded.guess_selected_at),
        updated_at = now();

    next_completion_snapshot := private.build_round_completion_snapshot(round_row.id);
    total_members := coalesce((next_completion_snapshot ->> 'totalMembers')::integer, 0);
    normal_ready := round_row.current_stage = 'reveal'
        and total_members > 0
        and coalesce((next_completion_snapshot ->> 'wishDone')::integer, 0) = total_members
        and coalesce((next_completion_snapshot ->> 'claimDone')::integer, 0) = total_members
        and coalesce((next_completion_snapshot ->> 'deliveryDone')::integer, 0) = total_members
        and coalesce((next_completion_snapshot ->> 'guessDone')::integer, 0) = total_members
        and coalesce((next_completion_snapshot ->> 'revealDone')::integer, 0) = total_members;

    if requested_mode = 'normal' and not normal_ready then
        raise exception 'Normal archive requires a fully completed reveal stage.'
            using errcode = 'P0001';
    end if;

    update public.channel_rounds
    set lifecycle_status = 'archived',
        archive_mode = requested_mode,
        default_title = private.default_round_title(coalesce(started_at, now()), theme),
        title = coalesce(nullif(btrim(coalesce(title, '')), ''), private.default_round_title(coalesce(started_at, now()), theme)),
        completed_at = coalesce(completed_at, now()),
        force_archive_reason = case
            when requested_mode = 'forced' then btrim(requested_reason)
            when requested_mode = 'pre_restore' then nullif(btrim(coalesce(requested_reason, '')), '')
            else null
        end,
        completion_snapshot = next_completion_snapshot,
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    if requested_mode in ('normal', 'forced') then
        insert into public.channel_rounds (
            channel_id,
            lifecycle_status,
            archive_mode,
            title,
            default_title,
            theme,
            god_profile,
            current_stage,
            reveal_map,
            deadlines,
            started_at,
            completed_at,
            force_archive_reason,
            completion_snapshot,
            source_round_id,
            view_only_reason
        )
        values (
            target_channel_id,
            'active',
            null,
            null,
            private.default_round_title(now(), null),
            null,
            null,
            'wish',
            '{}'::jsonb,
            private.default_round_deadlines(),
            now(),
            null,
            null,
            '{}'::jsonb,
            null,
            null
        )
        returning *
        into new_round_row;

        insert into public.channel_round_members (
            round_id,
            user_id,
            identity_id,
            display_name_snapshot,
            avatar_snapshot,
            role_snapshot
        )
        select
            new_round_row.id,
            identities.user_id,
            identities.id,
            coalesce(nullif(identities.display_name, ''), '频道成员'),
            coalesce(identities.avatar_url, ''),
            coalesce(identities.role, 'member')
        from public.identities
        where identities.channel_id = target_channel_id
        on conflict (round_id, user_id) do update
        set identity_id = excluded.identity_id,
            display_name_snapshot = excluded.display_name_snapshot,
            avatar_snapshot = excluded.avatar_snapshot,
            role_snapshot = excluded.role_snapshot,
            claim_post_id = null,
            claim_selected_at = null,
            guess_target_user_id = null,
            guess_target_name_snapshot = null,
            guess_target_avatar_snapshot = null,
            guess_selected_at = null,
            updated_at = now();

        update public.identities
        set current_claim_post_id = null,
            current_claim_selected_at = null,
            current_guess_name = null,
            current_guess_avatar = null,
            current_guess_selected_at = null,
            updated_at = now()
        where channel_id = target_channel_id;

        perform private.sync_channel_round_mirror(target_channel_id, new_round_row.id);
    else
        perform private.sync_channel_round_mirror(target_channel_id, round_row.id);
    end if;

    update public.channels
    set round_operation_state = 'idle',
        updated_at = now()
    where id = target_channel_id;

    return round_row;
end;
$$;
