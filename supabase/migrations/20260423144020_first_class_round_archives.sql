create table if not exists public.channel_rounds (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels (id) on delete cascade,
    lifecycle_status text not null default 'active'
        check (lifecycle_status in ('active', 'archived')),
    archive_mode text
        check (archive_mode is null or archive_mode in ('normal', 'forced', 'pre_restore', 'legacy_summary')),
    title text,
    default_title text not null default '未命名回合',
    theme text,
    god_profile jsonb,
    current_stage text not null default 'wish'
        check (current_stage in ('wish', 'claim', 'delivery', 'guess', 'reveal')),
    reveal_map jsonb not null default '{}'::jsonb,
    deadlines jsonb not null default '{}'::jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    force_archive_reason text,
    completion_snapshot jsonb not null default '{}'::jsonb,
    source_round_id uuid references public.channel_rounds (id) on delete set null,
    view_only_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.channel_round_members (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references public.channel_rounds (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    identity_id uuid references public.identities (id) on delete set null,
    display_name_snapshot text not null,
    avatar_snapshot text,
    role_snapshot text not null default 'member'
        check (role_snapshot in ('owner', 'admin', 'member')),
    claim_post_id uuid references public.posts (id) on delete set null,
    claim_selected_at timestamptz,
    guess_target_user_id uuid references auth.users (id) on delete set null,
    guess_target_name_snapshot text,
    guess_target_avatar_snapshot text,
    guess_selected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (round_id, user_id)
);

create index if not exists channel_rounds_channel_archived_idx
    on public.channel_rounds (channel_id, lifecycle_status, completed_at desc, created_at desc);
create index if not exists channel_rounds_source_round_idx
    on public.channel_rounds (source_round_id);
create index if not exists channel_round_members_round_idx
    on public.channel_round_members (round_id, display_name_snapshot);
create index if not exists channel_round_members_round_user_idx
    on public.channel_round_members (round_id, user_id);

alter table public.channels
    add column if not exists current_round_id uuid,
    add column if not exists round_operation_state text not null default 'idle';

alter table public.channels
    drop constraint if exists channels_round_operation_state_check,
    add constraint channels_round_operation_state_check
        check (round_operation_state in ('idle', 'archiving', 'restoring'));

alter table public.channels
    drop constraint if exists channels_current_round_id_fkey,
    add constraint channels_current_round_id_fkey
        foreign key (current_round_id) references public.channel_rounds (id) on delete set null;

alter table public.posts
    add column if not exists round_id uuid references public.channel_rounds (id) on delete set null,
    add column if not exists author_snapshot jsonb not null default '{}'::jsonb;

alter table public.comments
    add column if not exists round_id uuid references public.channel_rounds (id) on delete set null,
    add column if not exists author_snapshot jsonb not null default '{}'::jsonb;

create index if not exists channels_current_round_idx on public.channels (current_round_id);
create index if not exists posts_round_created_at_idx on public.posts (round_id, created_at desc);
create index if not exists posts_round_board_idx on public.posts (round_id, board_slug);
create index if not exists comments_round_created_at_idx on public.comments (round_id, created_at asc);

create or replace function private.default_round_deadlines()
returns jsonb
language sql
immutable
set search_path = pg_temp
as $$
    select jsonb_build_object(
        'wish', jsonb_build_object('label', '周二 22:00 前完成', 'deadlineAt', null),
        'claim', jsonb_build_object('label', '统一开启后每人只能选 1 个', 'deadlineAt', null),
        'delivery', jsonb_build_object('label', '周六 18:00 前完成', 'deadlineAt', null),
        'guess', jsonb_build_object('label', '每人有限次数，猜完统一揭晓', 'deadlineAt', null),
        'reveal', jsonb_build_object('label', '全员猜完后公布答案', 'deadlineAt', null)
    );
$$;

create or replace function private.normalize_round_deadlines(raw_deadlines jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_temp
as $$
declare
    stage_name text;
    entry jsonb;
    normalized jsonb := private.default_round_deadlines();
begin
    foreach stage_name in array array['wish', 'claim', 'delivery', 'guess', 'reveal']
    loop
        entry := coalesce(raw_deadlines -> stage_name, 'null'::jsonb);

        if jsonb_typeof(entry) = 'object' then
            normalized := jsonb_set(
                normalized,
                array[stage_name],
                jsonb_build_object(
                    'label', coalesce(nullif(entry ->> 'label', ''), normalized -> stage_name ->> 'label'),
                    'deadlineAt', nullif(entry ->> 'deadlineAt', '')
                ),
                true
            );
        elsif jsonb_typeof(entry) = 'string' then
            normalized := jsonb_set(
                normalized,
                array[stage_name],
                jsonb_build_object(
                    'label', trim(both '"' from entry::text),
                    'deadlineAt', null
                ),
                true
            );
        end if;
    end loop;

    return normalized;
end;
$$;

create or replace function private.default_round_title(target_started_at timestamptz, target_theme text)
returns text
language sql
stable
set search_path = pg_temp
as $$
    select concat(
        to_char(
            date_trunc(
                'week',
                timezone('Asia/Shanghai', coalesce(target_started_at, now()))
            ),
            'YYYY.MM.DD'
        ),
        ' · ',
        coalesce(nullif(btrim(target_theme), ''), '未命名回合')
    );
$$;

create or replace function private.build_author_snapshot(target_identity_id uuid, target_alias_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
    identity_row public.identities;
    alias_row public.alias_sessions;
begin
    if target_alias_session_id is not null then
        select *
        into alias_row
        from public.alias_sessions
        where id = target_alias_session_id;

        select *
        into identity_row
        from public.identities
        where id = alias_row.identity_id;

        return jsonb_build_object(
            'kind', 'alias',
            'displayName', coalesce(alias_row.display_name, '匿名成员'),
            'avatarUrl', coalesce(alias_row.avatar_url, ''),
            'slotKey', alias_row.slot_key,
            'realIdentity', jsonb_build_object(
                'id', identity_row.id,
                'userId', identity_row.user_id,
                'displayName', coalesce(identity_row.display_name, '频道成员'),
                'avatarUrl', coalesce(identity_row.avatar_url, ''),
                'role', coalesce(identity_row.role, 'member')
            )
        );
    end if;

    if target_identity_id is not null then
        select *
        into identity_row
        from public.identities
        where id = target_identity_id;

        return jsonb_build_object(
            'kind', 'identity',
            'displayName', coalesce(identity_row.display_name, '频道成员'),
            'avatarUrl', coalesce(identity_row.avatar_url, ''),
            'realIdentity', jsonb_build_object(
                'id', identity_row.id,
                'userId', identity_row.user_id,
                'displayName', coalesce(identity_row.display_name, '频道成员'),
                'avatarUrl', coalesce(identity_row.avatar_url, ''),
                'role', coalesce(identity_row.role, 'member')
            )
        );
    end if;

    return jsonb_build_object(
        'kind', 'unknown',
        'displayName', '频道成员',
        'avatarUrl', '',
        'realIdentity', jsonb_build_object(
            'id', null,
            'userId', null,
            'displayName', '频道成员',
            'avatarUrl', '',
            'role', 'member'
        )
    );
end;
$$;

create or replace function private.round_write_guard(target_channel_id uuid, target_round_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
begin
    if current_setting('app.round_operation_bypass', true) = 'on' then
        return;
    end if;

    select *
    into channel_row
    from public.channels
    where id = target_channel_id;

    if channel_row.id is null then
        raise exception 'Channel not found.'
            using errcode = 'P0002';
    end if;

    if channel_row.round_operation_state <> 'idle' then
        raise exception 'Round operation is in progress.'
            using errcode = '42501';
    end if;

    if target_round_id is not null then
        select *
        into round_row
        from public.channel_rounds
        where id = target_round_id;

        if round_row.id is null then
            raise exception 'Round not found.'
                using errcode = 'P0002';
        end if;

        if round_row.lifecycle_status <> 'active' then
            raise exception 'Archived rounds are read-only.'
                using errcode = '42501';
        end if;
    end if;
end;
$$;

create or replace function private.prepare_round_scoped_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    channel_row public.channels;
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

    return new;
end;
$$;

drop trigger if exists posts_prepare_round_scope on public.posts;
create trigger posts_prepare_round_scope
before insert or update on public.posts
for each row
execute function private.prepare_round_scoped_post();

create or replace function private.prepare_round_scoped_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    channel_row public.channels;
    post_row public.posts;
begin
    select *
    into channel_row
    from public.channels
    where id = new.channel_id;

    if channel_row.id is null then
        raise exception 'Channel not found.'
            using errcode = 'P0002';
    end if;

    select *
    into post_row
    from public.posts
    where id = new.post_id;

    if post_row.id is null then
        raise exception 'Post not found.'
            using errcode = 'P0002';
    end if;

    if new.round_id is null then
        new.round_id := post_row.round_id;
    end if;

    perform private.round_write_guard(new.channel_id, new.round_id);

    if coalesce(new.author_snapshot, '{}'::jsonb) = '{}'::jsonb then
        new.author_snapshot := private.build_author_snapshot(new.identity_id, new.alias_session_id);
    end if;

    return new;
end;
$$;

drop trigger if exists comments_prepare_round_scope on public.comments;
create trigger comments_prepare_round_scope
before insert or update on public.comments
for each row
execute function private.prepare_round_scoped_comment();

create or replace function private.prepare_round_member_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    round_row public.channel_rounds;
begin
    if tg_op = 'DELETE' then
        select *
        into round_row
        from public.channel_rounds
        where id = old.round_id;
    else
        select *
        into round_row
        from public.channel_rounds
        where id = new.round_id;
    end if;

    if round_row.id is null then
        raise exception 'Round not found.'
            using errcode = 'P0002';
    end if;

    perform private.round_write_guard(round_row.channel_id, round_row.id);

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;

drop trigger if exists round_members_prepare_write on public.channel_round_members;
create trigger round_members_prepare_write
before insert or update or delete on public.channel_round_members
for each row
execute function private.prepare_round_member_write();

create or replace function private.sync_identity_to_current_round()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
begin
    select *
    into channel_row
    from public.channels
    where id = new.channel_id;

    if channel_row.current_round_id is null then
        return new;
    end if;

    select *
    into round_row
    from public.channel_rounds
    where id = channel_row.current_round_id;

    if round_row.id is null or round_row.lifecycle_status <> 'active' then
        return new;
    end if;

    insert into public.channel_round_members (
        round_id,
        user_id,
        identity_id,
        display_name_snapshot,
        avatar_snapshot,
        role_snapshot
    )
    values (
        round_row.id,
        new.user_id,
        new.id,
        coalesce(nullif(new.display_name, ''), '频道成员'),
        coalesce(new.avatar_url, ''),
        coalesce(new.role, 'member')
    )
    on conflict (round_id, user_id) do update
    set identity_id = excluded.identity_id,
        display_name_snapshot = excluded.display_name_snapshot,
        avatar_snapshot = excluded.avatar_snapshot,
        role_snapshot = excluded.role_snapshot,
        updated_at = now();

    return new;
end;
$$;

drop trigger if exists identities_sync_current_round on public.identities;
create trigger identities_sync_current_round
after insert or update of display_name, avatar_url, role on public.identities
for each row
execute function private.sync_identity_to_current_round();

create or replace function private.sync_channel_round_mirror(target_channel_id uuid, target_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    round_row public.channel_rounds;
begin
    select *
    into round_row
    from public.channel_rounds
    where id = target_round_id;

    if round_row.id is null then
        raise exception 'Round not found.'
            using errcode = 'P0002';
    end if;

    update public.channels
    set current_round_id = round_row.id,
        current_round_theme = nullif(btrim(coalesce(round_row.theme, '')), ''),
        current_round_god_name = nullif(btrim(coalesce(round_row.god_profile ->> 'name', '')), ''),
        current_round_god_avatar = nullif(btrim(coalesce(round_row.god_profile ->> 'avatar', '')), ''),
        current_round_stage = round_row.current_stage,
        current_round_status = case when round_row.lifecycle_status = 'archived' then 'archived' else 'active' end,
        current_round_deadlines = round_row.deadlines,
        current_round_started_at = round_row.started_at,
        current_round_completed_at = round_row.completed_at,
        current_reveal_map = round_row.reveal_map,
        updated_at = now()
    where id = target_channel_id;
end;
$$;

create or replace function private.build_round_completion_snapshot(target_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    total_members integer := 0;
    wish_done integer := 0;
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
            m.*,
            exists (
                select 1
                from public.posts p
                where p.round_id = target_round_id
                  and p.board_slug = 'wish'
                  and p.deleted_at is null
                  and coalesce(
                      p.author_snapshot -> 'realIdentity' ->> 'userId',
                      null
                  ) = m.user_id::text
            ) as wish_submitted,
            exists (
                select 1
                from public.posts p
                where p.round_id = target_round_id
                  and p.board_slug = 'delivery'
                  and p.deleted_at is null
                  and coalesce(
                      p.author_snapshot -> 'realIdentity' ->> 'userId',
                      null
                  ) = m.user_id::text
            ) as delivery_submitted,
            exists (
                select 1
                from jsonb_each(coalesce(r.reveal_map, '{}'::jsonb)) reveal_item
                where coalesce(
                    reveal_item.value -> 'member' ->> 'userId',
                    reveal_item.key
                ) in (m.user_id::text, m.display_name_snapshot)
            ) as reveal_ready
        from public.channel_round_members m
        join public.channel_rounds r
          on r.id = m.round_id
        where m.round_id = target_round_id
    )
    select
        count(*),
        count(*) filter (where wish_submitted),
        count(*) filter (where claim_post_id is not null),
        count(*) filter (where delivery_submitted),
        count(*) filter (where coalesce(nullif(btrim(coalesce(guess_target_name_snapshot, '')), ''), nullif(guess_target_user_id::text, '')) is not null),
        count(*) filter (where reveal_ready),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where not wish_submitted), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where claim_post_id is null), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where not delivery_submitted), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where coalesce(nullif(btrim(coalesce(guess_target_name_snapshot, '')), ''), nullif(guess_target_user_id::text, '')) is null), '[]'::jsonb),
        coalesce(jsonb_agg(display_name_snapshot order by display_name_snapshot) filter (where not reveal_ready), '[]'::jsonb)
    into
        total_members,
        wish_done,
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
        'totalMembers', total_members,
        'wishDone', wish_done,
        'claimDone', claim_done,
        'deliveryDone', delivery_done,
        'guessDone', guess_done,
        'revealDone', reveal_done,
        'readyForClaim', (total_members > 0 and wish_done = total_members),
        'readyForDelivery', (total_members > 0 and claim_done = total_members),
        'readyForGuess', (total_members > 0 and delivery_done = total_members),
        'readyForReveal', (total_members > 0 and delivery_done = total_members and guess_done = total_members),
        'missingWishNames', missing_wish,
        'missingClaimNames', missing_claim,
        'missingDeliveryNames', missing_delivery,
        'missingGuessNames', missing_guess,
        'missingRevealNames', missing_reveal
    );
