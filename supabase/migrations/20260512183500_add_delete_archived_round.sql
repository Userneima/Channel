create or replace function private.delete_archived_round_impl(target_round_id uuid)
returns uuid
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
        raise exception 'Only archived rounds can be deleted.'
            using errcode = 'P0001';
    end if;

    if not private.is_channel_admin(round_row.channel_id) then
        raise exception 'Only channel admins can delete archives.'
            using errcode = '42501';
    end if;

    if exists (
        select 1
        from public.channels
        where current_round_id = round_row.id
    ) then
        raise exception 'Current round cannot be deleted.'
            using errcode = 'P0001';
    end if;

    delete from public.channel_rounds
    where id = round_row.id;

    return round_row.id;
end;
$$;

create or replace function public.delete_archived_round(target_round_id uuid)
returns uuid
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select private.delete_archived_round_impl(target_round_id);
$$;

grant execute on function private.delete_archived_round_impl(uuid) to authenticated;
grant execute on function public.delete_archived_round(uuid) to authenticated;
