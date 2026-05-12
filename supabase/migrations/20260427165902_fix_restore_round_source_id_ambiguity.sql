create or replace function private.restore_archived_round_impl(source_round_id uuid)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    target_source_round_id uuid := source_round_id;
    source_round public.channel_rounds;
    channel_row public.channels;
    current_round public.channel_rounds;
    new_round public.channel_rounds;
    stage_values text[] := array['wish', 'claim', 'delivery', 'guess', 'reveal'];
    stage_name text;
    stage_index integer;
    missing_participant text;
    source_post record;
    source_comment record;
    source_member record;
    new_post_id uuid;
    new_comment_id uuid;
begin
    select *
    into source_round
    from public.channel_rounds
    where id = target_source_round_id
    for update;

    if source_round.id is null then
        raise exception 'Archived round not found.'
            using errcode = 'P0002';
    end if;

    select *
    into channel_row
    from public.channels
    where id = source_round.channel_id
    for update;

    if not private.is_channel_admin(channel_row.id) then
        raise exception 'Only channel admins can restore an archived round.'
            using errcode = '42501';
    end if;

    if source_round.lifecycle_status <> 'archived' then
        raise exception 'Only archived rounds can be restored.'
            using errcode = 'P0001';
    end if;

    if source_round.archive_mode = 'legacy_summary' or source_round.view_only_reason is not null then
        raise exception 'This archive is view-only and cannot be restored.'
            using errcode = 'P0001';
    end if;

    select m.display_name_snapshot
    into missing_participant
    from public.channel_round_members m
    left join public.identities i
      on i.channel_id = source_round.channel_id
     and i.user_id = m.user_id
    where m.round_id = source_round.id
      and i.id is null
    order by m.display_name_snapshot
    limit 1;

    if missing_participant is not null then
        raise exception 'Participant % is no longer in this channel, so the archive cannot be restored.', missing_participant
            using errcode = 'P0001';
    end if;

    stage_index := coalesce(array_position(stage_values, source_round.current_stage), 1);
    foreach stage_name in array stage_values[stage_index:array_length(stage_values, 1)]
    loop
        if nullif(source_round.deadlines -> stage_name ->> 'deadlineAt', '') is null then
            raise exception 'This archive is missing an absolute deadline and cannot be restored.'
                using errcode = 'P0001';
        end if;

        if (source_round.deadlines -> stage_name ->> 'deadlineAt')::timestamptz <= now() then
            raise exception 'The restore deadline for stage % has already passed.', stage_name
                using errcode = 'P0001';
        end if;
    end loop;

    update public.channels
    set round_operation_state = 'restoring',
        updated_at = now()
    where id = channel_row.id;

    perform set_config('app.round_operation_bypass', 'on', true);

    if channel_row.current_round_id is not null then
        select *
        into current_round
        from public.channel_rounds
        where id = channel_row.current_round_id
        for update;

        if current_round.id is not null and current_round.lifecycle_status = 'active' then
            if private.round_is_dirty(current_round.id) then
                perform private.archive_round_impl(channel_row.id, 'pre_restore', '恢复其他回合前自动保存');
            else
                delete from public.channel_round_members where round_id = current_round.id;
                delete from public.comments where round_id = current_round.id;
                delete from public.posts where round_id = current_round.id;
                delete from public.channel_rounds where id = current_round.id;
            end if;
        end if;
    end if;

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
        source_round.channel_id,
        'active',
        null,
        source_round.title,
        source_round.default_title,
        source_round.theme,
        source_round.god_profile,
        source_round.current_stage,
        source_round.reveal_map,
        source_round.deadlines,
        source_round.started_at,
        null,
        null,
        '{}'::jsonb,
        source_round.id,
        null
    )
    returning *
    into new_round;

    create temporary table restore_post_map (
        old_post_id uuid primary key,
        new_post_id uuid not null
    ) on commit drop;

    create temporary table restore_comment_map (
        old_comment_id uuid primary key,
        new_comment_id uuid not null,
        old_parent_comment_id uuid
    ) on commit drop;

    for source_post in
        select *
        from public.posts
        where round_id = source_round.id
        order by created_at asc, id asc
    loop
        insert into public.posts (
            channel_id,
            round_id,
            board_slug,
            identity_id,
            alias_session_id,
            body,
            media,
            ai_disclosure,
            views_count,
            likes_count,
            shares_count,
            comments_count,
            deleted_at,
            deleted_by,
            deleted_snapshot,
            author_snapshot,
            created_at,
            updated_at
        )
        values (
            source_post.channel_id,
            new_round.id,
            source_post.board_slug,
            source_post.identity_id,
            source_post.alias_session_id,
            source_post.body,
            source_post.media,
            source_post.ai_disclosure,
            source_post.views_count,
            source_post.likes_count,
            source_post.shares_count,
            source_post.comments_count,
            source_post.deleted_at,
            source_post.deleted_by,
            source_post.deleted_snapshot,
            source_post.author_snapshot,
            source_post.created_at,
            source_post.updated_at
        )
        returning id
        into new_post_id;

        insert into restore_post_map (old_post_id, new_post_id)
        values (source_post.id, new_post_id);
    end loop;

    for source_comment in
        select *
        from public.comments
        where round_id = source_round.id
        order by created_at asc, id asc
    loop
        insert into public.comments (
            post_id,
            channel_id,
            round_id,
            identity_id,
            alias_session_id,
            body,
            likes_count,
            parent_comment_id,
            deleted_at,
            deleted_by,
            deleted_snapshot,
            author_snapshot,
            created_at,
            updated_at
        )
        values (
            (select new_post_id from restore_post_map where old_post_id = source_comment.post_id),
            source_comment.channel_id,
            new_round.id,
            source_comment.identity_id,
            source_comment.alias_session_id,
            source_comment.body,
            source_comment.likes_count,
            null,
            source_comment.deleted_at,
            source_comment.deleted_by,
            source_comment.deleted_snapshot,
            source_comment.author_snapshot,
            source_comment.created_at,
            source_comment.updated_at
        )
        returning id
        into new_comment_id;

        insert into restore_comment_map (old_comment_id, new_comment_id, old_parent_comment_id)
        values (source_comment.id, new_comment_id, source_comment.parent_comment_id);
    end loop;

    update public.comments new_comments
    set parent_comment_id = parent_map.new_comment_id
    from restore_comment_map self_map
    left join restore_comment_map parent_map
      on parent_map.old_comment_id = self_map.old_parent_comment_id
    where new_comments.id = self_map.new_comment_id;

    for source_member in
        select *
        from public.channel_round_members
        where round_id = source_round.id
        order by created_at asc, id asc
    loop
        insert into public.channel_round_members (
            round_id,
            user_id,
            identity_id,
            display_name_snapshot,
            avatar_snapshot,
            role_snapshot,
            claim_post_id,
            claim_selected_at,
            guess_target_user_id,
            guess_target_name_snapshot,
            guess_target_avatar_snapshot,
            guess_selected_at,
            created_at,
            updated_at
        )
        select
            new_round.id,
            source_member.user_id,
            identities.id,
            source_member.display_name_snapshot,
            source_member.avatar_snapshot,
            source_member.role_snapshot,
            (select new_post_id from restore_post_map where old_post_id = source_member.claim_post_id),
            source_member.claim_selected_at,
            source_member.guess_target_user_id,
            source_member.guess_target_name_snapshot,
            source_member.guess_target_avatar_snapshot,
            source_member.guess_selected_at,
            source_member.created_at,
            source_member.updated_at
        from public.identities
        where identities.channel_id = source_round.channel_id
          and identities.user_id = source_member.user_id;
    end loop;

    update public.identities identities
    set current_claim_post_id = members.claim_post_id,
        current_claim_selected_at = members.claim_selected_at,
        current_guess_name = members.guess_target_name_snapshot,
        current_guess_avatar = members.guess_target_avatar_snapshot,
        current_guess_selected_at = members.guess_selected_at,
        updated_at = now()
    from public.channel_round_members members
    where members.round_id = new_round.id
      and members.user_id = identities.user_id
      and identities.channel_id = new_round.channel_id;

    perform private.sync_channel_round_mirror(new_round.channel_id, new_round.id);

    update public.channels
    set current_round_id = new_round.id,
        round_operation_state = 'idle',
        updated_at = now()
    where id = new_round.channel_id;

    select *
    into new_round
    from public.channel_rounds
    where id = new_round.id;

    return new_round;
end;
$$;
