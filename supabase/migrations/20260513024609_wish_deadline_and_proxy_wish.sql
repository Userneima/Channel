create or replace function private.author_snapshot_user_id(snapshot jsonb)
returns uuid
language plpgsql
immutable
set search_path = pg_temp
as $$
declare
    raw_user_id text;
begin
    raw_user_id := nullif(coalesce(snapshot -> 'realIdentity' ->> 'userId', ''), '');
    if raw_user_id is null then
        return null;
    end if;

    return raw_user_id::uuid;
exception
    when invalid_text_representation then
        return null;
end;
$$;

create or replace function private.extract_wish_meta(raw_media jsonb)
returns jsonb
language sql
immutable
set search_path = pg_temp
as $$
    select item
    from jsonb_array_elements(
        case
            when jsonb_typeof(coalesce(raw_media, '[]'::jsonb)) = 'array' then coalesce(raw_media, '[]'::jsonb)
            else '[]'::jsonb
        end
    ) item
    where lower(coalesce(item ->> 'kind', '')) = 'wish_meta'
    limit 1;
$$;

create or replace function private.resolve_wish_participant_user_id(raw_media jsonb, author_snapshot jsonb)
returns uuid
language plpgsql
immutable
set search_path = pg_temp
as $$
declare
    wish_meta jsonb;
    raw_user_id text;
begin
    wish_meta := private.extract_wish_meta(raw_media);
    raw_user_id := coalesce(
        nullif(coalesce(wish_meta ->> 'participantUserId', ''), ''),
        nullif(coalesce(author_snapshot -> 'realIdentity' ->> 'userId', ''), '')
    );

    if raw_user_id is null then
        return null;
    end if;

    return raw_user_id::uuid;
exception
    when invalid_text_representation then
        return null;
end;
$$;

create or replace function private.member_has_wish_submission(target_round_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from public.posts post_row
        where post_row.round_id = target_round_id
          and post_row.board_slug = 'wish'
          and post_row.deleted_at is null
          and private.resolve_wish_participant_user_id(post_row.media, post_row.author_snapshot) = target_user_id
    );
$$;

