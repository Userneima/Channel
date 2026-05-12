export const createIdentityAliasApi = (context) => ({
    async anonymizeAnonymousDraft(input) {
        return context.tryInvokeAnonymousAnonymizer(input);
    },
    async createAliasProfile(aliasKey, profile) {
        const client = context.getSupabaseClient();
        const aliasProfile = context.runtimeState.aliasProfiles.find((item) => item.key === aliasKey);
        if (!context.runtimeState.identity?.id || !context.runtimeState.channel?.id) {
            throw new Error("匿名马甲尚未初始化完成。");
        }

        if (aliasProfile?.id) {
            const retireResponse = await client
                .from("alias_sessions")
                .update({
                    status: "retired",
                    last_used_at: new Date().toISOString()
                })
                .eq("id", aliasProfile.id);

            if (retireResponse.error) {
                throw retireResponse.error;
            }
        }

        const nextSlotKey = context.createAliasSlotKey();
        const { error: insertError } = await client
            .from("alias_sessions")
            .insert({
                channel_id: context.runtimeState.channel.id,
                identity_id: context.runtimeState.identity.id,
                slot_key: nextSlotKey,
                display_name: profile.name,
                avatar_url: profile.avatar,
                status: "active",
                last_used_at: new Date().toISOString()
            })
            .select(context.aliasSelectFields)
            .single();

        if (insertError) {
            throw insertError;
        }

        const { data: aliasRows, error: listError } = await client
            .from("alias_sessions")
            .select(context.aliasSelectFields)
            .eq("channel_id", context.runtimeState.channel.id)
            .eq("identity_id", context.runtimeState.identity.id)
            .order("last_used_at", { ascending: false });

        if (listError) {
            throw listError;
        }

        context.runtimeState.aliasProfiles = context.mapAliasProfiles(aliasRows || []);
        return {
            profiles: context.runtimeState.aliasProfiles.map((item) => ({ ...item })),
            activeAliasKey: nextSlotKey
        };
    },
    async updateIdentity(input) {
        const client = context.getSupabaseClient();
        if (!context.runtimeState.identity?.id) {
            throw new Error("频道成员身份尚未初始化完成。");
        }

        const updatePayload = {
            display_name: input.displayName
        };

        if (input.avatarUrl) {
            updatePayload.avatar_url = input.avatarUrl;
        }

        const { data, error } = await client
            .from("identities")
            .update(updatePayload)
            .eq("id", context.runtimeState.identity.id)
            .select("id, display_name, avatar_url, role")
            .single();

        if (error) {
            throw error;
        }

        context.runtimeState.identity = {
            ...context.runtimeState.identity,
            ...data
        };

        return {
            id: data.id,
            name: data.display_name,
            avatar: data.avatar_url || input.avatarUrl || context.defaultRealIdentity.avatar,
            meta: input.meta || context.defaultRealIdentity.meta,
            role: data.role
        };
    }
});
