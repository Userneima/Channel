import { cloneSimple } from "./helpers.js";

const resetDeleteConfirm = (draft) => {
    draft.overlayState.deleteConfirm.open = false;
    draft.overlayState.deleteConfirm.targetType = "";
    draft.overlayState.deleteConfirm.targetId = null;
    draft.overlayState.deleteConfirm.postId = null;
    draft.overlayState.deleteConfirm.title = "";
    draft.overlayState.deleteConfirm.message = "";
    draft.overlayState.deleteConfirm.scopeLabel = "";
    draft.overlayState.deleteConfirm.submitStatus = "idle";
    draft.overlayState.deleteConfirm.error = null;
};

export const applyOverlayActions = (draft, action) => {
    switch (action.type) {
    case "comments/open":
        draft.overlayState.comments.open = true;
        draft.overlayState.comments.postId = action.payload.postId;
        draft.overlayState.comments.openSource = action.payload.source || "comments";
        draft.overlayState.comments.initialFocusTarget = action.payload.source === "comments" ? "comment-input" : "post-body";
        draft.overlayState.comments.status = "loading";
        draft.overlayState.comments.error = null;
        draft.overlayState.comments.post = null;
        draft.overlayState.comments.likedCommentIds = [];
        draft.overlayState.comments.replyTarget = null;
        draft.overlayState.comments.draftText = "";
        draft.overlayState.comments.anonymousMode = false;
        draft.overlayState.comments.submitStatus = "idle";
        return true;
    case "comments/close":
        draft.overlayState.comments.open = false;
        draft.overlayState.comments.postId = null;
        draft.overlayState.comments.openSource = "comments";
        draft.overlayState.comments.initialFocusTarget = null;
        draft.overlayState.comments.post = null;
        draft.overlayState.comments.status = "idle";
        draft.overlayState.comments.error = null;
        draft.overlayState.comments.draftText = "";
        draft.overlayState.comments.likedCommentIds = [];
        draft.overlayState.comments.replyTarget = null;
        draft.overlayState.comments.anonymousMode = false;
        draft.overlayState.comments.submitStatus = "idle";
        return true;
    case "comments/load-success":
        draft.overlayState.comments.status = "ready";
        draft.overlayState.comments.error = null;
        draft.overlayState.comments.post = { ...action.payload.post };
        return true;
    case "comments/load-error":
        draft.overlayState.comments.status = "error";
        draft.overlayState.comments.error = action.payload.error;
        draft.overlayState.comments.post = null;
        return true;
    case "comments/set-field":
        Object.assign(draft.overlayState.comments, action.payload);
        return true;
    case "comments/like":
        if (!draft.overlayState.comments.likedCommentIds.includes(action.payload.commentId)) {
            draft.overlayState.comments.likedCommentIds.push(action.payload.commentId);
        }
        if (draft.overlayState.comments.post) {
            draft.overlayState.comments.post = {
                ...draft.overlayState.comments.post,
                comments: draft.overlayState.comments.post.comments.map((comment) => (
                    comment.id === action.payload.commentId
                        ? { ...comment, likes: action.payload.likes ?? ((comment.likes || 0) + 1) }
                        : comment
                ))
            };
        }
        return true;
    case "comments/submit-start":
        draft.overlayState.comments.submitStatus = "submitting";
        return true;
    case "comments/submit-finish":
        draft.overlayState.comments.submitStatus = "idle";
        if (action.payload?.clearDraft) {
            draft.overlayState.comments.draftText = "";
            draft.overlayState.comments.replyTarget = null;
        }
        return true;
    case "channel-menu/open":
        draft.overlayState.channelMenu.open = true;
        draft.overlayState.channelMenu.anchorX = action.payload?.anchorX ?? null;
        draft.overlayState.channelMenu.anchorY = action.payload?.anchorY ?? null;
        draft.overlayState.channelMenu.anchorSource = action.payload?.anchorSource || "";
        return true;
    case "channel-menu/close":
        draft.overlayState.channelMenu.open = false;
        draft.overlayState.channelMenu.anchorX = null;
        draft.overlayState.channelMenu.anchorY = null;
        draft.overlayState.channelMenu.anchorSource = "";
        return true;
    case "notification-center/open":
        draft.overlayState.notificationCenter.open = true;
        draft.overlayState.notificationCenter.tab = action.payload?.tab || draft.overlayState.notificationCenter.tab;
        draft.overlayState.notificationCenter.anchorX = action.payload?.anchorX ?? null;
        draft.overlayState.notificationCenter.anchorY = action.payload?.anchorY ?? null;
        draft.overlayState.notificationCenter.anchorSource = action.payload?.anchorSource || "";
        return true;
    case "notification-center/close":
        draft.overlayState.notificationCenter.open = false;
        draft.overlayState.notificationCenter.anchorX = null;
        draft.overlayState.notificationCenter.anchorY = null;
        draft.overlayState.notificationCenter.anchorSource = "";
        return true;
    case "notification-center/set-tab":
        draft.overlayState.notificationCenter.tab = action.payload.tab;
        return true;
    case "member-list/open":
        draft.overlayState.memberList.open = true;
        draft.overlayState.memberList.mode = action.payload?.mode || "view";
        draft.overlayState.memberList.pendingRemoveIdentityId = null;
        return true;
    case "member-list/close":
        draft.overlayState.memberList.open = false;
        draft.overlayState.memberList.mode = "view";
        draft.overlayState.memberList.pendingRemoveIdentityId = null;
        return true;
    case "member-list/set-field":
        Object.assign(draft.overlayState.memberList, action.payload);
        return true;
    case "channel-settings/open":
        draft.overlayState.channelSettings.open = true;
        draft.overlayState.channelSettings.saveStatus = "idle";
        draft.overlayState.channelSettings.error = null;
        draft.overlayState.channelSettings.draftName = draft.runtimeState.channel?.name || "";
        draft.overlayState.channelSettings.draftLogo = draft.runtimeState.channel?.logoUrl || "";
        draft.overlayState.channelSettings.draftBackground = draft.runtimeState.channel?.backgroundUrl || "";
        return true;
    case "channel-settings/close":
        draft.overlayState.channelSettings.open = false;
        draft.overlayState.channelSettings.saveStatus = "idle";
        draft.overlayState.channelSettings.error = null;
        draft.overlayState.channelSettings.draftName = draft.runtimeState.channel?.name || "";
        draft.overlayState.channelSettings.draftLogo = draft.runtimeState.channel?.logoUrl || "";
        draft.overlayState.channelSettings.draftBackground = draft.runtimeState.channel?.backgroundUrl || "";
        return true;
    case "channel-settings/set-field":
        Object.assign(draft.overlayState.channelSettings, action.payload);
        return true;
    case "channel-settings/save-start":
        draft.overlayState.channelSettings.saveStatus = "saving";
        draft.overlayState.channelSettings.error = null;
        return true;
    case "channel-settings/save-error":
        draft.overlayState.channelSettings.saveStatus = "idle";
        draft.overlayState.channelSettings.error = action.payload.error;
        return true;
    case "channel-settings/save-finish":
        draft.overlayState.channelSettings.saveStatus = "idle";
        draft.overlayState.channelSettings.open = false;
        draft.overlayState.channelSettings.error = null;
        return true;
    case "channel-intelligence/open":
        draft.overlayState.channelIntelligence.open = true;
        return true;
    case "channel-intelligence/close":
        draft.overlayState.channelIntelligence.open = false;
        draft.overlayState.channelIntelligence.archiveDetailOpen = false;
        return true;
    case "channel-intelligence/set-field":
        Object.assign(draft.overlayState.channelIntelligence, action.payload);
        return true;
    case "round-management/open":
        draft.overlayState.roundManagement.open = true;
        draft.overlayState.roundManagement.draftTheme = draft.roundState.theme || "";
        draft.overlayState.roundManagement.draftDeadlines = { ...(draft.roundState.deadlines || {}) };
        return true;
    case "round-management/close":
        draft.overlayState.roundManagement.open = false;
        draft.overlayState.roundManagement.godPickerOpen = false;
        draft.overlayState.roundManagement.themeEditorOpen = false;
        draft.overlayState.roundManagement.deadlineEditorOpen = false;
        draft.overlayState.roundManagement.revealEditorOpen = false;
        draft.overlayState.roundManagement.revealMemberPickerOpen = false;
        draft.overlayState.roundManagement.revealAngelPickerOpen = false;
        draft.overlayState.roundManagement.draftRevealMember = null;
        draft.overlayState.roundManagement.draftRevealAngel = null;
        draft.overlayState.roundManagement.draftTheme = draft.roundState.theme || "";
        draft.overlayState.roundManagement.draftDeadlines = { ...(draft.roundState.deadlines || {}) };
        return true;
    case "round-management/set-field":
        Object.assign(draft.overlayState.roundManagement, action.payload);
        return true;
    case "image-lightbox/open":
        draft.overlayState.imageLightbox.open = true;
        draft.overlayState.imageLightbox.image = cloneSimple(action.payload.image);
        draft.overlayState.imageLightbox.source = action.payload.source || "";
        return true;
    case "image-lightbox/close":
        draft.overlayState.imageLightbox.open = false;
        draft.overlayState.imageLightbox.image = null;
        draft.overlayState.imageLightbox.source = "";
        return true;
    case "delete-confirm/open":
        draft.overlayState.deleteConfirm.open = true;
        draft.overlayState.deleteConfirm.targetType = action.payload.targetType;
        draft.overlayState.deleteConfirm.targetId = action.payload.targetId;
        draft.overlayState.deleteConfirm.postId = action.payload.postId || null;
        draft.overlayState.deleteConfirm.title = action.payload.title || "";
        draft.overlayState.deleteConfirm.message = action.payload.message || "";
        draft.overlayState.deleteConfirm.scopeLabel = action.payload.scopeLabel || "";
        draft.overlayState.deleteConfirm.submitStatus = "idle";
        draft.overlayState.deleteConfirm.error = null;
        return true;
    case "delete-confirm/close":
        resetDeleteConfirm(draft);
        return true;
    case "delete-confirm/submit-start":
        draft.overlayState.deleteConfirm.submitStatus = "submitting";
        draft.overlayState.deleteConfirm.error = null;
        return true;
    case "delete-confirm/submit-error":
        draft.overlayState.deleteConfirm.submitStatus = "idle";
        draft.overlayState.deleteConfirm.error = action.payload.error;
        return true;
    case "delete-confirm/submit-finish":
        resetDeleteConfirm(draft);
        return true;
    case "identity/open":
        draft.overlayState.identity.open = true;
        draft.overlayState.identity.saveStatus = "idle";
        draft.overlayState.identity.error = null;
        draft.overlayState.identity.draftName = draft.runtimeState.realIdentity.name;
        draft.overlayState.identity.draftAvatar = draft.runtimeState.realIdentity.avatar;
        return true;
    case "identity/close":
        draft.overlayState.identity.open = false;
        draft.overlayState.identity.saveStatus = "idle";
        draft.overlayState.identity.error = null;
        draft.overlayState.identity.draftName = draft.runtimeState.realIdentity.name;
        draft.overlayState.identity.draftAvatar = draft.runtimeState.realIdentity.avatar;
        return true;
    case "identity/set-field":
        Object.assign(draft.overlayState.identity, action.payload);
        return true;
    case "identity/save-start":
        draft.overlayState.identity.saveStatus = "saving";
        draft.overlayState.identity.error = null;
        return true;
    case "identity/save-error":
        draft.overlayState.identity.saveStatus = "idle";
        draft.overlayState.identity.error = action.payload.error;
        return true;
    case "identity/save-finish":
        draft.overlayState.identity.saveStatus = "idle";
        draft.overlayState.identity.open = false;
        draft.overlayState.identity.error = null;
        return true;
    case "auth-gate/open":
        draft.overlayState.authGate.open = true;
        draft.overlayState.authGate.mode = action.payload.mode || "login";
        draft.authState.error = null;
        return true;
    case "auth-gate/close":
        draft.overlayState.authGate.open = false;
        draft.authState.error = null;
        return true;
    case "search-dialog/open":
        draft.overlayState.searchDialog.open = true;
        if (typeof action.payload?.query === "string") {
            draft.overlayState.searchDialog.query = action.payload.query;
        }
        return true;
    case "search-dialog/close":
        draft.overlayState.searchDialog.open = false;
        return true;
    case "search-dialog/set-field":
        Object.assign(draft.overlayState.searchDialog, action.payload);
        return true;
    case "search-dialog/load-start":
        draft.overlayState.searchDialog.status = "loading";
        draft.overlayState.searchDialog.error = null;
        return true;
    case "search-dialog/load-success":
        draft.overlayState.searchDialog.status = "ready";
        draft.overlayState.searchDialog.error = null;
        draft.overlayState.searchDialog.items = action.payload.items.map((item) => ({ ...item }));
        return true;
    case "search-dialog/load-error":
        draft.overlayState.searchDialog.status = "error";
        draft.overlayState.searchDialog.error = action.payload.error;
        return true;
    case "registered-users/open":
        draft.overlayState.registeredUsers.open = true;
        return true;
    case "registered-users/close":
        draft.overlayState.registeredUsers.open = false;
        return true;
    case "registered-users/load-start":
        draft.overlayState.registeredUsers.status = "loading";
        draft.overlayState.registeredUsers.error = null;
        return true;
    case "registered-users/load-success":
        draft.overlayState.registeredUsers.status = "ready";
        draft.overlayState.registeredUsers.error = null;
        draft.overlayState.registeredUsers.items = action.payload.items.map((item) => ({ ...item }));
        return true;
    case "registered-users/load-error":
        draft.overlayState.registeredUsers.status = "error";
        draft.overlayState.registeredUsers.error = action.payload.error;
        draft.overlayState.registeredUsers.items = [];
        return true;
    case "toast/show":
        draft.overlayState.toast = {
            visible: true,
            tone: action.payload.tone || "info",
            message: action.payload.message
        };
        return true;
    case "toast/hide":
        draft.overlayState.toast.visible = false;
        return true;
    default:
        return false;
    }
};
