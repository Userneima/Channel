const roundStageOrder = ["wish", "claim", "delivery", "guess", "reveal"];

const buildRevealPairsFromMap = (revealMap) => Object.values(revealMap || {})
    .filter((entry) => entry?.member?.name && entry?.angel?.name)
    .sort((left, right) => left.member.name.localeCompare(right.member.name, "zh-Hans-CN"));

const extractArchiveStats = (round, members = []) => {
    const legacySummary = round?.completionSnapshot?.legacySummary || null;
    if (legacySummary?.stats && typeof legacySummary.stats === "object") {
        return {
            totalMembers: Number(legacySummary.stats.totalMembers || 0),
            wishDone: Number(legacySummary.stats.wishDone || 0),
            claimDone: Number(legacySummary.stats.claimDone || 0),
            deliveryDone: Number(legacySummary.stats.deliveryDone || 0),
            guessDone: Number(legacySummary.stats.guessDone || 0),
            revealDone: Number(legacySummary.stats.revealDone || 0),
            pairCount: Number(legacySummary.stats.pairCount || 0)
        };
    }

    const snapshot = round?.completionSnapshot || {};
    return {
        totalMembers: Number(snapshot.totalMembers || members.length || 0),
        wishDone: Number(snapshot.wishDone || 0),
        claimDone: Number(snapshot.claimDone || 0),
        deliveryDone: Number(snapshot.deliveryDone || 0),
        guessDone: Number(snapshot.guessDone || 0),
        revealDone: Number(snapshot.revealDone || 0),
        pairCount: buildRevealPairsFromMap(round?.revealMap).length
    };
};

const buildLegacyRevealPairs = (round) => {
    const revealPairs = round?.completionSnapshot?.legacySummary?.revealPairs;
    return Array.isArray(revealPairs)
        ? revealPairs
            .map((pair) => ({
                member: pair?.member
                    ? {
                        name: String(pair.member.name || "").trim(),
                        avatar: String(pair.member.avatar || "").trim()
                    }
                    : null,
                angel: pair?.angel
                    ? {
                        name: String(pair.angel.name || "").trim(),
                        avatar: String(pair.angel.avatar || "").trim()
                    }
                    : null,
                wishPostId: String(pair?.wishPostId || "").trim() || null,
                wishPreview: String(pair?.wishPreview || "").trim(),
                guessedAngelName: String(pair?.guessedAngelName || "").trim(),
                guessedAngelAvatar: String(pair?.guessedAngelAvatar || "").trim(),
                updatedAt: pair?.updatedAt || null
            }))
            .filter((pair) => pair.member?.name && pair.angel?.name)
        : [];
};

const getRestoreBlockReason = ({ round, members = [], currentUserIds = new Set() }) => {
    if (!round) {
        return "missing_round";
    }

    if (round.lifecycleStatus !== "archived") {
        return "not_archived";
    }

    if (round.archiveMode === "legacy_summary") {
        return round.viewOnlyReason || "legacy_summary";
    }

    if (round.viewOnlyReason) {
        return round.viewOnlyReason;
    }

    if ((members || []).some((member) => member.userId && !currentUserIds.has(member.userId))) {
        return "missing_participants";
    }

    const currentStageIndex = Math.max(0, roundStageOrder.indexOf(round.currentStage || "wish"));
    for (const stage of roundStageOrder.slice(currentStageIndex)) {
        const deadlineAt = round.deadlines?.[stage]?.deadlineAt || null;
        if (!deadlineAt) {
            return "missing_deadline";
        }
        if (Date.parse(deadlineAt) <= Date.now()) {
            return "deadline_passed";
        }
    }

    return null;
};

const normalizeArchiveSummary = ({ round, members = [], currentUserIds = new Set() }) => {
    const revealPairs = round.archiveMode === "legacy_summary"
        ? buildLegacyRevealPairs(round)
        : buildRevealPairsFromMap(round.revealMap);
    const stats = extractArchiveStats(round, members);
    const viewOnlyReason = getRestoreBlockReason({ round, members, currentUserIds });

    return {
        ...round,
        stats,
        revealPairs,
        summaryLine: String(round?.completionSnapshot?.legacySummary?.summaryLine || "").trim(),
        isRestorable: !viewOnlyReason,
        viewOnlyReason
    };
};

const findGuessTargetByName = (member, options = []) => options.find((option) => option?.name === member?.name) || null;

