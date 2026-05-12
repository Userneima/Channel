export const createCacheApi = (context) => ({
    async getCachedChannelBootstrap(slug) {
        const snapshot = await context.getSessionSnapshot();
        const cachedChannel = context.readBestEffortCache(
            context.getChannelShellCacheKey(slug),
            context.channelShellCacheTtl
        );
        const cachedMember = context.readBestEffortCache(
            context.getChannelMemberCacheKey(slug, context.getUserCacheKey(snapshot)),
            context.channelMemberCacheTtl
        );

        if (!cachedChannel && !cachedMember) {
            return null;
        }

        const channel = context.normalizeChannel(cachedChannel || context.createFallbackChannelRow(slug));
        context.runtimeState.channel = cachedChannel || context.createFallbackChannelRow(slug);

        return {
            channel,
            auth: {
                user: snapshot.user,
                isAnonymous: snapshot.isAnonymous
            },
            membership: cachedMember?.membership || {
                status: "guest",
                joinRequest: null,
                reviewItems: [],
                role: null
            },
            memberRuntime: cachedMember?.memberRuntime || null
        };
    },
    getCachedPosts(boardSlug = null, slug = context.runtimeState.channel?.slug || context.runtimeConfig.channelSlug || "") {
        if (!slug) {
            return [];
        }

        const roundScope = context.runtimeState.channel?.current_round_id
            || context.runtimeState.channel?.currentRoundId
            || "current";
        const cachedItems = context.readLocalCache(
            context.getChannelFeedCacheKey(slug, boardSlug, roundScope),
            context.channelFeedCacheTtl
        );
        return context.cloneCachedPosts(cachedItems);
    },
    getCachedPost(postId, slug = context.runtimeState.channel?.slug || context.runtimeConfig.channelSlug || "") {
        if (!slug || !postId) {
            return null;
        }

        const cachedPost = context.readLocalCache(
            context.getChannelPostCacheKey(slug, postId),
            context.channelFeedCacheTtl
        );
        return cachedPost ? context.cloneCachedPost(cachedPost) : null;
    }
});