create or replace function private.can_proxy_wish_submission(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
    select
        private.is_channel_admin(target_channel_id)
        or exists (
            select 1
            from public.channels channel_row
            join public.channel_rounds round_row
              on round_row.id = channel_row.current_round_id
            where channel_row.id = target_channel_id
              and nullif(coalesce(round_row.god_profile ->> 'userId', ''), '') = (select auth.uid())::text
        );
$$;

create or replace function private.prepare_round_scoped_post()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    participant_identity public.identities;
    wish_meta jsonb;
    sanitized_media jsonb := '[]'::jsonb;
    actor_user_id uuid;
    participant_user_id uuid;
    participant_name text;
    participant_avatar text;
    submission_source text;
begin
    select *
    into channel_row
    from public.channels
    where id = new.channel_id;

    if channel_row.id is null then
        raise exception 'Channel not found.'
            using errcode = 'P0002';
    end if;

    if new.round_id is null then
        new.round_id := channel_row.current_round_id;
    end if;

    perform private.round_write_guard(new.channel_id, new.round_id);

    if coalesce(new.author_snapshot, '{}'::jsonb) = '{}'::jsonb then
        new.author_snapshot := private.build_author_snapshot(new.identity_id, new.alias_session_id);
    end if;

    actor_user_id := private.author_snapshot_user_id(new.author_snapshot);

    if new.board_slug = 'wish' then
        wish_meta := coalesce(private.extract_wish_meta(new.media), '{}'::jsonb);
        participant_user_id := private.resolve_wish_participant_user_id(new.media, new.author_snapshot);

        if participant_user_id is null then
            raise exception 'Wish participant is required.'
                using errcode = 'P0001';
        end if;

        select *
        into participant_identity
        from public.identities
        where channel_id = new.channel_id
          and user_id = participant_user_id;

        if participant_identity.id is null then
            raise exception 'Wish participant is not a channel member.'
                using errcode = 'P0002';
        end if;

        if actor_user_id is null then
            raise exception 'Wish author is not initialized.'
                using errcode = '42501';
        end if;

        submission_source := case
            when participant_user_id = actor_user_id then 'self'
            else 'proxy'
        end;

        if submission_source = 'proxy' and not private.can_proxy_wish_submission(new.channel_id) then
            raise exception 'Only the current god or channel admins can proxy wish submissions.'
                using errcode = '42501';
        end if;

        participant_name := coalesce(
            nullif(coalesce(wish_meta ->> 'participantName', ''), ''),
            nullif(coalesce(participant_identity.display_name, ''), ''),
            '频道成员'
        );
        participant_avatar := coalesce(
            nullif(coalesce(wish_meta ->> 'participantAvatar', ''), ''),
            coalesce(participant_identity.avatar_url, '')
        );

        select coalesce(jsonb_agg(item), '[]'::jsonb)
        into sanitized_media
        from jsonb_array_elements(
            case
                when jsonb_typeof(coalesce(new.media, '[]'::jsonb)) = 'array' then coalesce(new.media, '[]'::jsonb)
                else '[]'::jsonb
            end
        ) item
        where lower(coalesce(item ->> 'kind', '')) <> 'wish_meta';

        new.media := sanitized_media || jsonb_build_array(
            jsonb_build_object(
                'kind', 'wish_meta',
                'participantUserId', participant_identity.user_id,
                'participantName', participant_name,
                'participantAvatar', participant_avatar,
                'submissionSource', submission_source,
                'recordedByUserId', actor_user_id,
                'recordedByName', coalesce(
                    nullif(coalesce(new.author_snapshot -> 'realIdentity' ->> 'displayName', ''), ''),
                    '频道成员'
                )
            )
        );
    end if;

    if new.board_slug in ('delivery', 'guess') then
        if actor_user_id is null or not private.member_has_wish_submission(new.round_id, actor_user_id) then
            raise exception 'Only current round participants can submit in this stage.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

create or replace function private.build_round_completion_snapshot(target_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    eligible_members integer := 0;
    participant_members integer := 0;
    claim_done integer := 0;
    delivery_done integer := 0;
    guess_done integer := 0;
    reveal_done integer := 0;
    missing_wish jsonb := '[]'::jsonb;
    missing_claim jsonb := '[]'::jsonb;
    missing_delivery jsonb := '[]'::jsonb;
    missing_guess jsonb := '[]'::jsonb;
    missing_reveal jsonb := '[]'::jsonb;
begin
    with member_rows as (
        select
            member_row.*,
            private.member_has_wish_submission(target_round_id, member_row.user_id) as wish_submitted,
            exists (
                select 1
                from public.posts post_row
                where post_row.round_id = target_round_id
                  and post_row.board_slug = 'delivery'
                  and post_row.deleted_at is null
                  and coalesce(
                      post_row.author_snapshot -> 'realIdentity' ->> 'userId',
                      null
                  ) = member_row.user_id::text
            ) as delivery_submitted,
            exists (
                select 1
                from jsonb_each(coalesce(round_row.reveal_map, '{}'::jsonb)) reveal_item
                where coalesce(
                    reveal_item.value -> 'member' ->> 'userId',
                    reveal_item.key
                ) in (member_row.user_id::text, member_row.display_name_snapshot)
            ) as reveal_ready
        from public.channel_round_members member_row
        join public.channel_rounds round_row
          on round_row.id = member_row.round_id
        where member_row.round_id = target_round_id
    )
    select
        count(*),
        count(*) filter (where wish_submitted),
        count(*) filter (where wish_submitted and claim_post_id is not null),
        count(*) filter (where wish_submitted and delivery_submitted),
        count(*) filter (
            where wish_submitted
              and coalesce(
                  nullif(btrim(coalesce(guess_target_name_snapshot, '')), ''),
                  nullif(guess_target_user_id::text, '')
              ) is not null
        ),
        count(*) filter (where wish_submitted and reveal_ready),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where not wish_submitted), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where wish_submitted and claim_post_id is null), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where wish_submitted and not delivery_submitted), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (
            where wish_submitted
              and coalesce(
                  nullif(btrim(coalesce(guess_target_name_snapshot, '')), ''),
                  nullif(guess_target_user_id::text, '')
              ) is null
        ), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where wish_submitted and not reveal_ready), '[]'::jsonb)
    into
        eligible_members,
        participant_members,
        claim_done,
        delivery_done,
        guess_done,
        reveal_done,
        missing_wish,
        missing_claim,
        missing_delivery,
        missing_guess,
        missing_reveal
    from member_rows;

    return jsonb_build_object(
        'eligibleMembers', eligible_members,
        'participantMembers', participant_members,
        'totalMembers', participant_members,
        'wishDone', participant_members,
        'claimDone', claim_done,
        'deliveryDone', delivery_done,
        'guessDone', guess_done,
        'revealDone', reveal_done,
        'readyForClaim', participant_members > 0,
        'readyForDelivery', (participant_members > 0 and claim_done = participant_members),
        'readyForGuess', (participant_members > 0 and delivery_done = participant_members),
        'readyForReveal', (participant_members > 0 and reveal_done = participant_members),
        'missingWishNames', missing_wish,
        'missingClaimNames', missing_claim,
        'missingDeliveryNames', missing_delivery,
        'missingGuessNames', missing_guess,
        'missingRevealNames', missing_reveal
    );
end;
$$;

create or replace function private.set_current_round_claim_selection_impl(target_channel_id uuid, target_post_id uuid)
returns public.channel_round_members
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    member_row public.channel_round_members;
    target_post public.posts;
    wish_owner_user_id uuid;