end;
$$;

create or replace function private.round_is_dirty(target_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with round_row as (
        select *
        from public.channel_rounds
        where id = target_round_id
    )
    select exists (
        select 1
        from round_row r
        where coalesce(nullif(btrim(coalesce(r.theme, '')), ''), null) is not null
           or coalesce(nullif(btrim(coalesce(r.god_profile ->> 'name', '')), ''), null) is not null
           or r.current_stage <> 'wish'
           or coalesce(r.reveal_map, '{}'::jsonb) <> '{}'::jsonb
           or exists (
               select 1
               from public.channel_round_members m
               where m.round_id = r.id
                 and (
                     m.claim_post_id is not null
                     or m.guess_target_user_id is not null
                     or nullif(btrim(coalesce(m.guess_target_name_snapshot, '')), '') is not null
                 )
           )
           or exists (
               select 1
               from public.posts p
               where p.round_id = r.id
           )
           or exists (
               select 1
               from public.comments c
               where c.round_id = r.id
           )
    );
$$;

create or replace function private.ensure_current_round_member_impl(target_channel_id uuid)
returns public.channel_round_members
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
    identity_row public.identities;
    member_row public.channel_round_members;
begin
    if private.current_user_is_anonymous() then
        raise exception 'Anonymous users cannot participate in rounds.'
            using errcode = '42501';
    end if;

    select *
    into channel_row
    from public.channels
    where id = target_channel_id;

    if channel_row.id is null or channel_row.current_round_id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
    end if;

    select *
    into round_row
    from public.channel_rounds
    where id = channel_row.current_round_id;

    if round_row.id is null or round_row.lifecycle_status <> 'active' then
        raise exception 'Current round is read-only.'
            using errcode = '42501';
    end if;

    select *
    into identity_row
    from public.identities
    where channel_id = target_channel_id
      and user_id = (select auth.uid());

    if identity_row.id is null then
        raise exception 'Current user is not a channel member.'
            using errcode = '42501';
    end if;

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
    values (
        round_row.id,
        identity_row.user_id,
        identity_row.id,
        coalesce(nullif(identity_row.display_name, ''), '频道成员'),
        coalesce(identity_row.avatar_url, ''),
        coalesce(identity_row.role, 'member'),
        identity_row.current_claim_post_id,
        identity_row.current_claim_selected_at,
        identity_row.current_guess_name,
        identity_row.current_guess_avatar,
        identity_row.current_guess_selected_at
    )
    on conflict (round_id, user_id) do update
    set identity_id = excluded.identity_id,
        display_name_snapshot = excluded.display_name_snapshot,
        avatar_snapshot = excluded.avatar_snapshot,
        role_snapshot = excluded.role_snapshot,
        updated_at = now()
    returning *
    into member_row;

    return member_row;
end;
$$;

create or replace function private.update_channel_current_round_state_impl(
    target_channel_id uuid,
    next_theme text,
    next_god_profile jsonb,
    next_stage text,
    next_status text,
    next_deadlines jsonb,
    next_started_at timestamptz,
    next_completed_at timestamptz,
    next_reveal_map jsonb
)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
    can_edit_theme boolean := false;
    normalized_next_stage text;
    normalized_next_status text;
    normalized_next_deadlines jsonb;
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
        raise exception 'Archived rounds are read-only.'
            using errcode = '42501';
    end if;

    normalized_next_stage := case
        when next_stage in ('wish', 'claim', 'delivery', 'guess', 'reveal') then next_stage
        else round_row.current_stage
    end;
    normalized_next_status := case
        when next_status = 'archived' then 'archived'
        else 'active'
    end;
    normalized_next_deadlines := private.normalize_round_deadlines(next_deadlines);

    can_edit_theme := private.is_channel_admin(target_channel_id)
        or coalesce(round_row.god_profile ->> 'userId', '') = coalesce((select auth.uid())::text, '');

    if not can_edit_theme then
        raise exception 'Only channel admins or the current god can update the round.'
            using errcode = '42501';
    end if;

    if not private.is_channel_admin(target_channel_id)
        and (
            normalized_next_stage is distinct from round_row.current_stage
            or normalized_next_status is distinct from round_row.lifecycle_status
            or normalized_next_deadlines is distinct from round_row.deadlines
            or coalesce(next_reveal_map, '{}'::jsonb) is distinct from round_row.reveal_map
            or coalesce(next_god_profile, '{}'::jsonb) is distinct from coalesce(round_row.god_profile, '{}'::jsonb)
        ) then
        raise exception 'Only channel admins can change the stage, deadlines, reveal map or god.'
            using errcode = '42501';
    end if;

    update public.channel_rounds
    set theme = nullif(btrim(coalesce(next_theme, '')), ''),
        god_profile = case
            when next_god_profile is null or next_god_profile = '{}'::jsonb then null
            else jsonb_build_object(
                'userId', nullif(coalesce(next_god_profile ->> 'userId', ''), ''),
                'name', nullif(coalesce(next_god_profile ->> 'name', ''), ''),
                'avatar', coalesce(next_god_profile ->> 'avatar', '')
            )
        end,
        current_stage = normalized_next_stage,
        lifecycle_status = normalized_next_status,
        deadlines = normalized_next_deadlines,
        started_at = next_started_at,
        completed_at = next_completed_at,
        reveal_map = coalesce(next_reveal_map, '{}'::jsonb),
        default_title = private.default_round_title(next_started_at, next_theme),
        title = coalesce(nullif(btrim(coalesce(title, '')), ''), private.default_round_title(next_started_at, next_theme)),
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    perform private.sync_channel_round_mirror(target_channel_id, round_row.id);

    return round_row;
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
begin
    member_row := private.ensure_current_round_member_impl(target_channel_id);

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

    if coalesce(target_post.author_snapshot -> 'realIdentity' ->> 'userId', '') = member_row.user_id::text then
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

create or replace function private.clear_current_round_claim_selection_impl(target_channel_id uuid)
returns public.channel_round_members
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    member_row public.channel_round_members;
begin
    member_row := private.ensure_current_round_member_impl(target_channel_id);

    update public.channel_round_members
    set claim_post_id = null,
        claim_selected_at = null,
        updated_at = now()
    where id = member_row.id
    returning *
    into member_row;

    update public.identities
    set current_claim_post_id = null,
        current_claim_selected_at = null,
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

    normalized_name := nullif(btrim(coalesce(target_guess_name, '')), '');
    normalized_avatar := coalesce(target_guess_avatar, '');

    if target_guess_user_id is not null then
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

create or replace function private.clear_current_round_guess_selection_impl(target_channel_id uuid)
returns public.channel_round_members
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    member_row public.channel_round_members;
begin
    member_row := private.ensure_current_round_member_impl(target_channel_id);

    update public.channel_round_members
    set guess_target_user_id = null,
        guess_target_name_snapshot = null,
        guess_target_avatar_snapshot = null,
        guess_selected_at = null,
        updated_at = now()
    where id = member_row.id
    returning *
    into member_row;

    update public.identities
    set current_guess_name = null,
        current_guess_avatar = null,
        current_guess_selected_at = null,
        updated_at = now()
    where id = member_row.identity_id;

    return member_row;
end;
$$;

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
    completion_snapshot jsonb;
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

    completion_snapshot := private.build_round_completion_snapshot(round_row.id);
    total_members := coalesce((completion_snapshot ->> 'totalMembers')::integer, 0);
    normal_ready := round_row.current_stage = 'reveal'
        and total_members > 0
        and coalesce((completion_snapshot ->> 'wishDone')::integer, 0) = total_members
        and coalesce((completion_snapshot ->> 'claimDone')::integer, 0) = total_members
        and coalesce((completion_snapshot ->> 'deliveryDone')::integer, 0) = total_members
        and coalesce((completion_snapshot ->> 'guessDone')::integer, 0) = total_members
        and coalesce((completion_snapshot ->> 'revealDone')::integer, 0) = total_members;

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
        completion_snapshot = completion_snapshot,
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    perform private.sync_channel_round_mirror(target_channel_id, round_row.id);

    update public.channels
    set round_operation_state = 'idle',
        updated_at = now()
    where id = target_channel_id;

    return round_row;
end;
$$;

create or replace function private.restore_archived_round_impl(source_round_id uuid)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
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
    where id = source_round_id
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

create or replace function private.rename_archived_round_impl(target_round_id uuid, next_title text)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    round_row public.channel_rounds;
begin
    select *
    into round_row
    from public.channel_rounds
    where id = target_round_id
    for update;

    if round_row.id is null then
        raise exception 'Archived round not found.'
            using errcode = 'P0002';
    end if;

    if round_row.lifecycle_status <> 'archived' then
        raise exception 'Only archived rounds can be renamed.'
            using errcode = 'P0001';
    end if;

    if not private.is_channel_admin(round_row.channel_id) then
        raise exception 'Only channel admins can rename archives.'
            using errcode = '42501';
    end if;

    update public.channel_rounds
    set title = coalesce(nullif(btrim(coalesce(next_title, '')), ''), default_title),
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    return round_row;
end;
$$;

create or replace function public.update_channel_current_round_state(
    target_channel_id uuid,
    next_theme text,
    next_god_profile jsonb,
    next_stage text,
    next_status text,
    next_deadlines jsonb,
    next_started_at timestamptz,
    next_completed_at timestamptz,
    next_reveal_map jsonb
)
returns public.channel_rounds
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select *
    from private.update_channel_current_round_state_impl(
        target_channel_id,
        next_theme,
        next_god_profile,
        next_stage,
        next_status,
        next_deadlines,
        next_started_at,
        next_completed_at,
        next_reveal_map
    );
$$;

create or replace function public.set_current_round_claim_selection(target_channel_id uuid, target_post_id uuid)
returns public.channel_round_members
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.set_current_round_claim_selection_impl(target_channel_id, target_post_id);
$$;

create or replace function public.clear_current_round_claim_selection(target_channel_id uuid)
returns public.channel_round_members
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.clear_current_round_claim_selection_impl(target_channel_id);
$$;

create or replace function public.set_current_round_guess_selection(
    target_channel_id uuid,
    target_guess_user_id uuid,
    target_guess_name text,
    target_guess_avatar text default null
)
returns public.channel_round_members
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.set_current_round_guess_selection_impl(target_channel_id, target_guess_user_id, target_guess_name, target_guess_avatar);
$$;

create or replace function public.clear_current_round_guess_selection(target_channel_id uuid)
returns public.channel_round_members
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.clear_current_round_guess_selection_impl(target_channel_id);
$$;

create or replace function public.archive_current_round(target_channel_id uuid, requested_mode text, requested_reason text default null)
returns public.channel_rounds
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.archive_round_impl(target_channel_id, requested_mode, requested_reason);
$$;

create or replace function public.restore_archived_round(source_round_id uuid)
returns public.channel_rounds
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.restore_archived_round_impl(source_round_id);
$$;

create or replace function public.rename_archived_round(target_round_id uuid, next_title text)
returns public.channel_rounds
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select * from private.rename_archived_round_impl(target_round_id, next_title);
$$;

create or replace function private.reset_channel_round_progress_impl(target_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    current_round_id uuid;
begin
    if not private.is_channel_admin(target_channel_id) then
        raise exception 'Only channel admins can reset round progress.'
            using errcode = '42501';
    end if;

    select current_round_id
    into current_round_id
    from public.channels
    where id = target_channel_id;

    update public.identities
    set current_claim_post_id = null,
        current_claim_selected_at = null,
        current_guess_name = null,
        current_guess_avatar = null,
        current_guess_selected_at = null,
        updated_at = now()
    where channel_id = target_channel_id;

    if current_round_id is not null then
        update public.channel_round_members
        set claim_post_id = null,
            claim_selected_at = null,
            guess_target_user_id = null,
            guess_target_name_snapshot = null,
            guess_target_avatar_snapshot = null,
            guess_selected_at = null,
            updated_at = now()
        where round_id = current_round_id;
    end if;
end;
$$;

create or replace function public.reset_channel_round_progress(target_channel_id uuid)
returns void
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select private.reset_channel_round_progress_impl(target_channel_id);
$$;

grant execute on function private.build_author_snapshot(uuid, uuid) to authenticated;
grant execute on function private.ensure_current_round_member_impl(uuid) to authenticated;
grant execute on function private.update_channel_current_round_state_impl(uuid, text, jsonb, text, text, jsonb, timestamptz, timestamptz, jsonb) to authenticated;
grant execute on function private.set_current_round_claim_selection_impl(uuid, uuid) to authenticated;
grant execute on function private.clear_current_round_claim_selection_impl(uuid) to authenticated;
grant execute on function private.set_current_round_guess_selection_impl(uuid, uuid, text, text) to authenticated;
grant execute on function private.clear_current_round_guess_selection_impl(uuid) to authenticated;
grant execute on function private.archive_round_impl(uuid, text, text) to authenticated;
grant execute on function private.restore_archived_round_impl(uuid) to authenticated;
grant execute on function private.rename_archived_round_impl(uuid, text) to authenticated;
grant execute on function private.reset_channel_round_progress_impl(uuid) to authenticated;
grant execute on function public.update_channel_current_round_state(uuid, text, jsonb, text, text, jsonb, timestamptz, timestamptz, jsonb) to authenticated;
grant execute on function public.set_current_round_claim_selection(uuid, uuid) to authenticated;
grant execute on function public.clear_current_round_claim_selection(uuid) to authenticated;
grant execute on function public.set_current_round_guess_selection(uuid, uuid, text, text) to authenticated;
grant execute on function public.clear_current_round_guess_selection(uuid) to authenticated;
grant execute on function public.archive_current_round(uuid, text, text) to authenticated;
grant execute on function public.restore_archived_round(uuid) to authenticated;
grant execute on function public.rename_archived_round(uuid, text) to authenticated;
grant execute on function public.reset_channel_round_progress(uuid) to authenticated;

alter table public.channel_rounds enable row level security;
alter table public.channel_round_members enable row level security;

drop policy if exists "Channel members can view rounds" on public.channel_rounds;
create policy "Channel members can view rounds"
on public.channel_rounds
for select
to authenticated
using (private.is_channel_member(channel_rounds.channel_id));

drop policy if exists "Channel members can view round members" on public.channel_round_members;
create policy "Channel members can view round members"
on public.channel_round_members
for select
to authenticated
using (
    exists (
        select 1
        from public.channel_rounds round_rows
        where round_rows.id = channel_round_members.round_id
          and private.is_channel_member(round_rows.channel_id)
    )
);

update public.posts
set author_snapshot = private.build_author_snapshot(identity_id, alias_session_id)
where coalesce(author_snapshot, '{}'::jsonb) = '{}'::jsonb;

update public.comments
set author_snapshot = private.build_author_snapshot(identity_id, alias_session_id)
where coalesce(author_snapshot, '{}'::jsonb) = '{}'::jsonb;

with prepared_rounds as (
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
    select
        channels.id,
        case
            when channels.current_round_status = 'archived' then 'archived'
            else 'active'
        end,
        case
            when channels.current_round_status = 'archived' and channels.current_round_stage = 'reveal' then 'normal'
            when channels.current_round_status = 'archived' then 'forced'
            else null
        end,
        private.default_round_title(channels.current_round_started_at, channels.current_round_theme),
        private.default_round_title(channels.current_round_started_at, channels.current_round_theme),
        nullif(btrim(coalesce(channels.current_round_theme, '')), ''),
        case
            when nullif(btrim(coalesce(channels.current_round_god_name, '')), '') is null then null
            else jsonb_build_object(
                'userId', null,
                'name', nullif(btrim(coalesce(channels.current_round_god_name, '')), ''),
                'avatar', coalesce(channels.current_round_god_avatar, '')
            )
        end,
        coalesce(channels.current_round_stage, 'wish'),
        coalesce(channels.current_reveal_map, '{}'::jsonb),
        private.normalize_round_deadlines(coalesce(channels.current_round_deadlines, '{}'::jsonb)),
        channels.current_round_started_at,
        channels.current_round_completed_at,
        case
            when channels.current_round_status = 'archived' and channels.current_round_stage <> 'reveal'
                then 'Migrated from legacy archived round state.'
            else null
        end,
        '{}'::jsonb,
        null,
        null
    from public.channels
    where channels.current_round_id is null
    returning id, channel_id
)
update public.channels
set current_round_id = prepared_rounds.id,
    round_operation_state = 'idle',
    updated_at = now()
from prepared_rounds
where prepared_rounds.channel_id = public.channels.id;

with channel_scope as (
    select
        channels.id as channel_id,
        channels.current_round_id,
        channels.current_round_started_at
    from public.channels
    where channels.current_round_id is not null
),
post_backfill as (
    update public.posts
    set round_id = channel_scope.current_round_id
    from channel_scope
    where public.posts.channel_id = channel_scope.channel_id
      and public.posts.round_id is null
      and coalesce(public.posts.board_slug, '') <> 'archive'
      and (
          channel_scope.current_round_started_at is null
          or public.posts.created_at >= channel_scope.current_round_started_at
      )
    returning public.posts.id, public.posts.channel_id
)
update public.comments
set round_id = posts.round_id
from public.posts
where public.comments.post_id = public.posts.id
  and public.comments.round_id is null
  and public.posts.round_id is not null;

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
    channels.current_round_id,
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
from public.channels
join public.identities
  on identities.channel_id = channels.id
where channels.current_round_id is not null
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

update public.channel_rounds
set completion_snapshot = private.build_round_completion_snapshot(public.channel_rounds.id),
    updated_at = now()
where lifecycle_status = 'archived'
  and archive_mode in ('normal', 'forced');

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
    view_only_reason,
    created_at,
    updated_at
)
select
    posts.channel_id,
    'archived',
    'legacy_summary',
    nullif(btrim(coalesce(entry.value ->> 'title', '')), ''),
    coalesce(
        nullif(btrim(coalesce(entry.value ->> 'title', '')), ''),
        private.default_round_title(
            nullif(entry.value ->> 'startedAt', '')::timestamptz,
            entry.value ->> 'theme'
        )
    ),
    nullif(btrim(coalesce(entry.value ->> 'theme', '')), ''),
    case
        when nullif(btrim(coalesce(entry.value -> 'godProfile' ->> 'name', '')), '') is null then null
        else jsonb_build_object(
            'userId', null,
            'name', nullif(btrim(coalesce(entry.value -> 'godProfile' ->> 'name', '')), ''),
            'avatar', coalesce(entry.value -> 'godProfile' ->> 'avatar', '')
        )
    end,
    coalesce(nullif(entry.value ->> 'stage', ''), 'reveal'),
    '{}'::jsonb,
    private.default_round_deadlines(),
    nullif(entry.value ->> 'startedAt', '')::timestamptz,
    nullif(entry.value ->> 'completedAt', '')::timestamptz,
    null,
    jsonb_build_object(
        'legacySummary', jsonb_build_object(
            'summaryLine', coalesce(entry.value ->> 'summaryLine', ''),
            'stats', coalesce(entry.value -> 'stats', '{}'::jsonb),
            'revealPairs', coalesce(entry.value -> 'revealPairs', '[]'::jsonb)
        )
    ),
    null,
    'legacy_deadline_unknown',
    posts.created_at,
    posts.created_at
from public.posts
cross join lateral jsonb_array_elements(coalesce(posts.media, '[]'::jsonb)) as entry(value)
where coalesce(posts.board_slug, '') = 'archive'
  and coalesce(entry.value ->> 'kind', '') = 'round_archive';