export const createRoundApi = (context) => ({
    async loadCurrentRound() {
        const channel = context.ensureLoadedChannel();
        const roundId = channel.current_round_id || channel.currentRoundId || null;
        if (!channel.id || !roundId || !context.runtimeState.authUser?.id) {
            return null;
        }

        return context.fetchRoundRow(roundId);
    },
    async listChannelGuessSelections() {
        return context.roundRepository.listChannelGuessSelections();
    },
    async listRoundMemberStatuses() {
        return context.roundRepository.listRoundMemberStatuses();
    },
    async listArchivedRounds() {
        const channel = context.ensureLoadedChannel();
        if (!channel.id || !context.runtimeState.authUser?.id) {
            return [];
        }

        const [rounds, identityRows] = await Promise.all([
            context.fetchArchivedRoundRows(channel.id),
            context.getSupabaseClient()
                .from("identities")
                .select("user_id")
                .eq("channel_id", channel.id)
        ]);

        if (identityRows.error) {
            throw identityRows.error;
        }

        const currentUserIds = new Set((identityRows.data || []).map((row) => row.user_id).filter(Boolean));
        const archiveSummaries = await Promise.all(
            rounds.map(async (round) => {
                const members = round.archiveMode === "legacy_summary"
                    ? []
                    : await context.fetchRoundMembers(round.id);
                return normalizeArchiveSummary({
                    round,
                    members,
                    currentUserIds
                });
            })
        );

        return archiveSummaries.sort((left, right) => (
            Date.parse(right.completedAt || right.createdAt || 0) - Date.parse(left.completedAt || left.createdAt || 0)
        ));
    },
    async listRoundArchives() {
        return this.listArchivedRounds();
    },
    async getArchivedRoundDetail(roundId) {
        const channel = context.ensureLoadedChannel();
        const trimmedRoundId = String(roundId || "").trim();
        if (!channel.id || !trimmedRoundId || !context.runtimeState.authUser?.id) {
            return null;
        }

        const [round, currentIdentityRows] = await Promise.all([
            context.fetchRoundRow(trimmedRoundId),
            context.getSupabaseClient()
                .from("identities")
                .select("user_id")
                .eq("channel_id", channel.id)
        ]);

        if (currentIdentityRows.error) {
            throw currentIdentityRows.error;
        }

        if (!round) {
            return null;
        }

        const currentUserIds = new Set((currentIdentityRows.data || []).map((row) => row.user_id).filter(Boolean));
        if (round.archiveMode === "legacy_summary") {
            return {
                ...normalizeArchiveSummary({
                    round,
                    members: [],
                    currentUserIds
                }),
                members: [],
                posts: []
            };
        }

        const [members, posts] = await Promise.all([
            context.fetchRoundMembers(round.id),
            context.fetchRoundPosts(round.id, null)
        ]);

        return {
            ...normalizeArchiveSummary({
                round,
                members,
                currentUserIds
            }),
            members,
            posts
        };
    },
    async archiveCurrentRound({ mode = "normal", reason = "" } = {}) {
        const channel = context.ensureLoadedChannel();
        if (!channel.id) {
            throw new Error("频道还没有初始化到数据库。");
        }

        const client = context.getSupabaseClient();
        const { error } = await client.rpc("archive_current_round", {
            target_channel_id: channel.id,
            requested_mode: mode,
            requested_reason: reason || null
        });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                throw new Error("归档函数还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        const refreshedChannelRow = await context.fetchChannelRow(channel.slug);
        return context.normalizeChannel(refreshedChannelRow);
    },
    async restoreArchivedRound(roundId) {
        const channel = context.ensureLoadedChannel();
        const trimmedRoundId = String(roundId || "").trim();
        if (!channel.id || !trimmedRoundId) {
            throw new Error("归档还没有初始化完成。");
        }

        const client = context.getSupabaseClient();
        const { error } = await client.rpc("restore_archived_round", {
            source_round_id: trimmedRoundId
        });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                throw new Error("恢复函数还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        const refreshedChannelRow = await context.fetchChannelRow(channel.slug);
        return context.normalizeChannel(refreshedChannelRow);
    },
    async renameArchivedRound(roundId, title) {
        const trimmedRoundId = String(roundId || "").trim();
        if (!trimmedRoundId) {
            throw new Error("归档还没有初始化完成。");
        }

        const client = context.getSupabaseClient();
        const { error } = await client.rpc("rename_archived_round", {
            target_round_id: trimmedRoundId,
            next_title: title === null ? null : String(title || "")
        });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                throw new Error("归档重命名函数还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        return this.getArchivedRoundDetail(trimmedRoundId);
    },
    async updateChannelRoundState(input) {
        return context.roundRepository.updateChannelRoundState(input);
    },
    async resetChannelRoundProgress() {
        return context.roundRepository.resetChannelRoundProgress();
    },
    async saveClaimSelection(post) {
        if (!context.runtimeState.channel?.id || !context.runtimeState.authUser?.id || !context.runtimeState.identity?.id) {
            throw new Error("频道成员状态还没有初始化完成。");
        }

        const channel = context.ensureLoadedChannel();
        const selectedWishPost = await context.fetchPostById(channel.id, post?.id);
        if (selectedWishPost.isDeleted || selectedWishPost.board !== "wish") {
            throw new Error("当前愿望内容无效，无法选择。");
        }

        if (context.isEntryOwnedByIdentity(selectedWishPost, {
            id: context.runtimeState.identity.id,
            display_name: context.runtimeState.identity.display_name,
            userId: context.runtimeState.authUser.id
        })) {
            throw new Error("不能选择自己发的愿望。");
        }

        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("set_current_round_claim_selection", {
            target_channel_id: channel.id,
            target_post_id: selectedWishPost.id
        });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                throw new Error("选愿望字段还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        const memberRow = Array.isArray(data) ? data[0] || null : data || null;
        context.runtimeState.identity = {
            ...context.runtimeState.identity,
            current_claim_post_id: selectedWishPost.id,
            current_claim_selected_at: memberRow?.claim_selected_at || new Date().toISOString()
        };

        return context.normalizeClaimSelection(selectedWishPost);
    },
    async clearClaimSelection() {
        if (!context.runtimeState.channel?.id || !context.runtimeState.authUser?.id || !context.runtimeState.identity?.id) {
            return;
        }

        const client = context.getSupabaseClient();
        const { error } = await client.rpc("clear_current_round_claim_selection", {
            target_channel_id: context.runtimeState.channel.id
        });

        if (error && !context.isSchemaCompatibilityError(error)) {
            throw error;
        }

        context.runtimeState.identity = {
            ...context.runtimeState.identity,
            current_claim_post_id: null,
            current_claim_selected_at: null
        };
    },
    async saveGuessSelection(member) {
        if (!context.runtimeState.authUser?.id || !context.runtimeState.identity?.id) {
            throw new Error("频道成员状态还没有初始化完成。");
        }

        const selection = context.normalizeGuessSelection(member);
        if (!selection?.name) {
            throw new Error("先选择你猜的是谁。");
        }

        const currentName = String(
            context.runtimeState.identity.display_name || context.runtimeState.realIdentity?.name || ""
        ).trim();
        if (currentName && selection.name === currentName) {
            throw new Error("不能把自己设成猜测对象。");
        }

        const memberOptions = await this.listRoundMemberStatuses();
        const matchedTarget = findGuessTargetByName(member, memberOptions);
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("set_current_round_guess_selection", {
            target_channel_id: context.runtimeState.channel.id,
            target_guess_user_id: matchedTarget?.userId || null,
            target_guess_name: selection.name,
            target_guess_avatar: selection.avatar || null
        });

        if (error) {
            if (context.isSchemaCompatibilityError(error)) {
                throw new Error("猜测字段还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        const memberRow = Array.isArray(data) ? data[0] || null : data || null;
        const selectedAt = memberRow?.guess_selected_at || new Date().toISOString();
        context.runtimeState.identity = {
            ...context.runtimeState.identity,
            current_guess_name: selection.name,
            current_guess_avatar: selection.avatar || "",
            current_guess_selected_at: selectedAt
        };

        return {
            ...selection,
            selectedAt
        };
    },
    async clearGuessSelection() {
        if (!context.runtimeState.authUser?.id || !context.runtimeState.identity?.id) {
            return;
        }

        const client = context.getSupabaseClient();
        const { error } = await client.rpc("clear_current_round_guess_selection", {
            target_channel_id: context.runtimeState.channel.id
        });

        if (error && !context.isSchemaCompatibilityError(error)) {
            throw error;
        }

        context.runtimeState.identity = {
            ...context.runtimeState.identity,
            current_guess_name: null,
            current_guess_avatar: null,
            current_guess_selected_at: null
        };
    }
});
