import { buildRoundSummary, findCurrentMemberStatus } from "../../features/round/model.js";
import { formatActivityTimeLabel, getPostPreviewText } from "../../shared/lib/helpers.js";

const DESKTOP_BREAKPOINT = 720;
const NOTIFICATION_PANEL_WIDTH = 302;
const NOTIFICATION_PANEL_HEIGHT = 396;
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 14;

const clipText = (value, maxLength = 24) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
        return "";
    }
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trimEnd()}...`
        : normalized;
};

const getNotificationPanelStyle = (overlayState) => {
    if (typeof window === "undefined" || window.innerWidth <= DESKTOP_BREAKPOINT) {
        return "";
    }

    const { anchorX, anchorY } = overlayState;
    if (typeof anchorX !== "number" || typeof anchorY !== "number") {
        return "";
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - NOTIFICATION_PANEL_WIDTH - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - NOTIFICATION_PANEL_HEIGHT - VIEWPORT_MARGIN);
    const left = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, anchorX - NOTIFICATION_PANEL_WIDTH));
    const top = Math.min(maxTop, Math.max(VIEWPORT_MARGIN, anchorY + TRIGGER_GAP));

    return `top:${top}px;left:${left}px;right:auto;`;
};

const buildInteractionItems = (state) => {
    const currentUserId = state.authState.user?.id || null;
    const currentMemberStatus = findCurrentMemberStatus(state);
    const currentGodName = String(state.roundState.godProfile?.name || "").trim();
    const currentGodAvatar = String(state.roundState.godProfile?.avatar || "").trim()
        || state.runtimeState.channel?.logoUrl
        || "";
    const items = [];

    if (currentMemberStatus?.wishSubmissionSource === "proxy") {
        items.push({
            id: `proxy-wish-${currentMemberStatus.identityId || currentMemberStatus.userId || "current"}`,
            avatar: currentGodAvatar,
            userName: currentMemberStatus.wishRecordedByName || currentGodName || "当前上帝",
            dateLabel: "本轮",
            actionLine: "代你记录了本轮愿望",
            quoteLine: currentMemberStatus.wishPreview || "你已经进入这轮后续流程。",
            sortTimestamp: Date.parse(state.roundState.startedAt || "") || Date.now()
        });
    }

    (state.feedState.items || []).forEach((post) => {
        if (post?.isDeleted) {
            return;
        }

        const isMyPost = currentUserId && post.authorUserId === currentUserId;
        const commentsById = new Map((post.comments || []).map((comment) => [comment.id, comment]));

        (post.comments || []).forEach((comment) => {
            if (!comment || comment.isDeleted || !comment.authorUserId || comment.authorUserId === currentUserId) {
                return;
            }

            const parentComment = comment.parentCommentId ? commentsById.get(comment.parentCommentId) : null;
            const repliedToMe = parentComment && currentUserId && parentComment.authorUserId === currentUserId;
            if (!isMyPost && !repliedToMe) {
                return;
            }

            items.push({
                id: `comment-${comment.id}`,
                avatar: comment.authorAvatar || post.authorAvatar || state.runtimeState.channel?.logoUrl || "",
                userName: comment.authorName || "频道成员",
                dateLabel: formatActivityTimeLabel(comment.createdAt || post.createdAt || ""),
                actionLine: repliedToMe
                    ? `回复了我的评论：${clipText(comment.text, 18) || "来看一下回复"}`
                    : `评论了我的帖子：${clipText(comment.text, 18) || "来看一下评论"}`,
                quoteLine: getPostPreviewText(post, 40).text || "这条帖子没有正文。",
                sortTimestamp: Date.parse(comment.createdAt || post.createdAt || "") || 0
            });
        });
    });

    return items.sort((left, right) => {
        const leftPinned = left.id.startsWith("proxy-wish-") ? 1 : 0;
        const rightPinned = right.id.startsWith("proxy-wish-") ? 1 : 0;
        if (leftPinned !== rightPinned) {
            return rightPinned - leftPinned;
        }
        return (right.sortTimestamp || 0) - (left.sortTimestamp || 0);
    });
};

const buildAdminItems = (state) => {
    const membershipApproved = state.membershipState.status === "approved";
    const role = state.runtimeState.realIdentity.role;
    const canManageRound = membershipApproved && ["owner", "admin"].includes(role);
    const isCurrentGod = (
        state.roundState.godProfile?.userId
            ? state.roundState.godProfile.userId === state.authState.user?.id
            : state.roundState.godProfile?.name === state.runtimeState.realIdentity.name
    );
    const canManageRoundFlow = canManageRound || isCurrentGod;
    if (!canManageRoundFlow) {
        return [];
    }

    const summary = buildRoundSummary(state.roundState.memberStatuses || []);
    const currentStage = String(state.roundState.activeStage || "wish").trim();
    const currentTheme = String(state.roundState.theme || "").trim();
    const deadlineAt = state.roundState.deadlines?.wish?.deadlineAt || null;
    const deadlineExpired = Boolean(deadlineAt) && Date.parse(deadlineAt) <= Date.now();
    const items = [];
    const systemAvatar = state.runtimeState.channel?.logoUrl || "";

    if (!currentTheme) {
        items.push({
            id: "admin-theme-missing",
            avatar: systemAvatar,
            userName: "频道系统",
            dateLabel: "当前",
            actionLine: "本轮主题还没设置",
            quoteLine: "先设定主题，成员才能更明确地知道这轮围绕什么展开。",
            sortTimestamp: Date.now()
        });
    }

    if (canManageRound && !state.roundState.godProfile?.name) {
        items.push({
            id: "admin-god-missing",
            avatar: systemAvatar,
            userName: "频道系统",
            dateLabel: "当前",
            actionLine: "本轮上帝还没指定",
            quoteLine: "先定上帝，再决定是否由上帝帮成员代录愿望。",
            sortTimestamp: Date.now()
        });
    }

    if (currentStage === "wish" && summary.missingWishNames.length) {
        items.push({
            id: "admin-wish-missing",
            avatar: state.roundState.godProfile?.avatar || systemAvatar,
            userName: state.roundState.godProfile?.name || "当前回合",
            dateLabel: "当前",
            actionLine: `还有 ${summary.missingWishNames.length} 人没提交愿望`,
            quoteLine: "可以提醒对方自己提交，或者由上帝直接代录愿望。",
            sortTimestamp: Date.now()
        });
    }

    if (currentStage === "wish" && deadlineExpired) {
        items.push({
            id: "admin-wish-deadline",
            avatar: systemAvatar,
            userName: "频道系统",
            dateLabel: formatActivityTimeLabel(deadlineAt),
            actionLine: "许愿截止已过",
            quoteLine: "现在可以锁定参与名单，推进到选愿望阶段。",
            sortTimestamp: Date.parse(deadlineAt || "") || Date.now()
        });
    }

    if (currentStage === "reveal" && !Object.keys(state.roundState.revealMap || {}).length) {
        items.push({
            id: "admin-reveal-missing",
            avatar: systemAvatar,
            userName: "频道系统",
            dateLabel: "当前",
            actionLine: "揭晓阶段还没生成结果",
            quoteLine: "可以直接一键生成揭晓，补齐本轮国王与天使配对。",
            sortTimestamp: Date.now()
        });
    }

    return items.sort((left, right) => (right.sortTimestamp || 0) - (left.sortTimestamp || 0));
};

export const selectNotificationCenterVM = (state) => {
    const interactionItems = buildInteractionItems(state);
    const adminItems = buildAdminItems(state);
    const activeTab = state.overlayState.notificationCenter.tab;
    const items = activeTab === "admin" ? adminItems : interactionItems;

    return {
        open: state.overlayState.notificationCenter.open,
        panelStyle: getNotificationPanelStyle(state.overlayState.notificationCenter),
        activeTab,
        tabs: [
            { key: "interaction", label: "互动消息", count: interactionItems.length },
            { key: "admin", label: "回合提醒", count: adminItems.length }
        ],
        items,
        emptyTitle: activeTab === "admin" ? "当前没有新的回合提醒" : "当前没有新的互动消息",
        emptyDescription: activeTab === "admin"
            ? "本轮该设定、该推进、该补录的事情，之后会直接在这里提醒。"
            : "别人评论你的帖子、回复你的评论，或者上帝代你补录愿望后，这里会直接出现。"
    };
};
