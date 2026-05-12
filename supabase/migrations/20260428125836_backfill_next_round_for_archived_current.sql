do $$
declare
    channel_row record;
    next_round_row public.channel_rounds;
begin
    perform set_config('app.round_operation_bypass', 'on', true);

    for channel_row in
        select channels.id
        from public.channels
        join public.channel_rounds
          on channel_rounds.id = channels.current_round_id
        where channel_rounds.lifecycle_status = 'archived'
    loop
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
            channel_row.id,
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
        into next_round_row;

        insert into public.channel_round_members (
            round_id,
            user_id,
            identity_id,
            display_name_snapshot,
            avatar_snapshot,
            role_snapshot
        )
        select
            next_round_row.id,
            identities.user_id,
            identities.id,
            coalesce(nullif(identities.display_name, ''), '频道成员'),
            coalesce(identities.avatar_url, ''),
            coalesce(identities.role, 'member')
        from public.identities
        where identities.channel_id = channel_row.id
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
        where channel_id = channel_row.id;

        perform private.sync_channel_round_mirror(channel_row.id, next_round_row.id);

        update public.channels
        set round_operation_state = 'idle',
            updated_at = now()
        where id = channel_row.id;
    end loop;
end;
$$;
