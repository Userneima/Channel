import { createAuthActions } from "./auth/index.js";
import { createChannelCreateActions } from "./channel-create/index.js";
import { createComposerActions } from "./composer/index.js";
import { createFeedActions } from "./feed/index.js";
import { createMembershipActions } from "./membership/index.js";
import { createRoundActions } from "./round/actions.js";
import { createRuntimeActions } from "./runtime/index.js";
import { createShellActions } from "./shell/index.js";
import {
    getChannelActionErrorMessage,
    readBlobAsDataUrl,
    resolveHighestChannelRole
} from "../shared/lib/helpers.js";

export const createAppActions = ({ store, dataService }) => {
    let toastTimer = null;

    const showToast = ({ tone = "info", message }) => {
        store.dispatch({
            type: "toast/show",
            payload: { tone, message }
        });

        if (toastTimer) {
            window.clearTimeout(toastTimer);
        }

        toastTimer = window.setTimeout(() => {
            store.dispatch({ type: "toast/hide" });
        }, 3200);
    };

    const hideToast = () => {
        if (toastTimer) {
            window.clearTimeout(toastTimer);
            toastTimer = null;
        }
        store.dispatch({ type: "toast/hide" });
    };

    const shellActions = createShellActions({ store, dataService, showToast });
    const feedActions = createFeedActions({ store, dataService, showToast });
    const runtimeActions = createRuntimeActions({ store, dataService, showToast, feedActions });
    const channelCreateActions = createChannelCreateActions({ store, dataService, showToast });
    const composerActions = createComposerActions({ store, dataService, showToast, feedActions });
    const authActions = createAuthActions({ store, dataService, showToast, runtimeActions });
    const membershipActions = createMembershipActions({ store, dataService, showToast, runtimeActions });
    const roundActions = createRoundActions({
        store,
        dataService,
        showToast,
        loadFeed: (board) => feedActions.loadFeed(board)
    });

    const baseInitializeChannelRuntime = runtimeActions.initializeChannelRuntime;
    const baseRefreshChannelAccessState = runtimeActions.refreshChannelAccessState;
    const baseClaimWish = feedActions.claimWish;
    const baseSubmitPost = composerActions.submitPost;
    const baseApproveJoinRequest = membershipActions.approveJoinRequest;
    const baseRejectJoinRequest = membershipActions.rejectJoinRequest;
    const basePromoteMemberToAdmin = membershipActions.promoteMemberToAdmin;
    const baseDemoteAdminToMember = membershipActions.demoteAdminToMember;
    const baseConfirmRemoveMember = membershipActions.confirmRemoveMember;

    const appActions = {
        ...shellActions,
        ...feedActions,
        ...composerActions,
        ...authActions,
        ...membershipActions,
        ...runtimeActions,
        ...channelCreateActions,
        ...roundActions,
        async initializeChannelRuntime() {
            await baseInitializeChannelRuntime.call(appActions);
            await appActions.refreshCurrentRound({ silent: true });
            await appActions.refreshRoundMemberStatuses({ silent: true });
            await appActions.refreshRoundArchives({ silent: true });
        },
        async refreshChannelAccessState(payload) {
            await baseRefreshChannelAccessState.call(appActions, payload);
            await appActions.refreshCurrentRound({ silent: true });
            await appActions.refreshRoundMemberStatuses({ silent: true });
            await appActions.refreshRoundArchives({ silent: true });
        },
        async claimWish(postId) {
            await baseClaimWish.call(appActions, postId);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async submitPost() {
            await baseSubmitPost.call(appActions);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async approveJoinRequest(requestId) {
            await baseApproveJoinRequest.call(appActions, requestId);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async rejectJoinRequest(requestId, reason = "") {
            await baseRejectJoinRequest.call(appActions, requestId, reason);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async promoteMemberToAdmin(identityId) {
            await basePromoteMemberToAdmin.call(appActions, identityId);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async demoteAdminToMember(identityId) {
            await baseDemoteAdminToMember.call(appActions, identityId);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        async confirmRemoveMember(identityId) {
            await baseConfirmRemoveMember.call(appActions, identityId);
            await appActions.refreshRoundMemberStatuses({ silent: true });
        },
        openOverlay(name, payload = {}) {
            if (name === "comments" && payload.postId) {
                this.openComments(payload.postId, payload.source || "comments");
                return;
            }
            if (name === "channel-menu") {
                this.openChannelMenu(payload);
                return;
            }
            if (name === "notification-center") {
                this.openNotificationCenter(payload.tab || "interaction", payload);
                return;
            }
            if (name === "member-list") {
                void this.openMemberList();
                return;
            }
            if (name === "channel-intelligence") {
                this.openChannelDigest();
                return;
            }
            if (name === "round-management") {
                this.openRoundManagement();
                return;
            }
            if (name === "image-lightbox" && payload.image) {
                store.dispatch({
                    type: "image-lightbox/open",
                    payload: {
                        image: payload.image,
                        source: payload.source || ""
                    }
                });
                return;
            }
            if (name === "identity") {
                this.openIdentityDialog();
                return;
            }
            if (name === "channel-settings") {
                this.openChannelSettings();
                return;
            }
            if (name === "auth-gate") {
                this.openAuthGate(payload.mode || "login");
                return;
            }
            if (name === "search-dialog") {
                void this.openSearchDialog();
            }
        },
        closeOverlay(name) {
            if (name === "comments") {
                this.closeComments();
                return;
            }
            if (name === "channel-menu") {
                this.closeChannelMenu();
                return;
            }
            if (name === "notification-center") {
                this.closeNotificationCenter();
                return;
            }
            if (name === "member-list") {
                this.closeMemberList();
                return;
            }
            if (name === "channel-intelligence") {
                this.closeChannelDigest();
                return;
            }
            if (name === "round-management") {
                this.closeRoundManagement();
                return;
            }
            if (name === "image-lightbox") {
                this.closeImageLightbox();
                return;
            }
            if (name === "identity") {
                this.closeIdentityDialog();
                return;
            }
            if (name === "channel-settings") {
                this.closeChannelSettings();
                return;
            }
            if (name === "auth-gate") {
                this.closeAuthGate();
                return;
            }
            if (name === "search-dialog") {
                this.closeSearchDialog();
            }
        },
        showToast,
        hideToast,
        openChannelDigest() {
            store.dispatch({ type: "channel-intelligence/open" });
        },
        closeChannelDigest() {
            store.dispatch({ type: "channel-intelligence/close" });
        },
        openChannelIntelligence() {
            appActions.openChannelDigest();
        },
        closeChannelIntelligence() {
            appActions.closeChannelDigest();
        },
        openRoundManagement() {
            store.dispatch({ type: "round-management/open" });
        },
        closeRoundManagement() {
            store.dispatch({ type: "round-management/close" });
        },
        async openMemberList() {
            const membershipStatus = store.getState().membershipState.status;
            if (membershipStatus === "approved") {
                await this.loadMemberDirectory();
            }

            const state = store.getState();
            const effectiveRole = resolveHighestChannelRole({
                members: state.membershipState.directoryItems || [],
                currentUserId: state.authState.user?.id || "",
                currentIdentityId: state.runtimeState.realIdentity.id,
                fallbackRole: state.runtimeState.realIdentity.role
            });
            const canManageMembers = membershipStatus === "approved" && ["owner", "admin"].includes(effectiveRole);
            store.dispatch({
                type: "member-list/open",
                payload: {
                    mode: canManageMembers ? "manage" : "view"
                }
            });
        },
        closeMemberList() {
            store.dispatch({ type: "member-list/close" });
        },
        openChannelSettings() {
            const role = store.getState().runtimeState.realIdentity.role;
            if (!["owner", "admin"].includes(role)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能编辑频道资料。"
                });
                return;
            }

            store.dispatch({ type: "channel-settings/open" });
        },
        closeChannelSettings() {
            store.dispatch({ type: "channel-settings/close" });
        },
        setChannelSettingsDraft(partial) {
            store.dispatch({
                type: "channel-settings/set-field",
                payload: partial
            });
        },
        async setChannelLogo(file) {
            if (!file) {
                return;
            }

            try {
                const draftLogo = await readBlobAsDataUrl(file);
                this.setChannelSettingsDraft({ draftLogo });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("read_avatar", error)
                });
            }
        },
        async setChannelBackground(file) {
            if (!file) {
                return;
            }

            try {
                const draftBackground = await readBlobAsDataUrl(file);
                this.setChannelSettingsDraft({ draftBackground });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("read_media", error)
                });
            }
        },
        async saveChannelSettings() {
            const state = store.getState();
            const draftName = state.overlayState.channelSettings.draftName.trim();
            if (!draftName) {
                return;
            }

            store.dispatch({ type: "channel-settings/save-start" });

            try {
                const nextChannel = await dataService.updateChannel({
                    name: draftName,
                    logoUrl: state.overlayState.channelSettings.draftLogo,
                    backgroundUrl: state.overlayState.channelSettings.draftBackground
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({ type: "channel-settings/save-finish" });
                showToast({
                    tone: "success",
                    message: "频道资料已更新。"
                });
            } catch (error) {
                store.dispatch({
                    type: "channel-settings/save-error",
                    payload: { error }
                });
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_channel", error)
                });
            }
        },
        getDeleteConfirmState() {
            return store.getState().overlayState.deleteConfirm;
        }
    };

    return appActions;
};
