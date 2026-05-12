import { postCommentsSortChoices } from "../../entities/post/config.js";
import { buildCommentThreadSummary } from "../../shared/lib/channel-intelligence.js";
import { buildProtectedAuthorDisplay } from "../../shared/lib/anonymous-display.js";

const buildThreadedComments = (comments, sort) => {
    const enrichedComments = comments.map((comment, index) => ({
        ...comment,
        floorLabel: `${index + 1}L`,
        originalIndex: index
    }));

    const byId = new Map(enrichedComments.map((comment) => [comment.id, comment]));
    const childrenByParentId = new Map();

    const rootComments = [];
    enrichedComments.forEach((comment) => {
        if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
            const siblings = childrenByParentId.get(comment.parentCommentId) || [];
            siblings.push(comment);
            childrenByParentId.set(comment.parentCommentId, siblings);
            return;
        }
        rootComments.push(comment);
    });

    const sortByHot = (left, right) => {
        const likesDiff = (right.likes || 0) - (left.likes || 0);
        if (likesDiff !== 0) {
            return likesDiff;
        }
        return left.originalIndex - right.originalIndex;
    };

    const sortByLatest = (left, right) => {
        const rightTime = Date.parse(right.createdAt || "");
        const leftTime = Date.parse(left.createdAt || "");
        if (!Number.isNaN(rightTime) && !Number.isNaN(leftTime) && rightTime !== leftTime) {
            return rightTime - leftTime;
        }
        return right.originalIndex - left.originalIndex;
    };
    const rootComparator = sort === "latest" ? sortByLatest : sortByHot;
    rootComments.sort(rootComparator);

    childrenByParentId.forEach((siblings, parentId) => {
        const ordered = [...siblings].sort(sort === "latest" ? sortByLatest : (left, right) => (
            Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0)
        ));
        childrenByParentId.set(parentId, ordered);
    });

    const flattened = [];
    rootComments.forEach((comment) => {
        flattened.push({
            ...comment,
            replyDepth: 0,
            replyTargetAuthorName: "",
            replyTargetPreview: "",
            displayText: comment.text
        });

        const children = childrenByParentId.get(comment.id) || [];
        children.forEach((child) => {
            flattened.push({
                ...child,
                replyDepth: 1,
                replyTargetAuthorName: comment.authorName,
                replyTargetPreview: comment.text,
                displayText: child.text
            });
        });
    });

    return flattened;
};

export const selectCommentDrawerVM = (state) => {
    const overlay = state.overlayState.comments;
    const post = overlay.post;
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;
    const currentUserId = state.authState.user?.id || null;
    const canManageAnonymous = ["owner", "admin"].includes(state.runtimeState.realIdentity.role);
    const showAdminReveal = canManageAnonymous && state.uiState.adminRevealAnonymous;
    const canModerateContent = membershipStatus === "approved" && canManageAnonymous;
    const isReadOnlyRound = Boolean(state.roundState.archiveViewerRoundId) || state.roundState.lifecycleStatus === "archived";
    const canInteract = authStatus === "authenticated" && membershipStatus === "approved" && !post?.isDeleted && !isReadOnlyRound;
    const activeAlias = state.runtimeState.anonymousProfiles.find((profile) => profile.key === state.runtimeState.activeAliasKey)
        || state.runtimeState.anonymousProfiles[0]
        || null;
    const postSummaryLines = [];
    const postDisplay = post ? {
        ...post,
        ...buildProtectedAuthorDisplay(post, {
            anonymousProfiles: state.runtimeState.anonymousProfiles,
            showAdminReveal
        })
    } : null;

    return {
        open: overlay.open,
        status: overlay.status,
        error: typeof overlay.error === "string"
            ? overlay.error
            : overlay.error?.message || "",
        openSource: overlay.openSource,
        initialFocusTarget: overlay.initialFocusTarget,
        sort: overlay.sort,
        sortChoices: postCommentsSortChoices,
        post: postDisplay,
        postSummaryLines,
        postSummarySource: "",
        threadSummary: post ? buildCommentThreadSummary(post) : null,
        comments: buildThreadedComments(post?.comments || [], overlay.sort).map((comment) => ({
            ...comment,
            isLiked: overlay.likedCommentIds.includes(comment.id),
            showAdminReveal: Boolean(showAdminReveal && comment.isAnonymous && comment.adminRevealIdentity),
            canDelete: !isReadOnlyRound && !comment.isDeleted && membershipStatus === "approved" && Boolean(currentUserId) && (
                comment.authorUserId === currentUserId || canModerateContent
            )
        })),
        replyTarget: overlay.replyTarget,
        draftText: overlay.draftText,
        anonymousMode: overlay.anonymousMode,
        activeAlias,
        adminRevealAnonymous: showAdminReveal,
        submitStatus: overlay.submitStatus,
        canSend: Boolean(overlay.draftText.trim()) && overlay.submitStatus !== "submitting" && overlay.status === "ready" && canInteract,
        copyEnabled: Boolean(post) && !post?.isDeleted,
        canInteract,
        canDeletePost: !isReadOnlyRound && !post?.isDeleted && membershipStatus === "approved" && Boolean(currentUserId) && (
            post?.authorUserId === currentUserId || canModerateContent
        ),
        accessHint: authStatus === "guest"
            ? "登录后才能评论"
            : authStatus === "upgrading_legacy_anonymous"
                ? "升级为正式账号后才能评论"
                : post?.isDeleted
                    ? "原帖已删除，无法继续评论"
                : isReadOnlyRound
                    ? "当前是只读归档，不能继续评论"
                : membershipStatus === "approved"
                    ? overlay.anonymousMode
                        ? "匿名回复会自动去除明显个人措辞"
                        : "发言要友善，畅聊不引战"
                    : "频道身份正在同步，稍后再试"
    };
};
