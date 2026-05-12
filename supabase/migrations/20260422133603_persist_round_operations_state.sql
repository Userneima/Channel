alter table public.channels
    add column if not exists current_round_stage text not null default 'wish',
    add column if not exists current_round_status text not null default 'active',
    add column if not exists current_round_deadlines jsonb not null default '{}'::jsonb,
    add column if not exists current_round_started_at timestamptz,
    add column if not exists current_round_completed_at timestamptz;

alter table public.channels
    drop constraint if exists channels_current_round_stage_check,
    add constraint channels_current_round_stage_check
        check (current_round_stage in ('wish', 'claim', 'delivery', 'guess', 'reveal'));

alter table public.channels
    drop constraint if exists channels_current_round_status_check,
    add constraint channels_current_round_status_check
        check (current_round_status in ('active', 'archived'));

create or replace function public.reset_channel_round_progress(target_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
    if not private.is_channel_admin(target_channel_id) then
        raise exception 'Only channel admins can reset round progress.'
            using errcode = '42501';
    end if;

    update public.identities
    set current_claim_post_id = null,
        current_claim_selected_at = null,
        current_guess_name = null,
        current_guess_avatar = null,
        current_guess_selected_at = null,
        updated_at = now()
    where channel_id = target_channel_id;
end;
$$;

grant execute on function public.reset_channel_round_progress(uuid) to authenticated;
