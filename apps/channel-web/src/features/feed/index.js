import { anonymizeComposerText, copyText, getChannelActionErrorMessage, getPostBodyText } from "../../shared/lib/helpers.js";
import { getRoundStageIndex } from "../../entities/channel/config.js";
import { isEntryOwnedByIdentity } from "../../shared/lib/anonymous-display.js";
import { findCurrentMemberStatus } from "../round/model.js";

const requestInteractionAccess = ({ store, showToast }) => {
    const state = store.getState();
    if (state.roundState.archiveViewerRoundId || state.roundState.lifecycleStatus === "archived") {
        showToast({
            tone: "info",
            message: state.roundState.archiveViewerRoundId
                ? "当前正在查看历史归档，只能阅读不能互动。"
                : "当前回合已经归档，只能阅读不能继续发帖。"
        });
        return false;
    }

    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;

    if (authStatus === "guest") {
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode: "login" }
        });
        return false;
    }

    if (authStatus === "upgrading_legacy_anonymous") {
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode: "upgrade" }
        });
        return false;
    }

    if (membershipStatus !== "approved") {
        showToast({
            tone: "info",
            message: "公开浏览可用，登录后会自动加入频道并解锁互动。"
        });
        return false;
    }

    return true;
};

const parseTime = (value) => {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const getVisibleComments = (item) => (item.comments || []).filter((comment) => !comment?.isDeleted);

const getPostCreatedTime = (item) => parseTime(item?.createdAt);

const getLatestReplyTime = (item) => getVisibleComments(item)
    .reduce((latestTime, comment) => Math.max(latestTime, parseTime(comment?.createdAt)), 0);

const getLatestActivityTime = (item) => Math.max(getPostCreatedTime(item), getLatestReplyTime(item));

const getHotScore = (item) => {
    const visibleComments = getVisibleComments(item);
    const likes = Number(item?.likes) || 0;
    const views = Number(item?.views) || 0;

    return (visibleComments.length * 8) + (likes * 5) + (views * 0.08);
};

const sortFeedItems = (items, filter) => {
    if (filter === "hot") {
        return [...items].sort((left, right) => {
            const scoreDelta = getHotScore(right) - getHotScore(left);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }

            const activityDelta = getLatestActivityTime(right) - getLatestActivityTime(left);
            if (activityDelta !== 0) {
                return activityDelta;
            }

            return getPostCreatedTime(right) - getPostCreatedTime(left);
        });
    }

    if (filter === "new-post") {
        return [...items].sort((left, right) => getPostCreatedTime(right) - getPostCreatedTime(left));
    }

    if (filter === "new-reply") {
        return [...items].sort((left, right) => {
            const replyDelta = getLatestReplyTime(right) - getLatestReplyTime(left);
            if (replyDelta !== 0) {
                return replyDelta;
            }

            return getPostCreatedTime(right) - getPostCreatedTime(left);
        });
    }

    return [...items];
};

const findFeedPostById = (state, postId) => state.feedState.items.find((item) => item.id === postId) || null;

const findDrawerCommentById = (state, commentId) => state.overlayState.comments.post?.comments?.find((comment) => comment.id === commentId) || null;

const canAccessBoard = (state, board) => {
    if (state.roundState.archiveViewerRoundId || state.roundState.lifecycleStatus === "archived") {
        return true;
    }

    if (!board || board === "all") {
        return true;
    }

    if (state.runtimeState.channel?.slug === "demo") {
        return true;
    }

    if (["owner", "admin"].includes(state.runtimeState.realIdentity.role) && state.membershipState.status === "approved") {
        return true;
    }

    return getRoundStageIndex(board) <= getRoundStageIndex(state.roundState.activeStage);
};