begin
    member_row := private.ensure_current_round_member_impl(target_channel_id);

    if not private.member_has_wish_submission(member_row.round_id, member_row.user_id) then
        raise exception 'Only current round participants can claim a wish.'
            using errcode = '42501';
    end if;

    select *
    into target_post
    from public.posts
    where id = target_post_id
      and channel_id = target_channel_id
      and round_id = member_row.round_id
      and board_slug = 'wish'
      and deleted_at is null;

    if target_post.id is null then
        raise exception 'Wish post not found in the current round.'
            using errcode = 'P0002';
    end if;

    wish_owner_user_id := private.resolve_wish_participant_user_id(target_post.media, target_post.author_snapshot);
    if wish_owner_user_id = member_row.user_id then
        raise exception 'You cannot claim your own wish.'
            using errcode = '42501';
    end if;

    update public.channel_round_members
    set claim_post_id = target_post.id,
        claim_selected_at = now(),
        updated_at = now()
    where id = member_row.id
    returning *
    into member_row;

    update public.identities
    set current_claim_post_id = target_post.id,
        current_claim_selected_at = member_row.claim_selected_at,
        updated_at = now()
    where id = member_row.identity_id;

    return member_row;
end;
$$;

create or replace function private.set_current_round_guess_selection_impl(
    target_channel_id uuid,
    target_guess_user_id uuid,
    target_guess_name text,
    target_guess_avatar text default null
)
returns public.channel_round_members
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    member_row public.channel_round_members;
    target_identity public.identities;
    normalized_name text;
    normalized_avatar text;
begin
    member_row := private.ensure_current_round_member_impl(target_channel_id);

    if not private.member_has_wish_submission(member_row.round_id, member_row.user_id) then
        raise exception 'Only current round participants can submit a guess.'
            using errcode = '42501';
    end if;

    normalized_name := nullif(btrim(coalesce(target_guess_name, '')), '');
    normalized_avatar := coalesce(target_guess_avatar, '');

    if target_guess_user_id is not null then
        if not private.member_has_wish_submission(member_row.round_id, target_guess_user_id) then
            raise exception 'Guess target must be a current round participant.'
                using errcode = '42501';
        end if;

        select *
        into target_identity
        from public.identities
        where channel_id = target_channel_id
          and user_id = target_guess_user_id;

        if target_identity.id is null then
            raise exception 'Guess target not found.'
                using errcode = 'P0002';
        end if;

        normalized_name := coalesce(nullif(target_identity.display_name, ''), normalized_name);
        normalized_avatar := coalesce(target_identity.avatar_url, normalized_avatar);
    end if;

    if target_guess_user_id = member_row.user_id or normalized_name = member_row.display_name_snapshot then
        raise exception 'You cannot guess yourself.'
            using errcode = '42501';
    end if;

    if normalized_name is null then
        raise exception 'Guess target is required.'
            using errcode = 'P0001';
    end if;

    update public.channel_round_members
    set guess_target_user_id = target_guess_user_id,
        guess_target_name_snapshot = normalized_name,
        guess_target_avatar_snapshot = normalized_avatar,
        guess_selected_at = now(),
        updated_at = now()
    where id = member_row.id
    returning *
    into member_row;

    update public.identities
    set current_guess_name = normalized_name,
        current_guess_avatar = normalized_avatar,
        current_guess_selected_at = member_row.guess_selected_at,
        updated_at = now()
    where id = member_row.identity_id;

    return member_row;
end;
$$;

create or replace function public.sync_current_round_wish_deadline(target_channel_id uuid)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
    wish_deadline_at timestamptz;
begin
    if (select auth.uid()) is null or private.current_user_is_anonymous() then
        raise exception 'Only authenticated members can sync the round deadline.'
            using errcode = '42501';
    end if;

    select *
    into channel_row
    from public.channels
    where id = target_channel_id
    for update;

    if channel_row.id is null or channel_row.current_round_id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
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

    if round_row.lifecycle_status <> 'active' or round_row.current_stage <> 'wish' then
        return round_row;
    end if;

    wish_deadline_at := nullif(round_row.deadlines -> 'wish' ->> 'deadlineAt', '')::timestamptz;
    if wish_deadline_at is null or wish_deadline_at > now() then
        return round_row;
    end if;

    update public.channel_rounds
    set current_stage = 'claim',
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    perform private.sync_channel_round_mirror(target_channel_id, round_row.id);

    return round_row;
end;
$$;

grant execute on function private.author_snapshot_user_id(jsonb) to authenticated;
grant execute on function private.extract_wish_meta(jsonb) to authenticated;
grant execute on function private.resolve_wish_participant_user_id(jsonb, jsonb) to authenticated;
grant execute on function private.member_has_wish_submission(uuid, uuid) to authenticated;
grant execute on function private.can_proxy_wish_submission(uuid) to authenticated;
grant execute on function public.sync_current_round_wish_deadline(uuid) to authenticated;
