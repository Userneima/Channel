import { defaultRoundDeadlines, gameBoardStageValues } from "../../entities/channel/config.js";
import { mentionMembers } from "../../entities/identity/config.js";
import { getPostPreviewText } from "../lib/helpers.js";

const memberAvatarByName = new Map(mentionMembers.map((member) => [member.name, member.avatar || ""]));

export const normalizeRoundStage = (value) => {
    const normalized = String(value || "").trim();
    return gameBoardStageValues.includes(normalized) ? normalized : "wish";
};

export const normalizeRoundStatus = (value) => {
    const normalized = String(value || "").trim();
    return normalized === "archived" ? "archived" : "active";
};

export const normalizeRoundDeadlines = (value) => {
    const source = value && typeof value === "object" ? value : {};

    return Object.fromEntries(
        gameBoardStageValues.map((stageValue) => [
            stageValue,
            source[stageValue] && typeof source[stageValue] === "object"
                ? {
                    label: String(source[stageValue].label || defaultRoundDeadlines[stageValue] || "").trim(),
                    deadlineAt: source[stageValue].deadlineAt || null
                }
                : {
                    label: String(source[stageValue] || defaultRoundDeadlines[stageValue] || "").trim(),
                    deadlineAt: null
                }
        ])
    );
};

export const getRoundStartTimestamp = (channel) => {
    const startedAt = channel?.current_round_started_at || channel?.currentRoundStartedAt || null;
    const timestamp = Date.parse(startedAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
};

export const normalizeRevealParty = (value, fallbackName = "") => {
    if (!value && !fallbackName) {
        return null;
    }

    if (typeof value === "string") {
        const name = String(value).trim() || String(fallbackName || "").trim();
        return name
            ? {
                name,
                avatar: ""
            }
            : null;
    }

    if (value && typeof value === "object") {
        const name = String(
            value.name
            || value.memberName
            || value.display_name
            || fallbackName
            || ""
        ).trim();

        if (!name) {
            return null;
        }

        return {
            name,
            avatar: String(value.avatar || value.avatarUrl || value.avatar_url || "").trim()
        };
    }

    const name = String(fallbackName || "").trim();
    return name
        ? {
            name,
            avatar: ""
        }
        : null;
};

export const normalizeRevealMap = (revealMap) => Object.fromEntries(
    Object.entries(revealMap && typeof revealMap === "object" ? revealMap : {})
        .map(([memberName, entry]) => {
            const normalizedMember = normalizeRevealParty(entry?.member, memberName);
            const normalizedAngel = normalizeRevealParty(entry?.angel || entry);
            if (!normalizedMember?.name || !normalizedAngel?.name) {
                return null;
            }

            return [
                normalizedMember.name,
                {
                    member: normalizedMember,
                    angel: normalizedAngel,
                    wishPostId: String(entry?.wishPostId || entry?.wish_post_id || "").trim() || null,
                    wishPreview: String(entry?.wishPreview || entry?.wish_preview || "").trim(),
                    guessedAngelName: String(entry?.guessedAngelName || entry?.guessed_angel_name || "").trim(),
                    guessedAngelAvatar: String(entry?.guessedAngelAvatar || entry?.guessed_angel_avatar || "").trim(),
                    updatedAt: entry?.updatedAt || entry?.updated_at || null
                }
            ];
        })
        .filter(Boolean)
);

const extractMentionTargetName = (body) => {
    const firstLine = String(body || "").split(/\r?\n/, 1)[0]?.trim() || "";
    return firstLine.startsWith("@") ? firstLine.slice(1).trim() : "";
};

const getWishParticipantMeta = (post) => {
    const participantUserId = post?.wishMeta?.participantUserId || post?.authorUserId || null;
    const participantName = String(
        post?.wishMeta?.participantName
        || post?.adminRevealIdentity?.name
        || post?.authorName
        || ""
    ).trim();
    const participantAvatar = String(
        post?.wishMeta?.participantAvatar
        || post?.adminRevealIdentity?.avatar
        || post?.authorAvatar
        || ""
    ).trim();

    return {
        participantUserId,
        participantName,
        participantAvatar,
        submissionSource: String(post?.wishMeta?.submissionSource || "self").trim() || "self",
        recordedByName: String(post?.wishMeta?.recordedByName || post?.authorName || "").trim()
    };
};

export const createChannelRoundRepository = ({
    getSupabaseClient,
    ensureLoadedChannel,
    fetchPosts,
    fetchRoundPosts,
    isSchemaCompatibilityError,
    normalizeClaimSelection,
    syncChannelCaches,
    normalizeChannel,
    channelSelectFields,
    identitySelectFields,
    legacyIdentitySelectFields,
    roundSelectFields,
    roundMemberSelectFields,
    defaultChannelLogo,
    defaultChannelBackground
}) => ({
    async listChannelGuessSelections() {
        const channel = ensureLoadedChannel();
        const currentRoundId = channel.current_round_id || channel.currentRoundId || null;
        if (!channel.id || !currentRoundId) {
            return [];
        }

        const client = getSupabaseClient();
        const response = await client
            .from("channel_round_members")
            .select(roundMemberSelectFields)
            .eq("round_id", currentRoundId);

        if (response.error) {
            if (isSchemaCompatibilityError(response.error)) {
                const legacyResponse = await client
                    .from("identities")
                    .select(identitySelectFields)
                    .eq("channel_id", channel.id);
                if (legacyResponse.error && isSchemaCompatibilityError(legacyResponse.error)) {
                    const fallbackResponse = await client
                        .from("identities")
                        .select(legacyIdentitySelectFields)
                        .eq("channel_id", channel.id);
                    if (fallbackResponse.error) {
                        throw fallbackResponse.error;
                    }
                    return (fallbackResponse.data || []).map((row) => ({
                        memberName: String(row.display_name || "").trim(),
                        memberAvatar: String(row.avatar_url || "").trim(),
                        guessedAngelName: "",
                        guessedAngelAvatar: "",
                        guessedAt: null
                    }));
                }
                if (legacyResponse.error) {
                    throw legacyResponse.error;
                }
                return (legacyResponse.data || []).map((row) => ({
                    memberName: String(row.display_name || "").trim(),
                    memberAvatar: String(row.avatar_url || "").trim(),
                    guessedAngelName: String(row.current_guess_name || "").trim(),
                    guessedAngelAvatar: String(row.current_guess_avatar || "").trim(),
                    guessedAt: row.current_guess_selected_at || null
                }));
            }
            throw response.error;
        }

        return (response.data || []).map((row) => ({
            memberName: String(row.display_name_snapshot || "").trim(),
            memberAvatar: String(row.avatar_snapshot || "").trim(),
            guessedAngelName: String(row.guess_target_name_snapshot || "").trim(),
            guessedAngelAvatar: String(row.guess_target_avatar_snapshot || "").trim(),
            guessedAt: row.guess_selected_at || null
        }));
    },
    async listRoundMemberStatuses() {
        const channel = ensureLoadedChannel();
        const currentRoundId = channel.current_round_id || channel.currentRoundId || null;
        if (!channel.id || !currentRoundId) {
            return [];
        }

        const client = getSupabaseClient();
        let response = await client
            .from("channel_round_members")
            .select(roundMemberSelectFields)
            .eq("round_id", currentRoundId)
            .order("display_name_snapshot", { ascending: true });

        const useLegacyIdentityFields = Boolean(response.error && isSchemaCompatibilityError(response.error));
        if (useLegacyIdentityFields) {
            const runQuery = (selectFields) => client
                .from("identities")
                .select(selectFields)
                .eq("channel_id", channel.id)
                .order("display_name", { ascending: true });

            response = await runQuery(identitySelectFields);
            if (response.error && isSchemaCompatibilityError(response.error)) {
                response = await runQuery(legacyIdentitySelectFields);
            }
        }

        if (response.error) {
            throw response.error;
        }

        const activeIdentityResponse = await client
            .from("identities")
            .select("id, user_id")
            .eq("channel_id", channel.id);

        if (activeIdentityResponse.error) {
            throw activeIdentityResponse.error;
        }

        const activeIdentityIds = new Set((activeIdentityResponse.data || []).map((row) => row.id).filter(Boolean));
        const activeUserIds = new Set((activeIdentityResponse.data || []).map((row) => row.user_id).filter(Boolean));
        const activeRows = (response.data || []).filter((row) => {
            if (useLegacyIdentityFields) {
                return activeUserIds.has(row.user_id);
            }

            return activeIdentityIds.has(row.identity_id) || activeUserIds.has(row.user_id);
        });

        const [wishPosts, deliveryPosts] = await Promise.all([
            typeof fetchRoundPosts === "function" ? fetchRoundPosts(currentRoundId, "wish") : fetchPosts("wish"),
            typeof fetchRoundPosts === "function" ? fetchRoundPosts(currentRoundId, "delivery") : fetchPosts("delivery")
        ]);
        const wishPostById = new Map(wishPosts.map((post) => [post.id, post]));
        const latestWishByUserId = new Map();
        const latestDeliveryByUserId = new Map();
        const latestWishByMemberName = new Map();

        wishPosts.forEach((post) => {
            if (post.isDeleted) {
                return;
            }

            const participant = getWishParticipantMeta(post);
            if (!participant.participantUserId || !participant.participantName) {
                return;
            }

            if (!latestWishByUserId.has(participant.participantUserId)) {
                latestWishByUserId.set(participant.participantUserId, post);
            }

            if (!latestWishByMemberName.has(participant.participantName)) {
                latestWishByMemberName.set(participant.participantName, post);
            }
        });

        deliveryPosts.forEach((post) => {
            if (post.isDeleted || !post.authorUserId) {
                return;
            }

            if (!latestDeliveryByUserId.has(post.authorUserId)) {
                latestDeliveryByUserId.set(post.authorUserId, post);
            }
        });

        const roundResponse = await client
            .from("channel_rounds")
            .select(roundSelectFields)
            .eq("id", currentRoundId)
            .maybeSingle();

        const revealMap = normalizeRevealMap(
            roundResponse.data?.reveal_map
            || roundResponse.data?.revealMap
            || channel.current_reveal_map
            || channel.currentRevealMap
        );

        return activeRows.map((row) => {
            const userId = useLegacyIdentityFields ? row.user_id : row.user_id;
            const name = useLegacyIdentityFields ? String(row.display_name || "频道成员").trim() : String(row.display_name_snapshot || "频道成员").trim();
            const avatar = useLegacyIdentityFields ? String(row.avatar_url || "").trim() : String(row.avatar_snapshot || "").trim();
            const role = useLegacyIdentityFields ? (row.role || "member") : (row.role_snapshot || "member");
            const claimPostId = useLegacyIdentityFields ? row.current_claim_post_id : row.claim_post_id;
            const claimSelectedAt = useLegacyIdentityFields ? (row.current_claim_selected_at || null) : (row.claim_selected_at || null);
            const guessTargetName = useLegacyIdentityFields ? String(row.current_guess_name || "").trim() : String(row.guess_target_name_snapshot || "").trim();
            const guessTargetAvatar = useLegacyIdentityFields ? String(row.current_guess_avatar || "").trim() : String(row.guess_target_avatar_snapshot || "").trim();
            const guessSelectedAt = useLegacyIdentityFields ? (row.current_guess_selected_at || null) : (row.guess_selected_at || null);
            const isCurrentClaim = Boolean(claimPostId);
            const isCurrentGuess = Boolean(guessTargetName);
            const wishPost = latestWishByUserId.get(userId) || null;
            const wishParticipant = getWishParticipantMeta(wishPost);
            const claimedWishPost = isCurrentClaim ? (wishPostById.get(claimPostId) || null) : null;
            const claimSelection = claimedWishPost ? normalizeClaimSelection(claimedWishPost) : null;
            const deliveryPost = latestDeliveryByUserId.get(userId) || null;
            const deliveryMeta = deliveryPost?.deliveryMeta || null;
            const deliveryTargetName = String(
                deliveryMeta?.targetMemberName
                || extractMentionTargetName(deliveryPost?.text || "")
                || claimSelection?.authorName
                || ""
            ).trim();
            const deliveryTargetWishPost = deliveryMeta?.wishPostId
                ? (wishPostById.get(deliveryMeta.wishPostId) || null)
                : claimedWishPost;
            const revealEntry = revealMap[name] || null;
            const wishPreviewPost = latestWishByMemberName.get(name) || null;
            const wishSubmissionSource = wishParticipant.submissionSource || "self";

            return {
                identityId: useLegacyIdentityFields ? row.id : (row.identity_id || null),
                userId,
                name,
                avatar,
                role,
                wishSubmitted: Boolean(wishPost),
                participatingInRound: Boolean(wishPost),
                wishPostId: wishPost?.id || null,
                wishPreview: wishPreviewPost ? getPostPreviewText(wishPreviewPost, 72).text : "",
                wishSubmissionSource,
                wishRecordedByName: wishSubmissionSource === "proxy" ? (wishParticipant.recordedByName || "") : "",
                claimSelected: isCurrentClaim,
                claimPostId: isCurrentClaim ? claimPostId : null,
                claimSelectedAt: isCurrentClaim ? claimSelectedAt : null,
                claimTargetName: claimSelection?.authorName || "",
                claimTargetAvatar: claimSelection?.authorAvatar || "",
                deliverySubmitted: Boolean(deliveryPost),
                deliveryPostId: deliveryPost?.id || null,
                deliveryTargetName,
                deliveryTargetAvatar: deliveryMeta?.targetMemberAvatar || claimedWishPost?.authorAvatar || "",
                deliveryWishPostId: deliveryTargetWishPost?.id || null,
                guessSubmitted: isCurrentGuess,
                guessedAngelName: isCurrentGuess ? guessTargetName : "",
                guessedAngelAvatar: isCurrentGuess ? guessTargetAvatar : "",
                guessedAt: isCurrentGuess ? guessSelectedAt : null,
                revealReady: Boolean(revealEntry?.angel?.name),
                revealedAngelName: revealEntry?.angel?.name || "",
                revealedAngelAvatar: revealEntry?.angel?.avatar || "",
                guessedCorrectly: Boolean(revealEntry?.angel?.name)
                    && Boolean(isCurrentGuess ? guessTargetName : revealEntry?.guessedAngelName)
                    && (String(isCurrentGuess ? guessTargetName : revealEntry?.guessedAngelName || "").trim() === revealEntry.angel.name)
            };
        });
    },
    async updateChannelRoundState(input) {
        const channel = ensureLoadedChannel();
        const client = getSupabaseClient();
        const nextTheme = input.theme === undefined
            ? String(channel.current_round_theme || channel.currentRoundTheme || "").trim()
            : String(input.theme || "").trim();
        const nextGodName = input.godProfile === undefined
            ? channel.current_round_god_name || channel.currentRoundGodName || channel.currentRoundGodProfile?.name || null
            : String(input.godProfile?.name || "").trim() || null;
        const nextGodAvatar = input.godProfile === undefined
            ? channel.current_round_god_avatar || channel.currentRoundGodAvatar || channel.currentRoundGodProfile?.avatar || ""
            : String(input.godProfile?.avatar || "").trim();
        const nextGodUserId = input.godProfile === undefined
            ? channel.currentRoundGodProfile?.userId || null
            : input.godProfile?.userId || null;
        const nextStage = input.stage === undefined
            ? normalizeRoundStage(channel.current_round_stage || channel.currentRoundStage)
            : normalizeRoundStage(input.stage);
        const nextStatus = input.status === undefined
            ? normalizeRoundStatus(channel.current_round_status || channel.currentRoundStatus)
            : normalizeRoundStatus(input.status);
        const nextDeadlines = input.deadlines === undefined
            ? normalizeRoundDeadlines(channel.current_round_deadlines || channel.currentRoundDeadlines)
            : normalizeRoundDeadlines(input.deadlines);
        const nextStartedAt = input.startedAt === undefined
            ? (channel.current_round_started_at || channel.currentRoundStartedAt || null)
            : (input.startedAt || null);
        const nextCompletedAt = input.completedAt === undefined
            ? (channel.current_round_completed_at || channel.currentRoundCompletedAt || null)
            : (input.completedAt || null);
        const nextRevealMap = input.revealMap === undefined
            ? normalizeRevealMap(channel.current_reveal_map || channel.currentRevealMap)
            : normalizeRevealMap(input.revealMap);

        if (!channel.id) {
            throw new Error("频道还没有初始化到数据库。");
        }

        const { error } = await client.rpc("update_channel_current_round_state", {
            target_channel_id: channel.id,
            next_theme: nextTheme || null,
            next_god_profile: nextGodName
                ? {
                    userId: nextGodUserId,
                    name: nextGodName,
                    avatar: nextGodAvatar || ""
                }
                : null,
            next_stage: nextStage,
            next_status: nextStatus,
            next_deadlines: nextDeadlines,
            next_started_at: nextStartedAt,
            next_completed_at: nextCompletedAt,
            next_reveal_map: nextRevealMap
        });

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                throw new Error("频道轮次字段还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }

        const refreshedChannelResponse = await client
            .from("channels")
            .select(channelSelectFields)
            .eq("id", channel.id)
            .single();

        if (refreshedChannelResponse.error) {
            if (isSchemaCompatibilityError(refreshedChannelResponse.error)) {
                throw new Error("频道轮次字段还没同步到数据库，请先应用最新 migration。");
            }
            throw refreshedChannelResponse.error;
        }

        const refreshedChannelRow = {
            ...channel,
            ...(refreshedChannelResponse.data || {}),
            logo_url: channel.logo_url || channel.logoUrl || defaultChannelLogo,
            background_url: channel.background_url || channel.backgroundUrl || defaultChannelBackground
        };

        const syncedChannelRow = await syncChannelCaches(refreshedChannelRow);

        return normalizeChannel(syncedChannelRow);
    },
    async resetChannelRoundProgress() {
        const channel = ensureLoadedChannel();
        if (!channel.id) {
            throw new Error("频道还没有初始化到数据库。");
        }

        const client = getSupabaseClient();
        const { error } = await client.rpc("reset_channel_round_progress", {
            target_channel_id: channel.id
        });

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                throw new Error("回合重置函数还没同步到数据库，请先应用最新 migration。");
            }
            throw error;
        }
    }
});