const getBlockedBoardMessage = (state, board) => {
    const currentMemberStatus = findCurrentMemberStatus(state);
    const currentStage = state.roundState.activeStage;

    if (currentStage === "wish") {
        return currentMemberStatus?.wishSubmitted
            ? "你已经完成许愿了，等管理员切到选愿望阶段后再进入。"
            : "请先发布你的愿望。";
    }

    if (currentStage === "claim") {
        return currentMemberStatus?.claimSelected
            ? "你已经选好愿望了，等管理员切到交付阶段后再进入。"
            : "请先在选愿望阶段锁定 1 条愿望。";
    }

    if (currentStage === "delivery") {
        if (!currentMemberStatus?.claimSelected) {
            return "你还没有锁定愿望，先回选愿望阶段补上。";
        }

        return currentMemberStatus?.deliverySubmitted
            ? "你已经完成交付了，等管理员切到猜测阶段后再进入。"
            : "请先完成你的交付。";
    }

    if (currentStage === "guess") {
        return currentMemberStatus?.guessSubmitted
            ? "你已经完成猜测了，等管理员统一揭晓后再进入。"
            : "请先提交你的猜测。";
    }

    return board
        ? `当前还没开放这个板块。`
        : "当前还没开放这个板块。";
};

const normalizeLightboxImage = (image) => {
    if (!image?.url) {
        return null;
    }

    return {
        url: String(image.url),
        name: String(image.name || "帖子图片")
    };
};

const resolveFeedSourceBoard = (board) => (
    board === "all"
        ? "all"
        : board === "claim"
            ? "wish"
            : board === "reveal"
                ? "guess"
                : board
);

