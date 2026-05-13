import { createClient } from "@supabase/supabase-js";
import { defaultRoundDeadlines } from "../src/entities/channel/config.js";
import { defaultAnonymousProfiles, defaultRealIdentity, mentionMembers } from "../src/entities/identity/config.js";
import { runtimeConfig } from "../src/shared/config/runtime-config.js";
import { getPostPreviewText } from "../src/shared/lib/helpers.js";
import { isEntryOwnedByIdentity } from "../src/shared/lib/anonymous-display.js";
import {
    createChannelRoundRepository,
    getRoundStartTimestamp,
    normalizeRevealMap,
    normalizeRevealParty,
    normalizeRoundDeadlines,
    normalizeRoundStage,
    normalizeRoundStatus
} from "../src/shared/data/channel-round-repository.js";

const channelShellCacheTtl = 24 * 60 * 60 * 1000;
const channelMemberCacheTtl = 10 * 60 * 1000;
const channelFeedCacheTtl = 12 * 60 * 60 * 1000;
const defaultChannelLogo = "https://lh3.googleusercontent.com/aida-public/AB6AXuDJUmmuvmt3jmrXR6sjC-XgIw7ZpGWHK2ClL0rFR7fWwCkwWqjrmHW39Py4Oi-W0kn2oYCMKoNVvH5vAdlhcYDzUfqmH67hsNpn2JEEuVJNKGnXMflYRLFqtaIpQdlJrUocYHAsapz8CAuaAK8kSS0EGaoQfWEx31DipdiQCFDAFw-1EVVf3XaU8tzBCxY_HmC9peicAbPCoNUtPvO-SwM7dKIClndraRoa0_3S5laPdFIz7G3On8LqOlZSEB-nMy5BSBAljxc7jIw";
const defaultChannelBackground = "";
const memberAvatarByName = new Map(mentionMembers.map((member) => [member.name, member.avatar || ""]));

const channelSelectFields = "id, slug, name, description, created_by, preview_visibility, join_policy, current_round_id, round_operation_state, current_round_theme, current_round_god_name, current_round_god_avatar, current_reveal_map, current_round_stage, current_round_status, current_round_deadlines, current_round_started_at, current_round_completed_at";
const minimalChannelSelectFields = "id, slug, name, description, created_by, visibility";
const identitySelectFields = "id, channel_id, user_id, display_name, avatar_url, role, current_claim_post_id, current_claim_selected_at, current_guess_name, current_guess_avatar, current_guess_selected_at";
const legacyIdentitySelectFields = "id, channel_id, user_id, display_name, avatar_url, role";
const aliasSelectFields = "id, slot_key, display_name, avatar_url, status, last_used_at, created_at";
const joinRequestSelectFields = "id, channel_id, user_id, status, message, review_note, reviewed_by, reviewed_at, created_at, updated_at";
const roundSelectFields = "id, channel_id, lifecycle_status, archive_mode, title, default_title, theme, god_profile, current_stage, reveal_map, deadlines, started_at, completed_at, force_archive_reason, completion_snapshot, source_round_id, view_only_reason, created_at, updated_at";
const roundMemberSelectFields = "id, round_id, user_id, identity_id, display_name_snapshot, avatar_snapshot, role_snapshot, claim_post_id, claim_selected_at, guess_target_user_id, guess_target_name_snapshot, guess_target_avatar_snapshot, guess_selected_at, created_at, updated_at";
const commentSelectFields = `
    id,
    round_id,
    body,
    likes_count,
    parent_comment_id,
    deleted_at,
    deleted_by,
    deleted_snapshot,
    author_snapshot,
    created_at,
    identity:identities!comments_identity_id_fkey (
        id,
        user_id,
        display_name,
        avatar_url,
        role
    ),
    alias_session:alias_sessions!comments_alias_session_id_fkey (
        id,
        slot_key,
        display_name,
        avatar_url,
        identity:identities!alias_sessions_identity_id_fkey (
            id,
            user_id,
            display_name,
            avatar_url,
            role
        )
    )
`;
const legacyCommentSelectFields = `
    id,
    round_id,
    body,
    created_at,
    author_snapshot,
    identity:identities!comments_identity_id_fkey (
        id,
        user_id,
        display_name,
        avatar_url,
        role
    ),
    alias_session:alias_sessions!comments_alias_session_id_fkey (
        id,
        slot_key,
        display_name,
        avatar_url,
        identity:identities!alias_sessions_identity_id_fkey (
            id,
            user_id,
            display_name,
            avatar_url,
            role
        )
    )
`;
const postSelectFields = `
    id,
    round_id,
    board_slug,
    body,
    media,
    ai_disclosure,
    views_count,
    likes_count,
    shares_count,
    deleted_at,
    deleted_by,
    deleted_snapshot,
    author_snapshot,
    created_at,
    identity:identities!posts_identity_id_fkey (
        id,
        user_id,
        display_name,
        avatar_url,
        role
    ),
    alias_session:alias_sessions!posts_alias_session_id_fkey (
        id,
        slot_key,
        display_name,
        avatar_url,
        identity:identities!alias_sessions_identity_id_fkey (
            id,
            user_id,
            display_name,
            avatar_url,
            role
        )
    ),
    comments (${commentSelectFields})
`;
const legacyPostSelectFields = `
    id,
    round_id,
    board_slug,
    body,
    media,
    ai_disclosure,
    views_count,
    likes_count,
    shares_count,
    author_snapshot,
    created_at,
    identity:identities!posts_identity_id_fkey (
        id,
        user_id,
        display_name,
        avatar_url,
        role
    ),
    alias_session:alias_sessions!posts_alias_session_id_fkey (
        id,
        slot_key,
        display_name,
        avatar_url,
        identity:identities!alias_sessions_identity_id_fkey (
            id,
            user_id,
            display_name,
            avatar_url,
            role
        )
    ),
    comments (${legacyCommentSelectFields})
`;

const getRelativeTimeLabel = (timestamp) => {
    const diffMs = Date.now() - Date.parse(timestamp);
    if (Number.isNaN(diffMs) || diffMs < 5 * 60 * 1000) {
        return "刚刚";
    }

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) {
        return `${Math.max(1, diffHours)}小时前`;
    }

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `${Math.max(1, diffDays)}天前`;
};

const decodeJwtPayload = (token) => {
    if (!token) {
        return {};
    }

    const payload = token.split(".")[1];
    if (!payload) {
        return {};
    }

    try {
        const decoded = payload.replace(/-/g, "+").replace(/_/g, "/");
        const normalized = decoded.padEnd(decoded.length + ((4 - (decoded.length % 4)) % 4), "=");
        return JSON.parse(window.atob(normalized));
    } catch {
        return {};
    }
};

const normalizeUser = (user) => {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email || "",
        phone: user.phone || "",
        lastSignInAt: user.last_sign_in_at || "",
        identities: Array.isArray(user.identities) ? user.identities.map((identity) => ({ ...identity })) : []
    };
};

