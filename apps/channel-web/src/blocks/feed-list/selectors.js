import { getPostBodyText, getPostPreviewText } from "../../shared/lib/helpers.js";
import { buildProtectedAuthorDisplay, isEntryOwnedByIdentity } from "../../shared/lib/anonymous-display.js";
import { gameBoardStages } from "../../entities/channel/config.js";
import { buildChannelMemberOptions, buildRevealPairs, findCurrentMemberStatus } from "../../features/round/model.js";

const stageByValue = new Map(gameBoardStages.map((stage) => [stage.value, stage]));
const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

const buildSearchCorpus = (post) => {
    if (post.isDeleted) {
        return "";
    }

    return [
        post.authorName,
        getPostBodyText(post),
        ...(post.comments || [])
            .filter((comment) => !comment.isDeleted)
            .map((comment) => comment.text)
    ].join(" ").toLowerCase();
};

const buildStageHeader = ({ activeBoard, activeStage, archivedViewer = false }) => {
    const currentStage = stageByValue.get(activeStage) || gameBoardStages[0];
    const boardStage = stageByValue.get(activeBoard) || null;
    const eyebrow = archivedViewer
        ? "历史回放"
        : activeBoard === activeStage
            ? "当前阶段"
            : "内容板块";

    if (!boardStage) {
        return {
            eyebrow,
            title: "闲聊板块",
            description: "这里是独立的轻交流入口，可以匿名或实名随意聊聊，不会把内容发到后方回合板块。"
        };
    }

    if (boardStage.value === "guess") {
        return {
            eyebrow,
            title: "猜测阶段",
            description: "先锁定你最怀疑的人，再在下方写你的推理依据。"
        };
    }

    if (boardStage.value === "reveal") {
        return {
            eyebrow,
            title: "揭晓阶段",
            description: "这里会展示本轮每位国王的愿望、猜测和实际天使。"
        };
    }

    return {
        eyebrow,
        title: `${boardStage.label}阶段`,
        description: boardStage.taskLabel
    };
};