export const createFeedActions = ({ store, dataService, showToast }) => ({
    hydrateFeed(board = store.getState().feedState.activeBoard, items = []) {
        store.dispatch({
            type: "feed/set-board",
            payload: { board }
        });

        const filter = store.getState().feedState.activeFilter;
        store.dispatch({
            type: "feed/load-success",
            payload: { items: sortFeedItems(items, filter) }
        });
    },
    async loadFeed(board = store.getState().feedState.activeBoard, options = {}) {
        const { silent = false, skipCache = false } = options;
        store.dispatch({
            type: "feed/set-board",
            payload: { board }
        });
        const state = store.getState();
        const archiveViewer = state.roundState.archiveViewerRoundId ? state.roundState.archiveViewerDetail : null;
        if (archiveViewer?.id && Array.isArray(archiveViewer.posts)) {
            const sourceBoard = resolveFeedSourceBoard(board);
            const items = sourceBoard === "all"
                ? archiveViewer.posts
                : archiveViewer.posts.filter((post) => post.board === sourceBoard);
            this.hydrateFeed(board, items);
            return;
        }

        const sourceBoard = resolveFeedSourceBoard(board);
        const channelSlug = state.runtimeState.channel?.slug || "";
        const cachedItems = !skipCache && typeof dataService.getCachedPosts === "function"
            ? dataService.getCachedPosts(sourceBoard, channelSlug)
            : [];
        const hasCachedItems = Array.isArray(cachedItems) && cachedItems.length > 0;

        if (hasCachedItems) {
            this.hydrateFeed(board, cachedItems);
        } else if (!silent) {
            store.dispatch({ type: "feed/load-start" });
        }

        try {
            const items = await dataService.listPosts(sourceBoard);
            this.hydrateFeed(board, items);
        } catch (error) {
            store.dispatch({
                type: "feed/load-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("load_feed", error)
            });
        }
    },
    async setActiveBoard(board) {
        const state = store.getState();
        if (!canAccessBoard(state, board)) {
            showToast({
                tone: "info",
                message: getBlockedBoardMessage(state, board)
            });
            return;
        }

        if (state.runtimeState.channel?.slug === "demo" && board && board !== "all") {
            store.dispatch({
                type: "round/set-stage",
                payload: {
                    stage: board,
                    forceAnonymous: ["wish", "delivery"].includes(board)
                }
            });
        }
        await this.loadFeed(board);
    },
    setFeedFilter(filter) {
        store.dispatch({
            type: "feed/set-filter",
            payload: { filter }
        });

        const { items } = store.getState().feedState;
        store.dispatch({
            type: "feed/load-success",
            payload: { items: sortFeedItems(items, filter) }
        });
    },
    setFeedSearchQuery(searchQuery) {
        store.dispatch({
            type: "feed/set-search-query",
            payload: { searchQuery }
        });
    },
    async likePost(postId) {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        const post = findFeedPostById(store.getState(), postId);
        if (post?.isDeleted) {
            showToast({
                tone: "info",
                message: "该帖子已删除，无法继续点赞。"
            });
            return;
        }

        const likedPostIds = store.getState().feedState.likedPostIds || [];
        if (likedPostIds.includes(postId)) {
            showToast({
                tone: "info",
                message: "这条帖子你已经点过赞了。"
            });
            return;
        }

        try {
            const likes = await dataService.likePost(postId);
            store.dispatch({
                type: "feed/mark-liked",
                payload: { postId, likes }
            });
            showToast({
                tone: "success",
                message: "已点赞。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("like_post", error)
            });
        }
    },
    async claimWish(postId) {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        const state = store.getState();
        const currentMemberStatus = findCurrentMemberStatus(state);
        if (currentMemberStatus && !currentMemberStatus.wishSubmitted) {
            showToast({
                tone: "info",
                message: "这轮后续流程只对已许愿成员开放。需要的话可以让上帝代你补录愿望。"
            });
            return;
        }
        const post = findFeedPostById(state, postId);
        if (!post || post.isDeleted) {
            showToast({
                tone: "info",
                message: "这条愿望当前不可选。"
            });
            return;
        }

        if (state.feedState.activeBoard !== "claim") {
            showToast({
                tone: "info",
                message: "请先进入选愿望板块。"
            });
            return;
        }

        if (state.roundState.claimSelection?.postId === postId) {
            try {
                await dataService.clearClaimSelection();
                store.dispatch({
                    type: "round/set-claim-selection",
                    payload: { selection: null }
                });
                showToast({
                    tone: "success",
                    message: "已取消这个愿望。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_round_state", error)
                });
            }
            return;
        }

        if (isEntryOwnedByIdentity(post, {
            id: state.runtimeState.realIdentity.id,
            name: state.runtimeState.realIdentity.name,
            userId: state.authState.user?.id || null
        })) {
            showToast({
                tone: "info",
                message: "不能选择自己发的愿望。"
            });
            return;
        }

        try {
            const selection = await dataService.saveClaimSelection(post);
            store.dispatch({
                type: "round/set-claim-selection",
                payload: { selection }
            });
            showToast({
                tone: "success",
                message: state.roundState.claimSelection?.postId === postId
                    ? "这条愿望已经是你当前的目标。"
                    : "愿望已锁定，交付阶段会自动带上目标。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_round_state", error)
            });
        }
    },
    openComments(postId, source = "comments") {
        const state = store.getState();
        const currentFeedPost = findFeedPostById(state, postId);
        store.dispatch({
            type: "comments/open",
            payload: { postId, source }
        });
        if (currentFeedPost) {
            store.dispatch({
                type: "comments/load-success",
                payload: { post: currentFeedPost }
            });
        } else if (typeof dataService.getCachedPost === "function") {
            const cachedPost = dataService.getCachedPost(postId, state.runtimeState.channel?.slug || "");
            if (cachedPost) {
                store.dispatch({
                    type: "comments/load-success",
                    payload: { post: cachedPost }
                });
            }
        }
        void this.refreshComments();
    },
    openPostImage(postId, imageIndex = 0) {
        const post = findFeedPostById(store.getState(), postId);
        const image = normalizeLightboxImage(post?.images?.[imageIndex]);
        if (!image) {
            return;
        }

        store.dispatch({
            type: "image-lightbox/open",
            payload: {
                image,
                source: "feed"
            }
        });
    },
    openCurrentDrawerImage(imageIndex = 0) {
        const image = normalizeLightboxImage(store.getState().overlayState.comments.post?.images?.[imageIndex]);
        if (!image) {
            return;
        }

        store.dispatch({
            type: "image-lightbox/open",
            payload: {
                image,
                source: "comments"
            }
        });
    },
    closeImageLightbox() {
        store.dispatch({ type: "image-lightbox/close" });
    },
    getActiveCommentsPostId() {
        return store.getState().overlayState.comments.postId;
    },
    closeComments() {
        store.dispatch({ type: "comments/close" });
    },
    async refreshComments() {
        const { postId } = store.getState().overlayState.comments;
        if (!postId) {
            return;
        }

        try {
            const post = await dataService.getPost(postId);
            store.dispatch({
                type: "comments/load-success",
                payload: { post }
            });
        } catch (error) {
            store.dispatch({
                type: "comments/load-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("load_comments", error)
            });
        }
    },
    setCommentsSort(sort) {
        store.dispatch({
            type: "comments/set-field",
            payload: { sort }
        });
    },
    setCommentDraft(draftText) {
        store.dispatch({
            type: "comments/set-field",
            payload: { draftText }
        });
    },
    async likeComment(commentId) {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        const { likedCommentIds = [], postId } = store.getState().overlayState.comments;
        const comment = findDrawerCommentById(store.getState(), commentId);
        if (comment?.isDeleted) {
            showToast({
                tone: "info",
                message: "该评论已删除，无法继续点赞。"
            });
            return;
        }

        if (likedCommentIds.includes(commentId)) {
            showToast({
                tone: "info",
                message: "这条评论你已经点过赞了。"
            });
            return;
        }

        try {
            const likes = await dataService.likeComment(commentId, postId);
            store.dispatch({
                type: "comments/like",
                payload: { commentId, likes }
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("like_comment", error)
            });
        }
    },
    replyToComment(comment) {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        if (comment.isDeleted) {
            showToast({
                tone: "info",
                message: "该评论已删除，无法继续回复。"
            });
            return;
        }

        store.dispatch({
            type: "comments/set-field",
            payload: {
                replyTarget: {
                    id: comment.id,
                    authorName: comment.authorName,
                    text: comment.text || ""
                },
                draftText: ""
            }
        });
    },
    clearCommentReplyTarget() {
        store.dispatch({
            type: "comments/set-field",
            payload: {
                replyTarget: null
            }
        });
    },
    toggleCommentAnonymousMode() {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        const current = store.getState().overlayState.comments.anonymousMode;
        store.dispatch({
            type: "comments/set-field",
            payload: {
                anonymousMode: !current
            }
        });
    },
    async submitComment() {
        if (!requestInteractionAccess({ store, showToast })) {
            return;
        }

        const state = store.getState();
        const draftText = state.overlayState.comments.draftText.trim();
        const postId = state.overlayState.comments.postId;
        const replyTarget = state.overlayState.comments.replyTarget;
        const anonymousMode = state.overlayState.comments.anonymousMode;
        if (!draftText || !postId) {
            return;
        }

        if (state.overlayState.comments.post?.isDeleted) {
            showToast({
                tone: "info",
                message: "原帖已删除，无法继续评论。"
            });
            return;
        }

        store.dispatch({ type: "comments/submit-start" });

        try {
            const anonymizedDraft = anonymousMode
                ? await dataService.anonymizeAnonymousDraft?.({
                    text: draftText,
                    purpose: "comment",
                    channelId: state.runtimeState.channel?.id || null
                })
                : null;

            await dataService.publishComment({
                postId,
                parentCommentId: replyTarget?.id || null,
                body: anonymousMode ? (anonymizedDraft?.text || anonymizeComposerText(draftText)) : draftText,
                author: {
                    type: anonymousMode ? "alias_session" : "identity",
                    key: anonymousMode ? state.runtimeState.activeAliasKey : undefined
                }
            });

            store.dispatch({
                type: "comments/submit-finish",
                payload: { clearDraft: true }
            });
            await this.loadFeed(store.getState().feedState.activeBoard);
            await this.refreshComments();
            showToast({
                tone: "success",
                message: anonymousMode ? "匿名评论已发送。" : "评论已发送。"
            });
        } catch (error) {
            store.dispatch({
                type: "comments/submit-finish",
                payload: { clearDraft: false }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("publish_comment", error)
            });
        }
    },
    requestDeletePost(postId) {
        if (store.getState().roundState.archiveViewerRoundId || store.getState().roundState.lifecycleStatus === "archived") {
            showToast({
                tone: "info",
                message: "归档内容当前是只读的，不能再删除。"
            });
            return;
        }

        const state = store.getState();
        const overlayPost = state.overlayState.comments.post;
        const post = findFeedPostById(state, postId)
            || ((overlayPost?.id === postId || !postId) ? overlayPost : null);
        if (!post || post.isDeleted) {
            return;
        }

        const currentUserId = state.authState.user?.id || null;
        const isModerator = ["owner", "admin"].includes(state.runtimeState.realIdentity.role) && state.membershipState.status === "approved";
        const scopeLabel = post.authorUserId === currentUserId ? "self" : (isModerator ? "moderator" : "unknown");
        const message = scopeLabel === "moderator"
            ? "将以管理员身份删除该内容，删除后会保留“已删除”占位。"
            : "删除后会保留“已删除”占位。";

        store.dispatch({
            type: "delete-confirm/open",
            payload: {
                targetType: "post",
                targetId: post.id,
                postId: post.id,
                title: "删除帖子",
                message,
                scopeLabel
            }
        });
    },
    requestDeleteComment(commentId) {
        if (store.getState().roundState.archiveViewerRoundId || store.getState().roundState.lifecycleStatus === "archived") {
            showToast({
                tone: "info",
                message: "归档内容当前是只读的，不能再删除。"
            });
            return;
        }

        const state = store.getState();
        const comment = findDrawerCommentById(state, commentId);
        if (!comment || comment.isDeleted) {
            return;
        }

        const currentUserId = state.authState.user?.id || null;
        const isModerator = ["owner", "admin"].includes(state.runtimeState.realIdentity.role) && state.membershipState.status === "approved";
        const scopeLabel = comment.authorUserId === currentUserId ? "self" : (isModerator ? "moderator" : "unknown");
        const message = scopeLabel === "moderator"
            ? "将以管理员身份删除该内容，删除后会保留“已删除”占位。"
            : "删除后会保留“已删除”占位。";

        store.dispatch({
            type: "delete-confirm/open",
            payload: {
                targetType: "comment",
                targetId: comment.id,
                postId: state.overlayState.comments.postId || state.overlayState.comments.post?.id || null,
                title: "删除评论",
                message,
                scopeLabel
            }
        });
    },
    cancelDeleteConfirm() {
        store.dispatch({ type: "delete-confirm/close" });
    },
    async confirmDeletePost(postId = store.getState().overlayState.deleteConfirm.targetId) {
        if (!postId) {
            return;
        }

        store.dispatch({ type: "delete-confirm/submit-start" });

        try {
            const nextPost = await dataService.deletePost(postId);
            store.dispatch({
                type: "feed/replace-post",
                payload: { post: nextPost }
            });
            store.dispatch({ type: "delete-confirm/submit-finish" });
            showToast({
                tone: "success",
                message: "帖子已删除。"
            });
        } catch (error) {
            store.dispatch({
                type: "delete-confirm/submit-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("delete_post", error)
            });
        }
    },
    async confirmDeleteComment(commentId = store.getState().overlayState.deleteConfirm.targetId) {
        if (!commentId) {
            return;
        }

        store.dispatch({ type: "delete-confirm/submit-start" });

        try {
            const nextPost = await dataService.deleteComment(commentId);
            store.dispatch({
                type: "feed/replace-post",
                payload: { post: nextPost }
            });
            store.dispatch({ type: "delete-confirm/submit-finish" });
            showToast({
                tone: "success",
                message: "评论已删除。"
            });
        } catch (error) {
            store.dispatch({
                type: "delete-confirm/submit-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("delete_comment", error)
            });
        }
    },
    async copyCurrentPostBody() {
        const post = store.getState().overlayState.comments.post;
        if (!post) {
            return;
        }

        try {
            await copyText(getPostBodyText(post));
            showToast({
                tone: "success",
                message: "帖子正文已复制。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("copy_post", error)
            });
        }
    }
});