const normalizeChannel = (channel) => ({
    id: channel.id,
    slug: channel.slug,
    name: channel.name,
    description: channel.description || "",
    logoUrl: channel.logo_url || channel.logoUrl || defaultChannelLogo,
    backgroundUrl: channel.background_url || channel.backgroundUrl || defaultChannelBackground,
    previewVisibility: channel.preview_visibility || channel.visibility || "private",
    joinPolicy: channel.join_policy || "open",
    currentRoundId: channel.current_round_id || channel.currentRoundId || null,
    roundOperationState: channel.round_operation_state || channel.roundOperationState || "idle",
    currentRoundTheme: String(channel.current_round_theme || channel.currentRoundTheme || "").trim(),
    currentRoundGodProfile: channel.current_round_god_name || channel.currentRoundGodName
        ? {
            userId: channel.currentRoundGodProfile?.userId || null,
            name: channel.current_round_god_name || channel.currentRoundGodName || "",
            avatar: channel.current_round_god_avatar || channel.currentRoundGodAvatar || ""
        }
        : null,
    currentRoundStage: normalizeRoundStage(channel.current_round_stage || channel.currentRoundStage),
    currentRoundStatus: normalizeRoundStatus(channel.current_round_status || channel.currentRoundStatus),
    currentRoundDeadlines: normalizeRoundDeadlines(channel.current_round_deadlines || channel.currentRoundDeadlines),
    currentRoundStartedAt: channel.current_round_started_at || channel.currentRoundStartedAt || null,
    currentRoundCompletedAt: channel.current_round_completed_at || channel.currentRoundCompletedAt || null,
    currentRevealMap: normalizeRevealMap(channel.current_reveal_map || channel.currentRevealMap),
    isProvisioned: channel.id !== null
});

const normalizeRoundDeadlineEntry = (value, fallbackLabel = "") => (
    value && typeof value === "object"
        ? {
            label: String(value.label || fallbackLabel || "").trim(),
            deadlineAt: value.deadlineAt || null
        }
        : {
            label: String(value || fallbackLabel || "").trim(),
            deadlineAt: null
        }
);

const normalizeStructuredRoundDeadlines = (value) => {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(
        Object.entries(defaultRoundDeadlines).map(([stage, label]) => [
            stage,
            normalizeRoundDeadlineEntry(source[stage], label)
        ])
    );
};

const normalizeRoundRow = (round) => ({
    id: round?.id || null,
    channelId: round?.channel_id || round?.channelId || null,
    lifecycleStatus: String(round?.lifecycle_status || round?.lifecycleStatus || "active").trim() || "active",
    archiveMode: String(round?.archive_mode || round?.archiveMode || "").trim() || null,
    title: String(round?.title || "").trim(),
    defaultTitle: String(round?.default_title || round?.defaultTitle || "").trim(),
    theme: String(round?.theme || "").trim(),
    godProfile: round?.god_profile && typeof round.god_profile === "object"
        ? {
            userId: round.god_profile.userId || round.god_profile.user_id || null,
            name: String(round.god_profile.name || "").trim(),
            avatar: String(round.god_profile.avatar || "").trim()
        }
        : round?.godProfile && typeof round.godProfile === "object"
            ? {
                userId: round.godProfile.userId || round.godProfile.user_id || null,
                name: String(round.godProfile.name || "").trim(),
                avatar: String(round.godProfile.avatar || "").trim()
            }
            : null,
    currentStage: normalizeRoundStage(round?.current_stage || round?.currentStage),
    revealMap: normalizeRevealMap(round?.reveal_map || round?.revealMap),
    deadlines: normalizeStructuredRoundDeadlines(round?.deadlines),
    startedAt: round?.started_at || round?.startedAt || null,
    completedAt: round?.completed_at || round?.completedAt || null,
    forceArchiveReason: String(round?.force_archive_reason || round?.forceArchiveReason || "").trim(),
    completionSnapshot: round?.completion_snapshot && typeof round.completion_snapshot === "object"
        ? round.completion_snapshot
        : round?.completionSnapshot && typeof round.completionSnapshot === "object"
            ? round.completionSnapshot
            : {},
    sourceRoundId: round?.source_round_id || round?.sourceRoundId || null,
    viewOnlyReason: String(round?.view_only_reason || round?.viewOnlyReason || "").trim() || null,
    createdAt: round?.created_at || round?.createdAt || null,
    updatedAt: round?.updated_at || round?.updatedAt || null
});

const normalizeRoundMemberRow = (row) => ({
    id: row?.id || null,
    roundId: row?.round_id || row?.roundId || null,
    userId: row?.user_id || row?.userId || null,
    identityId: row?.identity_id || row?.identityId || null,
    displayNameSnapshot: String(row?.display_name_snapshot || row?.displayNameSnapshot || "").trim(),
    avatarSnapshot: String(row?.avatar_snapshot || row?.avatarSnapshot || "").trim(),
    roleSnapshot: String(row?.role_snapshot || row?.roleSnapshot || "member").trim() || "member",
    claimPostId: row?.claim_post_id || row?.claimPostId || null,
    claimSelectedAt: row?.claim_selected_at || row?.claimSelectedAt || null,
    guessTargetUserId: row?.guess_target_user_id || row?.guessTargetUserId || null,
    guessTargetNameSnapshot: String(row?.guess_target_name_snapshot || row?.guessTargetNameSnapshot || "").trim(),
    guessTargetAvatarSnapshot: String(row?.guess_target_avatar_snapshot || row?.guessTargetAvatarSnapshot || "").trim(),
    guessSelectedAt: row?.guess_selected_at || row?.guessSelectedAt || null,
    createdAt: row?.created_at || row?.createdAt || null,
    updatedAt: row?.updated_at || row?.updatedAt || null
});

const isSchemaCompatibilityError = (error) => {
    const code = String(error?.code || "");
    const message = String(error?.message || "").toLowerCase();
    return ["42703", "42P01", "42883", "PGRST202", "PGRST204"].includes(code)
        || message.includes("does not exist")
        || message.includes("schema cache")
        || message.includes("could not find the")
        || message.includes("likes_count")
        || message.includes("parent_comment_id")
        || message.includes("deleted_at")
        || message.includes("deleted_snapshot");
};

const getFallbackAuthor = (type) => ({
    display_name: type === "alias" ? "匿名成员" : "频道成员",
    avatar_url: "",
    role: "member"
});

const extractRevealMeta = (media) => {
    const items = Array.isArray(media) ? media : [];
    const revealEntry = items.find((item) => item && typeof item === "object" && String(item.kind || "").trim().toLowerCase() === "reveal_meta");
    if (!revealEntry?.realName) {
        return null;
    }

    return {
        name: String(revealEntry.realName).trim(),
        avatar: String(revealEntry.realAvatar || memberAvatarByName.get(String(revealEntry.realName).trim()) || "").trim()
    };
};

const extractDeliveryMeta = (media) => {
    const items = Array.isArray(media) ? media : [];
    const deliveryEntry = items.find((item) => item && typeof item === "object" && String(item.kind || "").trim().toLowerCase() === "delivery_meta");
    if (!deliveryEntry) {
        return null;
    }

    return {
        wishPostId: String(deliveryEntry.wishPostId || "").trim() || null,
        targetMemberName: String(deliveryEntry.targetMemberName || "").trim(),
        targetMemberAvatar: String(deliveryEntry.targetMemberAvatar || "").trim()
    };
};

