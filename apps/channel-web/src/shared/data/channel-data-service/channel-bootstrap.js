export const createChannelBootstrapApi = (context) => ({
    getChannelShell(slug = context.runtimeConfig.channelSlug || "") {
        return context.getShellChannel(slug);
    },
    async loadChannelBootstrap(slug) {
        const snapshot = await context.getSessionSnapshot();
        const channelRow = await context.fetchChannelRow(slug);
        const channel = context.normalizeChannel(channelRow);
        const auth = {
            user: snapshot.user,
            isAnonymous: snapshot.isAnonymous
        };

        const membership = await context.buildMembershipSnapshot(channel.id, snapshot, {
            includeReviewItems: false
        });
        const memberRuntime = membership.status === "approved"
            ? await context.buildMemberRuntime(channelRow, snapshot, membership, {
                allowEnsureAliases: false
            })
            : null;

        const memberCacheValue = {
            membership,
            memberRuntime
        };
        context.writeSessionCache(
            context.getChannelMemberCacheKey(slug, context.getUserCacheKey(snapshot)),
            memberCacheValue
        );
        context.writeLocalCache(
            context.getChannelMemberCacheKey(slug, context.getUserCacheKey(snapshot)),
            memberCacheValue
        );

        return {
            channel,
            auth,
            membership,
            memberRuntime
        };
    },
    async loadPublicChannelPreview(slug) {
        return context.normalizeChannel(await context.fetchChannelRow(slug));
    },
    async listPublicChannels() {
        const client = context.getSupabaseClient();
        const query = client
            .from("channels")
            .select(context.channelSelectFields)
            .order("created_at", { ascending: true });

        let rows = null;
        const response = await query.eq("preview_visibility", "public");

        if (response.error) {
            if (!context.isSchemaCompatibilityError(response.error)) {
                throw response.error;
            }

            const fallbackResponse = await client
                .from("channels")
                .select(context.minimalChannelSelectFields)
                .eq("visibility", "public")
                .order("created_at", { ascending: true });

            if (fallbackResponse.error) {
                throw fallbackResponse.error;
            }

            rows = (fallbackResponse.data || []).map(context.normalizeChannelRowCompatibility);
        } else {
            rows = (response.data || []).map(context.normalizeChannelRowCompatibility);
        }

        if (!rows.length && context.runtimeConfig.channelSlug) {
            return [{
                slug: context.runtimeConfig.channelSlug,
                name: context.runtimeConfig.channelName || context.runtimeConfig.channelSlug,
                description: "",
                discussionCount: 0,
                badge: (context.runtimeConfig.channelName || context.runtimeConfig.channelSlug || "频").slice(0, 1)
            }];
        }

        const channels = await Promise.all(rows.map(async (row) => ({
            ...context.normalizeChannel(row),
            discussionCount: await context.countPublicPosts(row.id)
        })));

        return channels.map((channel) => ({
            slug: channel.slug,
            name: channel.name,
            description: channel.description || "",
            discussionCount: channel.discussionCount,
            badge: (channel.name || "频").slice(0, 1)
        }));
    },
    async createChannel(input) {
        const snapshot = await context.getSessionSnapshot();
        if (!snapshot.user?.id || snapshot.isAnonymous) {
            throw new Error("请先登录，再创建频道。");
        }

        const client = context.getSupabaseClient();
        const channelName = String(input.name || "").trim();
        const channelDescription = String(input.description || "").trim();

        if (!channelName) {
            throw new Error("请输入频道名称。");
        }

        await context.ensureProfile();

        let channelSlug = "";
        let channelId = "";
        const rpcResponse = await client.rpc("create_channel_with_owner", {
            channel_name: channelName,
            channel_description: channelDescription
        });

        if (!rpcResponse.error) {
            const createdChannel = Array.isArray(rpcResponse.data) ? rpcResponse.data[0] : rpcResponse.data;
            channelSlug = createdChannel?.created_channel_slug || "";
            channelId = createdChannel?.created_channel_id || "";
        } else if (!context.isSchemaCompatibilityError(rpcResponse.error)) {
            throw rpcResponse.error;
        } else {
            const profile = await context.ensureProfile();
            const generatedSlug = await context.generateUniqueChannelSlug(channelName);
            const { data: createdChannel, error: channelError } = await client
                .from("channels")
                .insert({
                    slug: generatedSlug,
                    name: channelName,
                    description: channelDescription || null,
                    visibility: "public",
                    preview_visibility: "public",
                    join_policy: "open",
                    created_by: snapshot.user.id
                })
                .select(context.channelSelectFields)
                .single();

            if (channelError) {
                throw channelError;
            }

            const { data: createdIdentity, error: identityError } = await client
                .from("identities")
                .insert({
                    channel_id: createdChannel.id,
                    user_id: snapshot.user.id,
                    display_name: profile?.display_name || snapshot.user.email?.split("@")[0] || "频道主",
                    avatar_url: profile?.avatar_url || null,
                    role: "owner"
                })
                .select(context.legacyIdentitySelectFields)
                .single();

            if (identityError) {
                throw identityError;
            }

            const aliasResponse = await client.rpc("ensure_my_alias_sessions", {
                target_channel_id: createdChannel.id
            });

            if (aliasResponse.error && !context.isSchemaCompatibilityError(aliasResponse.error)) {
                throw aliasResponse.error;
            }

            if (aliasResponse.error) {
                const aliasRows = context.defaultAnonymousProfiles.map((profileItem) => ({
                    channel_id: createdChannel.id,
                    identity_id: createdIdentity.id,
                    slot_key: profileItem.key,
                    display_name: profileItem.name,
                    avatar_url: profileItem.avatar,
                    status: "active"
                }));

                const insertedAliases = await client
                    .from("alias_sessions")
                    .insert(aliasRows)
                    .select(context.aliasSelectFields);

                if (insertedAliases.error) {
                    throw insertedAliases.error;
                }
            }

            channelSlug = createdChannel.slug;
            channelId = createdChannel.id;
        }

        const channel = await context.api.loadPublicChannelPreview(channelSlug);
        return context.api.loadApprovedMemberRuntime(channel.id || channelId);
    },
    async updateChannel(input) {
        const channel = context.ensureLoadedChannel();
        const client = context.getSupabaseClient();
        const nextName = String(input.name || channel.name || "").trim();
        const nextDescription = String(input.description ?? channel.description ?? "").trim();
        const nextLogoUrl = input.logoUrl === ""
            ? context.defaultChannelLogo
            : String(input.logoUrl || channel.logo_url || channel.logoUrl || context.defaultChannelLogo);
        const nextBackgroundUrl = input.backgroundUrl === ""
            ? context.defaultChannelBackground
            : String(input.backgroundUrl || channel.background_url || channel.backgroundUrl || context.defaultChannelBackground);

        if (!nextName) {
            throw new Error("请输入频道名称。");
        }

        let nextChannelRow = {
            ...channel,
            name: nextName,
            description: nextDescription,
            logo_url: nextLogoUrl,
            background_url: nextBackgroundUrl
        };

        if (channel.id) {
            const { data, error } = await client
                .from("channels")
                .update({
                    name: nextName,
                    description: nextDescription || null
                })
                .eq("id", channel.id)
                .select(context.channelSelectFields)
                .single();

            if (error && !context.isSchemaCompatibilityError(error)) {
                throw error;
            }

            if (data) {
                nextChannelRow = {
                    ...data,
                    logo_url: nextLogoUrl,
                    background_url: nextBackgroundUrl
                };
            }
        }

        const syncedChannelRow = await context.syncChannelCaches(nextChannelRow);
        return context.normalizeChannel(syncedChannelRow);
    }
});
