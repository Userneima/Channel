import { defaultRealIdentity, mentionMembers } from "../../entities/identity/config.js";
import { generateAnonymousPersona } from "./helpers.js";

const protectedAnonymousBoards = new Set(["wish"]);
const knownRealMemberNames = new Set([
    defaultRealIdentity.name,
    ...mentionMembers.map((member) => String(member.name || "").trim())
].filter(Boolean));
const memberAvatarByName = new Map(
    mentionMembers.map((member) => [String(member.name || "").trim(), String(member.avatar || "").trim()])
);

const getSyntheticAliasProfile = (seedValue = "") => {
    const persona = generateAnonymousPersona(`protected-${String(seedValue || "anonymous").trim()}`);
    return {
        name: String(persona?.name || "匿名成员").trim() || "匿名成员",
        avatar: String(persona?.avatar || "").trim()
    };
};

const shouldUseSeededWishRevealIdentity = (entry) => (
    String(entry?.board || "").trim() === "wish"
    && Boolean(entry?.isAnonymous)
    && String(entry?.aliasKey || "").startsWith("wish-")
    && looksLikeRealMemberName(entry?.authorName)
);

export const resolveEntryRevealIdentity = (entry) => {
    if (shouldUseSeededWishRevealIdentity(entry)) {
        const realName = String(entry?.authorName || "").trim();
        return {
            id: null,
            name: realName || "频道成员",
            avatar: memberAvatarByName.get(realName) || String(entry?.authorAvatar || "").trim(),
            role: "member"
        };
    }

    if (entry?.adminRevealIdentity?.name) {
        return entry.adminRevealIdentity;
    }

    if (!entry?.isAnonymous && entry?.authorName) {
        return {
            id: entry.authorUserId || null,
            name: String(entry.authorName || "").trim() || "频道成员",
            avatar: String(entry.authorAvatar || "").trim(),
            role: entry.role || "member"
        };
    }

    return null;
};

export const isEntryOwnedByIdentity = (entry, identity = {}) => {
    const revealIdentity = resolveEntryRevealIdentity(entry);
    const identityId = String(identity?.id || "").trim();
    const identityName = String(identity?.name || identity?.display_name || "").trim();
    const identityUserId = String(identity?.userId || identity?.user_id || "").trim();

    if (revealIdentity?.id && identityId && String(revealIdentity.id) === identityId) {
        return true;
    }

    if (revealIdentity?.name && identityName && String(revealIdentity.name).trim() === identityName) {
        return true;
    }

    return Boolean(
        entry?.authorUserId
        && identityUserId
        && !shouldUseSeededWishRevealIdentity(entry)
        && String(entry.authorUserId) === identityUserId
    );
};

const looksLikeRealMemberName = (name, revealIdentityName = "") => {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
        return false;
    }

    return normalizedName === String(revealIdentityName || "").trim()
        || knownRealMemberNames.has(normalizedName);
};

export const isProtectedAnonymousBoard = (board) => protectedAnonymousBoards.has(String(board || "").trim());

export const buildProtectedAuthorDisplay = (entry, options = {}) => {
    const board = options.board || entry?.board || "";
    const revealIdentity = resolveEntryRevealIdentity(entry);

    if (!isProtectedAnonymousBoard(board)) {
        return {
            authorName: entry?.authorName || "频道成员",
            authorAvatar: entry?.authorAvatar || "",
            adminRevealIdentity: revealIdentity,
            showAdminReveal: Boolean(options.showAdminReveal && revealIdentity),
            showAdminTag: entry?.role === "admin" && !entry?.isAnonymous,
            showOwnerBadge: entry?.role === "owner" && !entry?.isAnonymous
        };
    }

    const fallbackAlias = getSyntheticAliasProfile(
        entry?.aliasKey || entry?.authorUserId || entry?.adminRevealIdentity?.id || entry?.authorName || entry?.id || ""
    );
    const rawAuthorName = String(entry?.authorName || "").trim();
    const shouldKeepStoredAlias = Boolean(
        entry?.isAnonymous
        && rawAuthorName
        && !looksLikeRealMemberName(rawAuthorName, revealIdentity?.name)
    );

    return {
        authorName: shouldKeepStoredAlias
            ? rawAuthorName
            : fallbackAlias.name,
        authorAvatar: shouldKeepStoredAlias
            ? (String(entry?.authorAvatar || "").trim() || fallbackAlias.avatar)
            : fallbackAlias.avatar,
        adminRevealIdentity: revealIdentity,
        showAdminReveal: Boolean(options.showAdminReveal && revealIdentity),
        showAdminTag: false,
        showOwnerBadge: false
    };
};