const extractWishMeta = (media) => {
    const items = Array.isArray(media) ? media : [];
    const wishEntry = items.find((item) => item && typeof item === "object" && String(item.kind || "").trim().toLowerCase() === "wish_meta");
    if (!wishEntry) {
        return null;
    }

    const participantName = String(wishEntry.participantName || "").trim();
    const participantUserId = String(wishEntry.participantUserId || "").trim() || null;
    if (!participantName && !participantUserId) {
        return null;
    }

    return {
        participantUserId,
        participantName: participantName || "频道成员",
        participantAvatar: String(wishEntry.participantAvatar || "").trim(),
        submissionSource: String(wishEntry.submissionSource || "self").trim() || "self",
        recordedByUserId: String(wishEntry.recordedByUserId || "").trim() || null,
        recordedByName: String(wishEntry.recordedByName || "").trim()
    };
};

const extractRoundArchiveMeta = (media) => {
    const items = Array.isArray(media) ? media : [];
    const archiveEntry = items.find((item) => item && typeof item === "object" && String(item.kind || "").trim().toLowerCase() === "round_archive");
    if (!archiveEntry) {
        return null;
    }

    return {
        id: String(archiveEntry.archiveId || archiveEntry.id || "").trim() || null,
        theme: String(archiveEntry.theme || "").trim(),
        title: String(archiveEntry.title || "").trim(),
        summaryLine: String(archiveEntry.summaryLine || "").trim(),
        stage: String(archiveEntry.stage || "").trim() || "reveal",
        status: String(archiveEntry.status || "").trim() || "archived",
        startedAt: archiveEntry.startedAt || null,
        completedAt: archiveEntry.completedAt || null,
        godProfile: archiveEntry.godProfile && typeof archiveEntry.godProfile === "object"
            ? {
                name: String(archiveEntry.godProfile.name || "").trim(),
                avatar: String(archiveEntry.godProfile.avatar || "").trim()
            }
            : null,
        stats: archiveEntry.stats && typeof archiveEntry.stats === "object"
            ? {
                totalMembers: Number(archiveEntry.stats.totalMembers || 0),
                wishDone: Number(archiveEntry.stats.wishDone || 0),
                claimDone: Number(archiveEntry.stats.claimDone || 0),
                deliveryDone: Number(archiveEntry.stats.deliveryDone || 0),
                guessDone: Number(archiveEntry.stats.guessDone || 0),
                revealDone: Number(archiveEntry.stats.revealDone || 0),
                pairCount: Number(archiveEntry.stats.pairCount || 0)
            }
            : null,
        revealPairs: Array.isArray(archiveEntry.revealPairs)
            ? archiveEntry.revealPairs.map((pair) => ({
                member: normalizeRevealParty(pair?.member),
                angel: normalizeRevealParty(pair?.angel),
                wishPostId: String(pair?.wishPostId || "").trim() || null,
                wishPreview: String(pair?.wishPreview || "").trim(),
                guessedAngelName: String(pair?.guessedAngelName || "").trim(),
                guessedAngelAvatar: String(pair?.guessedAngelAvatar || "").trim(),
                updatedAt: pair?.updatedAt || null
            })).filter((pair) => pair.member?.name && pair.angel?.name)
            : []
    };
};

const extractMentionTargetName = (body) => {
    const firstLine = String(body || "").split(/\r?\n/, 1)[0]?.trim() || "";
    return firstLine.startsWith("@") ? firstLine.slice(1).trim() : "";
};

const normalizeAuthorSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
        return null;
    }

    return {
        kind: String(snapshot.kind || "").trim() || "identity",
        displayName: String(snapshot.displayName || snapshot.display_name || "").trim(),
        avatarUrl: String(snapshot.avatarUrl || snapshot.avatar_url || "").trim(),
        slotKey: String(snapshot.slotKey || snapshot.slot_key || "").trim() || null,
        realIdentity: snapshot.realIdentity && typeof snapshot.realIdentity === "object"
            ? {
                id: snapshot.realIdentity.id || null,
                userId: snapshot.realIdentity.userId || snapshot.realIdentity.user_id || null,
                displayName: String(snapshot.realIdentity.displayName || snapshot.realIdentity.display_name || "").trim(),
                avatarUrl: String(snapshot.realIdentity.avatarUrl || snapshot.realIdentity.avatar_url || "").trim(),
                role: String(snapshot.realIdentity.role || "member").trim() || "member"
            }
            : null
    };
};

const getAuthorFromSources = ({ identity, aliasSession, authorSnapshot }) => {
    const snapshot = normalizeAuthorSnapshot(authorSnapshot);
    if (snapshot?.displayName) {
        return {
            display_name: snapshot.displayName,
            avatar_url: snapshot.avatarUrl || "",
            user_id: snapshot.realIdentity?.userId || null,
            role: snapshot.realIdentity?.role || "member",
            slot_key: snapshot.slotKey || null,
            is_snapshot: true,
            is_alias: snapshot.kind === "alias",
            real_identity: snapshot.realIdentity
        };
    }

    if (identity) {
        return {
            ...identity,
            slot_key: null,
            is_snapshot: false,
            is_alias: false,
            real_identity: {
                id: identity.id || null,
                userId: identity.user_id || null,
                displayName: identity.display_name || "频道成员",
                avatarUrl: identity.avatar_url || "",
                role: identity.role || "member"
            }
        };
    }

    if (aliasSession) {
        return {
            display_name: aliasSession.display_name || "匿名成员",
            avatar_url: aliasSession.avatar_url || "",
            user_id: aliasSession.identity?.user_id || null,
            role: aliasSession.identity?.role || "member",
            slot_key: aliasSession.slot_key || null,
            is_snapshot: false,
            is_alias: true,
            real_identity: aliasSession.identity
                ? {
                    id: aliasSession.identity.id || null,
                    userId: aliasSession.identity.user_id || null,
                    displayName: aliasSession.identity.display_name || "频道成员",
                    avatarUrl: aliasSession.identity.avatar_url || "",
                    role: aliasSession.identity.role || "member"
                }
                : null
        };
    }

    return {
        ...getFallbackAuthor("identity"),
        user_id: null,
        role: "member",
        slot_key: null,
        is_snapshot: false,
        is_alias: false,
        real_identity: null
    };
};

const getAdminRevealIdentity = (aliasSession, media) => {
    const revealMeta = extractRevealMeta(media);
    if (revealMeta?.name) {
        return {
            id: aliasSession?.identity?.id || null,
            name: revealMeta.name,
            avatar: revealMeta.avatar || "",
            role: aliasSession?.identity?.role || "member"
        };
    }

    return aliasSession?.identity
        ? {
            id: aliasSession.identity.id,
            name: aliasSession.identity.display_name || "频道成员",
            avatar: aliasSession.identity.avatar_url || "",
            role: aliasSession.identity.role || "member"
        }
        : null;
};