export const selectFeedListVM = (state) => {
    const archiveViewer = state.roundState.archiveViewerRoundId ? state.roundState.archiveViewerDetail : null;
    const activeStage = archiveViewer?.currentStage || state.roundState.activeStage;
    const activeBoard = state.feedState.activeBoard;
    const isGuessBoard = activeBoard === "guess";
    const searchQuery = state.feedState.searchQuery || "";
    const normalizedSearchQuery = normalizeSearchValue(searchQuery);
    const likedPostIds = new Set(state.feedState.likedPostIds || []);
    const currentUserId = state.authState.user?.id || null;
    const currentIdentity = {
        id: state.runtimeState.realIdentity.id,
        name: state.runtimeState.realIdentity.name,
        userId: currentUserId
    };
    const isClaimBoard = state.feedState.activeBoard === "claim";
    const claimSelection = archiveViewer ? null : state.roundState.claimSelection;
    const canManageAnonymous = ["owner", "admin"].includes(state.runtimeState.realIdentity.role);
    const showAdminReveal = canManageAnonymous && state.uiState.adminRevealAnonymous;
    const canModerateContent = state.membershipState.status === "approved" && canManageAnonymous;
    const selectedGuessTarget = archiveViewer ? null : (state.composerState.mentionTarget || state.roundState.guessSelection || null);
    const guessExcludedNames = new Set(state.roundState.guessExcludedNames || []);
    const currentMemberStatus = findCurrentMemberStatus(state);
    const canContinueCurrentRound = currentMemberStatus ? Boolean(currentMemberStatus.wishSubmitted) : true;
    const canEditGuessSelection = !archiveViewer
        && isGuessBoard
        && activeStage === "guess"
        && state.membershipState.status === "approved"
        && canContinueCurrentRound;

    if (archiveViewer && activeBoard === "claim") {
        const postsById = new Map((archiveViewer.posts || []).map((post) => [post.id, post]));
        return {
            mode: "archived-claim-summary",
            status: "ready",
            stageHeader: buildStageHeader({ activeBoard, activeStage, archivedViewer: true }),
            items: (archiveViewer.members || []).map((member) => {
                const claimedPost = member.claimPostId ? (postsById.get(member.claimPostId) || null) : null;
                return {
                    memberName: member.displayNameSnapshot,
                    memberAvatar: member.avatarSnapshot || "",
                    claimTargetName: claimedPost?.adminRevealIdentity?.name || claimedPost?.authorName || "",
                    claimTargetAvatar: claimedPost?.adminRevealIdentity?.avatar || claimedPost?.authorAvatar || "",
                    wishPreview: claimedPost ? getPostPreviewText(claimedPost, 88).text : "",
                    selectedAt: member.claimSelectedAt || null
                };
            })
        };
    }

    if (archiveViewer && activeBoard === "guess") {
        return {
            mode: "archived-guess-summary",
            status: "ready",
            stageHeader: buildStageHeader({ activeBoard, activeStage, archivedViewer: true }),
            items: (archiveViewer.members || []).map((member) => ({
                memberName: member.displayNameSnapshot,
                memberAvatar: member.avatarSnapshot || "",
                guessTargetName: member.guessTargetNameSnapshot || "",
                guessTargetAvatar: member.guessTargetAvatarSnapshot || "",
                guessedAt: member.guessSelectedAt || null
            }))
        };
    }

    if (activeBoard === "reveal") {
        return {
            mode: "reveal-results",
            status: "ready",
            stageHeader: buildStageHeader({ activeBoard, activeStage, archivedViewer: Boolean(archiveViewer) }),
            revealPairs: archiveViewer?.revealPairs || buildRevealPairs(state.roundState.revealMap)
        };
    }

    if (isGuessBoard) {
        const candidates = buildChannelMemberOptions(state, {
            excludeCurrent: true,
            onlyWishParticipants: true
        })
            .map((member) => ({
                ...member,
                isSelected: selectedGuessTarget?.name === member.name,
                isExcluded: guessExcludedNames.has(member.name),
                isDisabled: !canEditGuessSelection
            }))
            .sort((left, right) => {
                if (left.isExcluded !== right.isExcluded) {
                    return left.isExcluded ? 1 : -1;
                }
                if (left.isSelected !== right.isSelected) {
                    return left.isSelected ? -1 : 1;
                }
                return 0;
            });

        return {
            mode: "guess-picker",
            status: "ready",
            stageHeader: buildStageHeader({ activeBoard, activeStage, archivedViewer: Boolean(archiveViewer) }),
            candidates,
            selectedCandidate: selectedGuessTarget,
            excludedNames: [...guessExcludedNames],
            guessDraftText: state.composerState.draftText,
            submitStatus: state.composerState.submitStatus,
            canEditGuessSelection,
            canSubmitGuess: canEditGuessSelection && Boolean(selectedGuessTarget?.name)
        };
    }

    const visiblePosts = state.feedState.items.filter((post) => !post.isDeleted);
    const items = normalizedSearchQuery
        ? visiblePosts.filter((post) => buildSearchCorpus(post).includes(normalizedSearchQuery))
        : visiblePosts;
    const hasVisibleClaimSelection = Boolean(
        claimSelection?.postId
        && items.some((post) => post.id === claimSelection.postId)
    );

    const status = state.feedState.status === "ready" && !items.length && normalizedSearchQuery
        ? "search-empty"
        : state.feedState.status;

    return {
            mode: "feed",
            status,
        stageHeader: buildStageHeader({ activeBoard, activeStage, archivedViewer: Boolean(archiveViewer) }),
        items: items.map((post) => {
            const preview = getPostPreviewText(post);
            const authorDisplay = buildProtectedAuthorDisplay(post, {
                anonymousProfiles: state.runtimeState.anonymousProfiles,
                showAdminReveal
            });
            const canDelete = !post.isDeleted && state.membershipState.status === "approved" && Boolean(currentUserId) && (
                post.authorUserId === currentUserId || canModerateContent
            );
            return {
                ...post,
                authorName: authorDisplay.authorName,
                authorAvatar: authorDisplay.authorAvatar,
                adminRevealIdentity: authorDisplay.adminRevealIdentity,
                proxyWishSubmission: post.board === "wish" && post.wishMeta?.submissionSource === "proxy",
                proxyWishLabel: post.board === "wish" && post.wishMeta?.submissionSource === "proxy"
                    ? `由${String(post.wishMeta?.recordedByName || "上帝").trim()}代录`
                    : "",
                previewText: preview.text,
                isTruncated: preview.isTruncated,
                showFullEntry: preview.isTruncated && !post.isDeleted,
                isLiked: likedPostIds.has(post.id),
                showAdminReveal: authorDisplay.showAdminReveal,
                showAdminTag: authorDisplay.showAdminTag,
                showOwnerBadge: authorDisplay.showOwnerBadge,
                canDelete,
                canClaimWish: isClaimBoard
                    && state.membershipState.status === "approved"
                    && !post.isDeleted
                    && post.board === "wish"
                    && Boolean(currentUserId)
                    && canContinueCurrentRound
                    && !isEntryOwnedByIdentity(post, currentIdentity),
                isClaimedWish: claimSelection?.postId === post.id,
                claimActionLabel: claimSelection?.postId === post.id
                    ? "取消选择"
                    : hasVisibleClaimSelection
                        ? "改选这个"
                        : "选这个愿望"
            };
        }),
        searchQuery,
        error: typeof state.feedState.error === "string"
            ? state.feedState.error
            : state.feedState.error?.message || ""
    };
};
