drop policy if exists "Users can create their own identity" on public.identities;

create policy "Users can create their own identity"
on public.identities
for insert
to authenticated
with check (
    not private.current_user_is_anonymous()
    and (select auth.uid()) = identities.user_id
);