const normalizeCommentRow = (commentRow) => {
    const author = getAuthorFromSources({
        identity: commentRow.identity,
        aliasSession: commentRow.alias_session,
        authorSnapshot: commentRow.author_snapshot
    });
    const isDeleted = Boolean(commentRow.deleted_at);
    return {
        id: commentRow.id,
        roundId: commentRow.round_id || null,
        aliasKey: author.slot_key || null,
        authorName: author.display_name || "频道成员",
        authorAvatar: author.avatar_url || "",
        authorUserId: author.user_id || author.real_identity?.userId || null,
        isAnonymous: author.is_alias,
        createdAt: commentRow.created_at,
        timeLabel: getRelativeTimeLabel(commentRow.created_at),
        likes: isDeleted ? 0 : (commentRow.likes_count || 0),
        parentCommentId: commentRow.parent_comment_id || null,
        text: isDeleted ? "该评论已删除" : commentRow.body,
        isDeleted,
        deletedAt: commentRow.deleted_at || null,
        deletedBy: commentRow.deleted_by || null,
        deletedByModerator: Boolean(commentRow.deleted_snapshot?.deleted_by_moderator),
        deletedLabel: isDeleted ? "该评论已删除" : "",
        adminRevealIdentity: author.real_identity
            ? {
                id: author.real_identity.id || null,
                name: author.real_identity.displayName || "频道成员",
                avatar: author.real_identity.avatarUrl || "",
                role: author.real_identity.role || "member"
            }
            : getAdminRevealIdentity(commentRow.alias_session)
    };
};

const normalizeChannelRowCompatibility = (channel) => ({
    ...channel,
    preview_visibility: channel.preview_visibility || channel.visibility || "private",
    join_policy: channel.join_policy || "open",
    current_round_id: channel.current_round_id || channel.currentRoundId || null,
    round_operation_state: channel.round_operation_state || channel.roundOperationState || "idle",
    current_round_theme: String(channel.current_round_theme || channel.currentRoundTheme || "").trim(),
    current_round_god_name: channel.current_round_god_name || channel.currentRoundGodName || channel.currentRoundGodProfile?.name || null,
    current_round_god_avatar: channel.current_round_god_avatar || channel.currentRoundGodAvatar || channel.currentRoundGodProfile?.avatar || "",
    current_round_stage: normalizeRoundStage(channel.current_round_stage || channel.currentRoundStage),
    current_round_status: normalizeRoundStatus(channel.current_round_status || channel.currentRoundStatus),
    current_round_deadlines: normalizeStructuredRoundDeadlines(channel.current_round_deadlines || channel.currentRoundDeadlines),
    current_round_started_at: channel.current_round_started_at || channel.currentRoundStartedAt || null,
    current_round_completed_at: channel.current_round_completed_at || channel.currentRoundCompletedAt || null,
    current_reveal_map: channel.current_reveal_map && typeof channel.current_reveal_map === "object"
        ? channel.current_reveal_map
        : channel.currentRevealMap && typeof channel.currentRevealMap === "object"
            ? channel.currentRevealMap
            : {}
});

const normalizePostMedia = (media) => {
    const items = Array.isArray(media) ? media : [];
    const images = [];
    const audioClips = [];

    items.forEach((item, index) => {
        if (!item || typeof item !== "object") {
            return;
        }

        const normalizedKind = String(item.kind || "").trim().toLowerCase();
        if (normalizedKind === "audio") {
            audioClips.push({
                id: item.id || `audio-${index}`,
                kind: "audio",
                name: item.name || `语音 ${index + 1}`,
                url: item.url || "",
                mimeType: item.mimeType || "audio/webm"
            });
            return;
        }

        if (normalizedKind === "image" || !normalizedKind) {
            images.push({
                id: item.id || `image-${index}`,
                kind: "image",
                name: item.name || `图片 ${index + 1}`,
                url: item.url || ""
            });
        }
    });

    return { images, audioClips };
};

const normalizePostRow = (postRow) => {
    const author = getAuthorFromSources({
        identity: postRow.identity,
        aliasSession: postRow.alias_session,
        authorSnapshot: postRow.author_snapshot
    });
    const isDeleted = Boolean(postRow.deleted_at);
    const media = normalizePostMedia(postRow.media);
    const deliveryMeta = extractDeliveryMeta(postRow.media);
    const wishMeta = extractWishMeta(postRow.media);
    const roundArchive = extractRoundArchiveMeta(postRow.media);
    const comments = [...(postRow.comments || [])]
        .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
        .map(normalizeCommentRow);
    const wishParticipantRevealIdentity = wishMeta?.participantName
        ? {
            id: wishMeta.participantUserId || null,
            name: wishMeta.participantName,
            avatar: wishMeta.participantAvatar || "",
            role: "member"
        }
        : null;

    return {
        id: postRow.id,
        roundId: postRow.round_id || null,
        aliasKey: author.slot_key || null,
        authorName: author.display_name || "频道成员",
        authorAvatar: author.avatar_url || "",
        authorUserId: author.user_id || author.real_identity?.userId || null,
        createdAt: postRow.created_at,
        text: isDeleted ? "该帖子已删除" : postRow.body,
        images: isDeleted ? [] : media.images,
        audioClips: isDeleted ? [] : media.audioClips,
        board: postRow.board_slug || "none",
        isAnonymous: author.is_alias,
        isDeleted,
        deletedAt: postRow.deleted_at || null,
        deletedBy: postRow.deleted_by || null,
        deletedByModerator: Boolean(postRow.deleted_snapshot?.deleted_by_moderator),
        deletedLabel: isDeleted ? "该帖子已删除" : "",
        role: author.role || author.real_identity?.role || "member",
        timeLabel: getRelativeTimeLabel(postRow.created_at),
        dateLabel: postRow.created_at.slice(0, 10),
        views: postRow.views_count,
        likes: isDeleted ? 0 : postRow.likes_count,
        shares: isDeleted ? 0 : postRow.shares_count,
        comments,
        aiDisclosure: isDeleted ? "none" : (postRow.ai_disclosure || "none"),
        adminRevealIdentity: postRow.board_slug === "wish" && wishParticipantRevealIdentity
            ? wishParticipantRevealIdentity
            : author.real_identity
            ? {
                id: author.real_identity.id || null,
                name: author.real_identity.displayName || "频道成员",
                avatar: author.real_identity.avatarUrl || "",
                role: author.real_identity.role || "member"
            }
            : getAdminRevealIdentity(postRow.alias_session, postRow.media),
        deliveryMeta,
        wishMeta,
        roundArchive,
        authorSnapshot: normalizeAuthorSnapshot(postRow.author_snapshot)
    };
};

const buildClaimSelectionFromPost = (post) => {
    if (!post?.id) {
        return null;
    }

    const preview = getPostPreviewText(post, 88);
    const targetIdentity = post.adminRevealIdentity || null;
    return {
        postId: post.id,
        board: post.board || "wish",
        authorName: targetIdentity?.name || post.authorName || "匿名成员",
        authorAvatar: targetIdentity?.avatar || post.authorAvatar || "",
        previewText: preview.text || "",
        createdAt: post.createdAt || new Date().toISOString()
    };
};

const normalizeClaimSelection = (post) => {
    const selection = buildClaimSelectionFromPost(post);
    return selection?.postId ? selection : null;
};

const normalizeGuessSelection = (selection) => {
    const normalized = normalizeRevealParty(selection);
    if (!normalized?.name) {
        return null;
    }

    return {
        name: normalized.name,
        avatar: normalized.avatar || "",
        selectedAt: selection?.selectedAt || selection?.selected_at || null
    };
};

const normalizeJoinRequest = (requestRow, profileByUserId = new Map()) => {
    const profile = profileByUserId.get(requestRow.user_id) || {};
    return {
        id: requestRow.id,
        channelId: requestRow.channel_id,
        userId: requestRow.user_id,
        status: requestRow.status,
        message: requestRow.message || "",
        reviewNote: requestRow.review_note || "",
        reviewedBy: requestRow.reviewed_by || null,
        reviewedAt: requestRow.reviewed_at || null,
        createdAt: requestRow.created_at,
        updatedAt: requestRow.updated_at,
        applicantName: profile.display_name || "待审核成员",
        applicantAvatar: profile.avatar_url || ""
    };
};

