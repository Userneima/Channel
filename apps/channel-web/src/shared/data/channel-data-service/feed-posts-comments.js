export const createFeedPostsCommentsApi = (context) => ({
    async listPosts(boardSlug = null) {
        const channel = context.ensureLoadedChannel();
        if (!channel.id) {
            return [];
        }
        return context.fetchPosts(boardSlug);
    },
    async getPost(postId) {
        const channel = context.ensureLoadedChannel();
        if (!channel.id) {
            throw new Error("频道还没有初始化到数据库。");
        }

        const cachedPost = context.postCache.get(postId);
        if (cachedPost) {
            return cachedPost;
        }

        const persistentPost = context.api.getCachedPost(postId, channel.slug);
        if (persistentPost) {
            context.postCache.set(postId, persistentPost);
            return persistentPost;
        }

        return context.fetchPostById(context.runtimeState.channel.id, postId);
    },
    async publishPost(input) {
        const client = context.getSupabaseClient();
        const channel = context.ensureLoadedChannel();
        const authorReference = context.getActorReference(input.author);
        const { data, error } = await client
            .from("posts")
            .insert({
                channel_id: channel.id,
                round_id: channel.current_round_id || channel.currentRoundId || null,
                board_slug: input.boardSlug || null,
                body: input.body,
                media: input.media || input.images || [],
                ai_disclosure: input.aiDisclosure || "none",
                ...authorReference
            })
            .select("id")
            .single();

        if (error) {
            throw error;
        }

        return context.api.getPost(data.id);
    },
    async publishComment(input) {
        const client = context.getSupabaseClient();
        const channel = context.ensureLoadedChannel();
        const authorReference = context.getActorReference(input.author);
        let response = await client
            .from("comments")
            .insert({
                post_id: input.postId,
                channel_id: channel.id,
                round_id: channel.current_round_id || channel.currentRoundId || null,
                parent_comment_id: input.parentCommentId || null,
                body: input.body,
                ...authorReference
            })
            .select(context.commentSelectFields)
            .single();

        if (response.error && context.isSchemaCompatibilityError(response.error)) {
            response = await client
                .from("comments")
                .insert({
                    post_id: input.postId,
                    channel_id: channel.id,
                    round_id: channel.current_round_id || channel.currentRoundId || null,
                    body: input.body,
                    ...authorReference
                })
                .select(context.legacyCommentSelectFields)
                .single();
        }

        if (response.error) {
            throw response.error;
        }

        context.postCache.delete(input.postId);
        return context.normalizeCommentRow(response.data);
    },
    async likePost(postId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("increment_post_like", {
            target_post_id: postId
        });

        if (error) {
            throw error;
        }

        context.postCache.delete(postId);
        return Number(data || 0);
    },
    async likeComment(commentId, postId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("increment_comment_like", {
            target_comment_id: commentId
        });

        if (error) {
            throw error;
        }

        if (postId) {
            context.postCache.delete(postId);
        }
        return Number(data || 0);
    },
    async deletePost(postId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("soft_delete_post", {
            target_post_id: postId
        });

        if (error) {
            throw error;
        }

        const result = Array.isArray(data) ? data[0] || {} : data || {};
        const targetPostId = result.post_id || postId;
        context.postCache.delete(targetPostId);
        return context.api.getPost(targetPostId);
    },
    async deleteComment(commentId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("soft_delete_comment", {
            target_comment_id: commentId
        });

        if (error) {
            throw error;
        }

        const result = Array.isArray(data) ? data[0] || {} : data || {};
        const targetPostId = result.post_id || null;
        if (!targetPostId) {
            throw new Error("删除评论后无法定位所属帖子。");
        }

        context.postCache.delete(targetPostId);
        return context.api.getPost(targetPostId);
    }
});
