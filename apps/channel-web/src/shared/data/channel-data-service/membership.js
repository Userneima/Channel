const normalizeMemberDirectoryItem = (row) => ({
    identityId: row.identity_id || row.identityId || null,
    userId: row.user_id || row.userId || null,
    name: String(row.display_name || row.displayName || "").trim() || "频道成员",
    avatar: String(row.avatar_url || row.avatarUrl || "").trim(),
    role: String(row.role || "member").trim() || "member",
    createdAt: row.created_at || row.createdAt || null
});

export const createMembershipApi = (context) => ({
    async loadMembershipState(channelId) {
        const snapshot = await context.getSessionSnapshot();
        return context.buildMembershipSnapshot(channelId, snapshot, {
            includeReviewItems: false
        });
    },
    async listPendingJoinRequests(channelId) {
        const client = context.getSupabaseClient();
        const { data: rows, error } = await client
            .from("channel_join_requests")
            .select(context.joinRequestSelectFields)
            .eq("channel_id", channelId)
            .eq("status", "pending")
            .order("created_at", { ascending: true });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                return [];
            }
            if (String(error.code || "") === "42501") {
                return [];
            }
            throw error;
        }

        const profileByUserId = await context.fetchReviewProfiles(rows || []);
        return (rows || []).map((row) => context.normalizeJoinRequest(row, profileByUserId));
    },
    async submitJoinRequest(channelId, message) {
        const snapshot = await context.getSessionSnapshot();
        if (!snapshot.user?.id || snapshot.isAnonymous) {
            throw new Error("请先完成正式登录，再进入频道。");
        }

        const joinPolicy = await context.fetchChannelJoinPolicy(channelId);
        if (joinPolicy === "open") {
            const membership = await context.ensureApprovedMembership(channelId, snapshot);
            if (!membership?.identityId) {
                throw new Error("进入频道失败，请稍后重试。");
            }

            return {
                id: membership.identityId,
                channelId,
                userId: snapshot.user.id,
                status: "approved",
                message: message || ""
            };
        }

        const existingJoinRequest = await context.fetchLatestOwnJoinRequest(channelId, snapshot.user.id);
        if (existingJoinRequest?.status === "pending") {
            const profileByUserId = await context.fetchReviewProfiles([existingJoinRequest]);
            return context.normalizeJoinRequest(existingJoinRequest, profileByUserId);
        }

        const client = context.getSupabaseClient();
        const { data, error } = await client
            .from("channel_join_requests")
            .insert({
                channel_id: channelId,
                user_id: snapshot.user.id,
                status: "pending",
                message: String(message || "").trim() || null
            })
            .select(context.joinRequestSelectFields)
            .single();

        if (error) {
            if (String(error.code || "") === "23505") {
                const pendingJoinRequest = await context.fetchLatestOwnJoinRequest(channelId, snapshot.user.id);
                if (pendingJoinRequest?.status === "pending") {
                    const profileByUserId = await context.fetchReviewProfiles([pendingJoinRequest]);
                    return context.normalizeJoinRequest(pendingJoinRequest, profileByUserId);
                }
            }
            throw error;
        }

        const profileByUserId = await context.fetchReviewProfiles([data]);
        return context.normalizeJoinRequest(data, profileByUserId);
    },
    async approveJoinRequest(requestId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("approve_channel_join_request", {
            target_request_id: requestId
        });

        if (error) {
            throw error;
        }

        return context.normalizeJoinRequest(data);
    },
    async rejectJoinRequest(requestId, reason = "") {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("reject_channel_join_request", {
            target_request_id: requestId,
            rejection_note: reason || null
        });

        if (error) {
            throw error;
        }

        return context.normalizeJoinRequest(data);
    },
    async listChannelMembers(channelId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("list_channel_members", {
            target_channel_id: channelId
        });

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data.map(normalizeMemberDirectoryItem) : [];
    },
    async setChannelMemberRole(identityId, nextRole) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("set_channel_member_role", {
            target_identity_id: identityId,
            next_role: nextRole
        });

        if (error) {
            throw error;
        }

        return normalizeMemberDirectoryItem(data || {});
    },
    async removeChannelMember(identityId) {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("remove_channel_member", {
            target_identity_id: identityId
        });

        if (error) {
            throw error;
        }

        return normalizeMemberDirectoryItem(data || {});
    },
    async loadApprovedMemberRuntime(channelId) {
        const snapshot = await context.getSessionSnapshot();
        if (!snapshot.user?.id || snapshot.isAnonymous) {
            throw new Error("当前会话还不是正式成员。");
        }

        const membership = await context.buildMembershipSnapshot(channelId, snapshot, {
            includeReviewItems: false
        });
        const runtime = await context.buildMemberRuntime(context.ensureLoadedChannel(), snapshot, membership, {
            allowEnsureAliases: true
        });

        if (!runtime) {
            throw new Error("当前会话还不是正式成员。");
        }

        return runtime;
    }
});