const slugifyChannelName = (name) => {
    const normalized = String(name || "")
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return normalized;
};

const createRandomSlugTail = () => Math.random().toString(36).slice(2, 8);
const getSessionStorage = () => {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
};

const getLocalStorage = () => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const getChannelShellCacheKey = (slug) => `channel-shell:${slug}`;
const getChannelMemberCacheKey = (slug, userKey) => `channel-member:${slug}:${userKey}`;
const getChannelFeedCacheKey = (slug, boardSlug = "__all__", roundScope = "current") => `channel-feed:${slug}:${roundScope || "current"}:${boardSlug || "__all__"}`;
const getChannelPostCacheKey = (slug, postId) => `channel-post:${slug}:${postId}`;

const readSessionCache = (key, ttl) => {
    const storage = getSessionStorage();
    if (!storage) {
        return null;
    }

    try {
        const rawValue = storage.getItem(key);
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);
        if (!parsed?.savedAt || !("data" in parsed)) {
            storage.removeItem(key);
            return null;
        }

        if (Date.now() - parsed.savedAt > ttl) {
            storage.removeItem(key);
            return null;
        }

        return parsed.data;
    } catch {
        storage.removeItem(key);
        return null;
    }
};

const writeSessionCache = (key, data) => {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(key, JSON.stringify({
            savedAt: Date.now(),
            data
        }));
    } catch {
        // Ignore cache write failures.
    }
};

const readLocalCache = (key, ttl) => {
    const storage = getLocalStorage();
    if (!storage) {
        return null;
    }

    try {
        const rawValue = storage.getItem(key);
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);
        if (!parsed?.savedAt || !("data" in parsed)) {
            storage.removeItem(key);
            return null;
        }

        if (Date.now() - parsed.savedAt > ttl) {
            storage.removeItem(key);
            return null;
        }

        return parsed.data;
    } catch {
        storage.removeItem(key);
        return null;
    }
};

const writeLocalCache = (key, data) => {
    const storage = getLocalStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(key, JSON.stringify({
            savedAt: Date.now(),
            data
        }));
    } catch {
        // Ignore cache write failures.
    }
};

const readBestEffortCache = (key, ttl) => readSessionCache(key, ttl) || readLocalCache(key, ttl);

const cloneCachedPost = (post) => ({
    ...post,
    images: [...(post.images || [])],
    audioClips: [...(post.audioClips || [])],
    deliveryMeta: post.deliveryMeta ? { ...post.deliveryMeta } : null,
    wishMeta: post.wishMeta ? { ...post.wishMeta } : null,
    roundArchive: post.roundArchive
        ? {
            ...post.roundArchive,
            godProfile: post.roundArchive.godProfile ? { ...post.roundArchive.godProfile } : null,
            stats: post.roundArchive.stats ? { ...post.roundArchive.stats } : null,
            revealPairs: (post.roundArchive.revealPairs || []).map((pair) => ({
                ...pair,
                member: pair.member ? { ...pair.member } : null,
                angel: pair.angel ? { ...pair.angel } : null
            }))
        }
        : null,
    comments: (post.comments || []).map((comment) => ({ ...comment }))
});

const cloneCachedPosts = (items) => (Array.isArray(items) ? items.map(cloneCachedPost) : []);

export const createChannelDataServiceContext = () => {
    const postCache = new Map();
    const runtimeState = {
        channel: null,
        authUser: null,
        identity: null,
        aliasProfiles: []
    };
    const context = { api: null };

    let supabaseClient = null;

    const getSupabaseClient = () => {
        if (supabaseClient) {
            return supabaseClient;
        }

        if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabasePublishableKey) {
            throw new Error("Supabase runtime config is missing.");
        }

        supabaseClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });

        return supabaseClient;
    };

    const ensureLoadedChannel = () => {
        if (!runtimeState.channel) {
            throw new Error("Channel preview has not been initialized.");
        }
        return runtimeState.channel;
    };

    const cachePosts = (posts) => {
        postCache.clear();
        posts.forEach((post) => {
            postCache.set(post.id, post);
        });
        return posts;
    };

    const createFallbackChannelRow = (slug) => ({
        id: null,
        slug,
        name: runtimeConfig.channelName || slug,
        description: "",
        logo_url: defaultChannelLogo,
        background_url: defaultChannelBackground,
        created_by: null,
        preview_visibility: "public",
        join_policy: "open",
        current_round_id: null,
        round_operation_state: "idle",
        current_round_theme: "",
        current_round_god_name: null,
        current_round_god_avatar: "",
        current_round_stage: "wish",
        current_round_status: "active",
        current_round_deadlines: normalizeStructuredRoundDeadlines(defaultRoundDeadlines),
        current_round_started_at: null,
        current_round_completed_at: null
    });

    const getUserCacheKey = (snapshot) => {
        if (!snapshot?.user?.id || snapshot.isAnonymous) {
            return "guest";
        }
        return snapshot.user.id;
    };

    const syncChannelCaches = async (channelRow) => {
        const normalizedRow = normalizeChannelRowCompatibility(channelRow);
        const slug = normalizedRow.slug || runtimeConfig.channelSlug || "";
        runtimeState.channel = normalizedRow;
        writeSessionCache(getChannelShellCacheKey(slug), normalizedRow);
        writeLocalCache(getChannelShellCacheKey(slug), normalizedRow);

        const snapshot = await getSessionSnapshot();
        const memberCacheKey = getChannelMemberCacheKey(slug, getUserCacheKey(snapshot));
        const cachedMember = readBestEffortCache(memberCacheKey, channelMemberCacheTtl);
        if (!cachedMember?.memberRuntime) {
            return normalizedRow;
        }

        const nextMemberCache = {
            ...cachedMember,
            memberRuntime: {
                ...cachedMember.memberRuntime,
                channel: normalizeChannel(normalizedRow)
            }
        };
        writeSessionCache(memberCacheKey, nextMemberCache);
        writeLocalCache(memberCacheKey, nextMemberCache);

        return normalizedRow;
    };

    const getShellChannel = (slug = runtimeConfig.channelSlug || "") => {
        const cachedShell = readBestEffortCache(getChannelShellCacheKey(slug), channelShellCacheTtl);
        if (cachedShell) {
            return normalizeChannel(cachedShell);
        }

        if (runtimeState.channel?.slug === slug) {
            return normalizeChannel(runtimeState.channel);
        }

        return normalizeChannel(createFallbackChannelRow(slug));
    };

    const getSessionSnapshot = async () => {
        const client = getSupabaseClient();
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData.session;
        if (!session?.user) {
            runtimeState.authUser = null;
            return {
                user: null,
                isAnonymous: false,
                accessToken: ""
            };
        }

        const jwtPayload = decodeJwtPayload(session.access_token);
        const snapshot = {
            user: normalizeUser(session.user),
            isAnonymous: Boolean(jwtPayload.is_anonymous),
            accessToken: session.access_token
        };

        runtimeState.authUser = snapshot.user;
        return snapshot;
    };

    const ensureProfile = async (preferredDisplayName = "") => {
        const user = runtimeState.authUser;
        if (!user?.id) {
            return null;
        }

        const client = getSupabaseClient();
        const { data: existingProfile, error: profileError } = await client
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (existingProfile) {
            const nextDisplayName = String(preferredDisplayName || "").trim();
            if (!existingProfile.display_name && nextDisplayName) {
                const { data: updatedProfile, error: updateError } = await client
                    .from("profiles")
                    .update({
                        display_name: nextDisplayName
                    })
                    .eq("id", user.id)
                    .select("id, display_name, avatar_url")
                    .single();

                if (updateError) {
                    throw updateError;
                }

                return updatedProfile;
            }

            return existingProfile;
        }

        const fallbackName = String(preferredDisplayName || "").trim() || (user.email ? user.email.split("@")[0] : "");
        const { data: createdProfile, error: insertError } = await client
            .from("profiles")
            .insert({
                id: user.id,
                display_name: fallbackName || null
            })
            .select("id, display_name, avatar_url")
            .single();

        if (insertError) {
            throw insertError;
        }

        return createdProfile;
    };

    const tryInvokeAnonymousAnonymizer = async ({
        text = "",
        purpose = "post",
        channelId = null,
        images = [],
        reshapeImages = false
    }) => {
        try {
            const client = getSupabaseClient();
            const normalizedText = String(text || "").trim();
            const normalizedImages = Array.isArray(images)
                ? images
                    .map((image) => ({
                        name: String(image?.name || ""),
                        url: String(image?.url || "")
                    }))
                    .filter((image) => image.url.startsWith("data:image/"))
                : [];

            if (!normalizedText && !normalizedImages.length) {
                return null;
            }

            const { data, error } = await client.functions.invoke("anonymous-anonymize", {
                body: {
                    text: normalizedText,
                    purpose,
                    channelId,
                    images: normalizedImages,
                    reshapeImages
                }
            });

            if (error) {
                return null;
            }

            if (typeof data?.text !== "string" || !data.text.trim()) {
                return null;
            }

            return {
                text: data.text.trim(),
                provider: typeof data.provider === "string" ? data.provider : "ai",
                images: Array.isArray(data?.images)
                    ? data.images
                        .map((image) => ({
                            name: String(image?.name || ""),
                            url: String(image?.url || "")
                        }))
                        .filter((image) => image.url.startsWith("data:image/"))
                    : []
            };
        } catch {
            return null;
        }
    };

    const fetchRoundRow = async (roundId) => {
        if (!roundId) {
            return null;
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channel_rounds")
            .select(roundSelectFields)
            .eq("id", roundId)
            .maybeSingle();

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                return null;
            }
            throw error;
        }

        return data ? normalizeRoundRow(data) : null;
    };

    const fetchRoundMembers = async (roundId) => {
        if (!roundId) {
            return [];
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channel_round_members")
            .select(roundMemberSelectFields)
            .eq("round_id", roundId)
            .order("display_name_snapshot", { ascending: true });

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                return [];
            }
            throw error;
        }

        return (data || []).map(normalizeRoundMemberRow);
    };

    const fetchArchivedRoundRows = async (channelId) => {
        if (!channelId) {
            return [];
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channel_rounds")
            .select(roundSelectFields)
            .eq("channel_id", channelId)
            .eq("lifecycle_status", "archived")
            .order("completed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                return [];
            }
            throw error;
        }

        return (data || []).map(normalizeRoundRow);
    };

    const fetchPosts = async (boardSlug = null, options = {}) => {
        const client = getSupabaseClient();
        const channel = ensureLoadedChannel();
        const roundId = options.roundId || channel.current_round_id || channel.currentRoundId || null;
        if (!roundId) {
            return [];
        }
        const runQuery = (selectFields) => {
            let query = client
                .from("posts")
                .select(selectFields)
                .eq("channel_id", channel.id)
                .eq("round_id", roundId)
                .order("created_at", { ascending: false });

            if (boardSlug) {
                query = query.eq("board_slug", boardSlug);
            }

            return query;
        };

        let response = await runQuery(postSelectFields);
        if (response.error && isSchemaCompatibilityError(response.error)) {
            response = await runQuery(legacyPostSelectFields);
        }

        if (response.error) {
            throw response.error;
        }

        const items = cachePosts((response.data || []).map(normalizePostRow));
        if (channel.slug) {
            writeLocalCache(getChannelFeedCacheKey(channel.slug, boardSlug, roundId), items);
            items.forEach((post) => {
                writeLocalCache(getChannelPostCacheKey(channel.slug, post.id), post);
            });
        }
        return items;
    };

    const fetchRoundPosts = async (roundId, boardSlug = null) => fetchPosts(boardSlug, { roundId });

    const fetchPostById = async (channelId, postId) => {
        const client = getSupabaseClient();
        let response = await client
            .from("posts")
            .select(postSelectFields)
            .eq("id", postId)
            .eq("channel_id", channelId)
            .single();

        if (response.error && isSchemaCompatibilityError(response.error)) {
            response = await client
                .from("posts")
                .select(legacyPostSelectFields)
                .eq("id", postId)
                .eq("channel_id", channelId)
                .single();
        }

        if (response.error) {
            throw response.error;
        }

        const post = normalizePostRow(response.data);
        postCache.set(post.id, post);
        if (runtimeState.channel?.slug) {
            writeLocalCache(getChannelPostCacheKey(runtimeState.channel.slug, post.id), post);
        }
        return post;
    };

    const roundRepository = createChannelRoundRepository({
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
    });

    const rolePriorityByValue = {
        owner: 0,
        admin: 1,
        member: 2
    };

    const getRolePriority = (role) => rolePriorityByValue[String(role || "member").trim()] ?? 99;

    const pickPreferredIdentityRow = (rows = []) => [...rows]
        .sort((left, right) => {
            const priorityGap = getRolePriority(left?.role) - getRolePriority(right?.role);
            if (priorityGap !== 0) {
                return priorityGap;
            }

            const rightUpdatedAt = Date.parse(right?.updated_at || right?.updatedAt || right?.created_at || right?.createdAt || 0);
            const leftUpdatedAt = Date.parse(left?.updated_at || left?.updatedAt || left?.created_at || left?.createdAt || 0);
            return rightUpdatedAt - leftUpdatedAt;
        })[0] || null;

    const fetchIdentityRow = async ({ identityId = null, channelId = null, userId = null }) => {
        const client = getSupabaseClient();
        const runQuery = (selectFields) => {
            const query = client
                .from("identities")
                .select(selectFields);

            if (identityId) {
                return query.eq("id", identityId).single();
            }

            return query
                .eq("channel_id", channelId)
                .eq("user_id", userId);
        };

        let response = await runQuery(identitySelectFields);
        if (response.error && isSchemaCompatibilityError(response.error)) {
            response = await runQuery(legacyIdentitySelectFields);
        }

        if (response.error) {
            throw response.error;
        }

        const row = identityId
            ? response.data
            : pickPreferredIdentityRow(Array.isArray(response.data) ? response.data : []);
        if (!row) {
            throw new Error("频道成员身份尚未初始化完成。");
        }

        return {
            current_claim_post_id: null,
            current_claim_selected_at: null,
            current_guess_name: null,
            current_guess_avatar: null,
            current_guess_selected_at: null,
            ...row
        };
    };

    const countPublicPosts = async (channelId) => {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from("posts")
            .select("id")
            .eq("channel_id", channelId);

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                return 0;
            }
            throw error;
        }

        return (data || []).length;
    };

    const mapAliasProfiles = (aliasRows) => {
        const normalizedRows = [...(aliasRows || [])]
            .sort((left, right) => {
                const statusWeight = (right.status === "active") - (left.status === "active");
                if (statusWeight !== 0) {
                    return statusWeight;
                }

                const rightTime = Date.parse(right.last_used_at || right.created_at || 0);
                const leftTime = Date.parse(left.last_used_at || left.created_at || 0);
                return rightTime - leftTime;
            });

        if (!normalizedRows.length) {
            return defaultAnonymousProfiles.map((profile) => ({
                id: null,
                key: profile.key,
                name: profile.name,
                avatar: profile.avatar,
                status: "active"
            }));
        }

        return normalizedRows.map((alias, index) => {
            const fallbackProfile = defaultAnonymousProfiles[index % defaultAnonymousProfiles.length];
            return {
                id: alias.id || null,
                key: alias.slot_key,
                name: alias.display_name || fallbackProfile.name,
                avatar: alias.avatar_url || fallbackProfile.avatar,
                status: alias.status || "active"
            };
        });
    };

    const createAliasSlotKey = () => `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const getCurrentMembership = async (channelId) => {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc("get_my_channel_membership", {
            target_channel_id: channelId
        });

        if (error) {
            if (isSchemaCompatibilityError(error)) {
                return null;
            }
            throw error;
        }

        const membershipRow = Array.isArray(data) ? data[0] || null : data || null;
        if (!membershipRow) {
            return null;
        }

        return {
            status: membershipRow.status || "guest",
            role: membershipRow.role || null,
            identityId: membershipRow.identity_id || null,
            displayName: membershipRow.display_name || "",
            avatarUrl: membershipRow.avatar_url || ""
        };
    };

    const fetchChannelJoinPolicy = async (channelId) => {
        if (runtimeState.channel?.id === channelId) {
            return normalizeChannel(runtimeState.channel).joinPolicy || "approval_required";
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channels")
            .select("id, join_policy")
            .eq("id", channelId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data?.join_policy || "approval_required";
    };

    const fetchLatestOwnJoinRequest = async (channelId, userId) => {
        if (!channelId || !userId) {
            return null;
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channel_join_requests")
            .select(joinRequestSelectFields)
            .eq("channel_id", channelId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            if (String(error.code || "") === "42501") {
                return null;
            }
            throw error;
        }

        return Array.isArray(data) ? data[0] || null : null;
    };

    const ensureApprovedMembership = async (channelId, snapshot) => {
        if (!channelId || !snapshot.user?.id || snapshot.isAnonymous) {
            return null;
        }

        const existingMembership = await getCurrentMembership(channelId);
        if (existingMembership?.status === "approved" && existingMembership.identityId) {
            return existingMembership;
        }

        const joinPolicy = await fetchChannelJoinPolicy(channelId);
        if (joinPolicy !== "open") {
            return null;
        }

        const client = getSupabaseClient();
        const profile = await ensureProfile();
        const fallbackDisplayName = String(profile?.display_name || snapshot.user.email?.split("@")[0] || "频道成员").trim() || "频道成员";
        const fallbackAvatarUrl = String(profile?.avatar_url || "").trim();

        let identity = null;
        const ensureIdentityResponse = await client.rpc("ensure_channel_identity", {
            target_channel_id: channelId
        });

        if (ensureIdentityResponse.error && !isSchemaCompatibilityError(ensureIdentityResponse.error)) {
            throw ensureIdentityResponse.error;
        }

        if (ensureIdentityResponse.data) {
            identity = {
                current_claim_post_id: null,
                current_claim_selected_at: null,
                current_guess_name: null,
                current_guess_avatar: null,
                current_guess_selected_at: null,
                ...ensureIdentityResponse.data
            };
        } else {
            identity = await fetchIdentityRow({
                channelId,
                userId: snapshot.user.id
            });
        }

        return {
            status: "approved",
            role: identity.role || "member",
            identityId: identity.id || null,
            displayName: identity.display_name || fallbackDisplayName,
            avatarUrl: identity.avatar_url || fallbackAvatarUrl
        };
    };

    const fetchChannelRow = async (slug) => {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from("channels")
            .select(channelSelectFields)
            .eq("slug", slug)
            .single();

        let channelRow = data;
        if (error) {
            if (String(error.code || "") === "PGRST116") {
                channelRow = createFallbackChannelRow(slug);
            } else if (!isSchemaCompatibilityError(error)) {
                throw error;
            } else {
                const fallbackResponse = await client
                    .from("channels")
                    .select(minimalChannelSelectFields)
                    .eq("slug", slug)
                    .single();

                if (fallbackResponse.error) {
                    if (String(fallbackResponse.error.code || "") === "PGRST116") {
                        channelRow = createFallbackChannelRow(slug);
                    } else {
                        throw fallbackResponse.error;
                    }
                } else {
                    channelRow = normalizeChannelRowCompatibility(fallbackResponse.data);
                }
            }
        }

        const normalizedRow = normalizeChannelRowCompatibility(channelRow);
        runtimeState.channel = normalizedRow;
        writeSessionCache(getChannelShellCacheKey(slug), normalizedRow);
        return normalizedRow;
    };

    const buildMembershipSnapshot = async (channelId, snapshot, { includeReviewItems = true } = {}) => {
        if (!channelId || !snapshot.user?.id || snapshot.isAnonymous) {
            return {
                status: "guest",
                joinRequest: null,
                reviewItems: [],
                role: null
            };
        }

        const membership = await getCurrentMembership(channelId);

        if (membership?.status === "approved" && membership.identityId) {
            let reviewItems = [];
            if (includeReviewItems && (membership.role === "owner" || membership.role === "admin")) {
                reviewItems = await context.api.listPendingJoinRequests(channelId);
            }

            return {
                status: "approved",
                joinRequest: null,
                reviewItems,
                role: membership.role,
                identityId: membership.identityId,
                displayName: membership.displayName,
                avatarUrl: membership.avatarUrl
            };
        }

        const ensuredMembership = await ensureApprovedMembership(channelId, snapshot);
        if (ensuredMembership?.identityId) {
            let reviewItems = [];
            if (includeReviewItems && (ensuredMembership.role === "owner" || ensuredMembership.role === "admin")) {
                reviewItems = await context.api.listPendingJoinRequests(channelId);
            }

            return {
                status: "approved",
                joinRequest: null,
                reviewItems,
                role: ensuredMembership.role,
                identityId: ensuredMembership.identityId,
                displayName: ensuredMembership.displayName,
                avatarUrl: ensuredMembership.avatarUrl
            };
        }

        const latestJoinRequest = await fetchLatestOwnJoinRequest(channelId, snapshot.user.id);
        if (latestJoinRequest) {
            const profileByUserId = await fetchReviewProfiles([latestJoinRequest]);
            return {
                status: latestJoinRequest.status || "guest",
                joinRequest: normalizeJoinRequest(latestJoinRequest, profileByUserId),
                reviewItems: [],
                role: null
            };
        }

        return {
            status: "guest",
            joinRequest: null,
            reviewItems: [],
            role: null
        };
    };

    const buildMemberRuntime = async (channelRow, snapshot, membership, { allowEnsureAliases = false } = {}) => {
        if (!channelRow?.id || !snapshot.user?.id || snapshot.isAnonymous || membership?.status !== "approved") {
            return null;
        }

        const client = getSupabaseClient();
        const identity = await fetchIdentityRow({
            channelId: channelRow.id,
            userId: snapshot.user.id
        });

        let aliasRows = [];
        if (allowEnsureAliases) {
            const aliasResponse = await client.rpc("ensure_my_alias_sessions", {
                target_channel_id: channelRow.id
            });

            if (aliasResponse.error) {
                if (!isSchemaCompatibilityError(aliasResponse.error)) {
                    throw aliasResponse.error;
                }
            } else {
                aliasRows = aliasResponse.data || [];
            }
        }

        if (!aliasRows.length) {
            const existingAliasesResponse = await client
                .from("alias_sessions")
                .select(aliasSelectFields)
                .eq("channel_id", channelRow.id)
                .eq("identity_id", identity.id)
                .order("slot_key", { ascending: true });

            if (existingAliasesResponse.error) {
                throw existingAliasesResponse.error;
            }

            aliasRows = existingAliasesResponse.data || [];
        }

        runtimeState.identity = identity;
        runtimeState.aliasProfiles = mapAliasProfiles(aliasRows);
        const roundStartTimestamp = getRoundStartTimestamp(channelRow);
        let claimSelection = null;
        if (identity.current_claim_post_id && (!roundStartTimestamp || Date.parse(identity.current_claim_selected_at || "") >= roundStartTimestamp)) {
            try {
                const selectedWishPost = await fetchPostById(channelRow.id, identity.current_claim_post_id);
                if (
                    !selectedWishPost.isDeleted
                    && selectedWishPost.board === "wish"
                    && (!roundStartTimestamp || Date.parse(selectedWishPost.createdAt || "") >= roundStartTimestamp)
                ) {
                    claimSelection = normalizeClaimSelection(selectedWishPost);
                }
            } catch (error) {
                if (!isSchemaCompatibilityError(error) && String(error?.code || "") !== "PGRST116") {
                    throw error;
                }
            }
        }

        return {
            channel: normalizeChannel(channelRow),
            realIdentity: {
                id: identity.id,
                name: identity.display_name || defaultRealIdentity.name,
                avatar: identity.avatar_url || defaultRealIdentity.avatar,
                meta: defaultRealIdentity.meta,
                role: identity.role,
                currentGuess: normalizeGuessSelection({
                    name: !roundStartTimestamp || Date.parse(identity.current_guess_selected_at || "") >= roundStartTimestamp
                        ? identity.current_guess_name
                        : "",
                    avatar: identity.current_guess_avatar || "",
                    selectedAt: !roundStartTimestamp || Date.parse(identity.current_guess_selected_at || "") >= roundStartTimestamp
                        ? identity.current_guess_selected_at || null
                        : null
                })
            },
            anonymousProfiles: runtimeState.aliasProfiles,
            activeAliasKey: runtimeState.aliasProfiles.find((profile) => profile.status === "active" && profile.id)?.key
                || runtimeState.aliasProfiles[0]?.key
                || defaultAnonymousProfiles[0]?.key
                || null,
            claimSelection,
            guessSelection: normalizeGuessSelection({
                name: !roundStartTimestamp || Date.parse(identity.current_guess_selected_at || "") >= roundStartTimestamp
                    ? identity.current_guess_name
                    : "",
                avatar: identity.current_guess_avatar || "",
                selectedAt: !roundStartTimestamp || Date.parse(identity.current_guess_selected_at || "") >= roundStartTimestamp
                    ? identity.current_guess_selected_at || null
                    : null
            })
        };
    };

    const getActorReference = (author) => {
        if (author.type === "alias_session") {
            const aliasProfile = runtimeState.aliasProfiles.find((profile) => profile.key === author.key);
            if (!aliasProfile?.id) {
                throw new Error("匿名马甲尚未初始化完成。");
            }

            return {
                identity_id: null,
                alias_session_id: aliasProfile.id
            };
        }

        if (!runtimeState.identity?.id) {
            throw new Error("频道成员身份尚未初始化完成。");
        }

        return {
            identity_id: runtimeState.identity.id,
            alias_session_id: null
        };
    };

    const fetchReviewProfiles = async (rows) => {
        const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
        if (!userIds.length) {
            return new Map();
        }

        const client = getSupabaseClient();
        const { data: profiles, error } = await client
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds);

        if (error) {
            if (String(error.code || "") === "42501") {
                return new Map();
            }
            throw error;
        }

        return new Map((profiles || []).map((profile) => [profile.id, profile]));
    };

    const generateUniqueChannelSlug = async (name) => {
        const client = getSupabaseClient();
        const baseSlug = slugifyChannelName(name) || `channel-${createRandomSlugTail()}`;
        let candidateSlug = baseSlug;

        while (true) {
            const { data, error } = await client
                .from("channels")
                .select("id")
                .eq("slug", candidateSlug)
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data?.id) {
                return candidateSlug;
            }

            candidateSlug = `${baseSlug}-${createRandomSlugTail()}`;
        }
    };

    return Object.assign(context, {
        runtimeConfig,
        runtimeState,
        postCache,
        channelShellCacheTtl,
        channelMemberCacheTtl,
        channelFeedCacheTtl,
        defaultChannelLogo,
        defaultChannelBackground,
        defaultAnonymousProfiles,
        defaultRealIdentity,
        channelSelectFields,
        minimalChannelSelectFields,
        legacyIdentitySelectFields,
        roundSelectFields,
        roundMemberSelectFields,
        aliasSelectFields,
        joinRequestSelectFields,
        commentSelectFields,
        legacyCommentSelectFields,
        getSupabaseClient,
        ensureLoadedChannel,
        cachePosts,
        createFallbackChannelRow,
        getUserCacheKey,
        syncChannelCaches,
        getShellChannel,
        getSessionSnapshot,
        ensureProfile,
        tryInvokeAnonymousAnonymizer,
        fetchPosts,
        fetchRoundPosts,
        fetchPostById,
        fetchRoundRow,
        fetchRoundMembers,
        fetchArchivedRoundRows,
        roundRepository,
        fetchIdentityRow,
        countPublicPosts,
        mapAliasProfiles,
        createAliasSlotKey,
        getCurrentMembership,
        fetchChannelJoinPolicy,
        fetchLatestOwnJoinRequest,
        ensureApprovedMembership,
        fetchChannelRow,
        buildMembershipSnapshot,
        buildMemberRuntime,
        getActorReference,
        fetchReviewProfiles,
        generateUniqueChannelSlug,
        normalizeChannel,
        normalizeChannelRowCompatibility,
        normalizeCommentRow,
        normalizeJoinRequest,
        normalizeClaimSelection,
        normalizeGuessSelection,
        normalizeRoundRow,
        normalizeRoundMemberRow,
        isSchemaCompatibilityError,
        readBestEffortCache,
        readLocalCache,
        writeSessionCache,
        writeLocalCache,
        getChannelShellCacheKey,
        getChannelMemberCacheKey,
        getChannelFeedCacheKey,
        getChannelPostCacheKey,
        cloneCachedPost,
        cloneCachedPosts,
        getRoundStartTimestamp,
        isEntryOwnedByIdentity
    });
};
