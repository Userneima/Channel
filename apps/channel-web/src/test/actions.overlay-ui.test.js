import { beforeEach, describe, expect, it } from "vitest";
import { approvedRuntime, createActionsHarness, seedApprovedViewer } from "../../test-support/actions-fixture.js";

describe("channel feature actions: overlay/ui", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        ({ store, dataService, actions } = createActionsHarness());
    });

    it("opens post detail drawer with source metadata", () => {
        actions.openOverlay("comments", {
            postId: "post-1",
            source: "body"
        });

        const commentsOverlay = store.getState().overlayState.comments;
        expect(commentsOverlay.open).toBe(true);
        expect(commentsOverlay.openSource).toBe("body");
        expect(commentsOverlay.initialFocusTarget).toBe("post-body");
    });

    it("opens and closes the image lightbox from feed images", () => {
        store.dispatch({
            type: "feed/load-success",
            payload: {
                items: [{
                    id: "post-1",
                    images: [{ name: "cover.png", url: "https://example.com/cover.png" }],
                    comments: []
                }]
            }
        });

        actions.openPostImage("post-1", 0);

        expect(store.getState().overlayState.imageLightbox.open).toBe(true);
        actions.closeOverlay("image-lightbox");
        expect(store.getState().overlayState.imageLightbox.open).toBe(false);
    });

    it("opens the image lightbox from drawer images", () => {
        store.dispatch({
            type: "comments/open",
            payload: { postId: "post-1", source: "comments" }
        });
        store.dispatch({
            type: "comments/load-success",
            payload: {
                post: {
                    id: "post-1",
                    images: [{ name: "detail.png", url: "https://example.com/detail.png" }],
                    comments: []
                }
            }
        });

        actions.openCurrentDrawerImage(0);

        expect(store.getState().overlayState.imageLightbox.open).toBe(true);
        expect(store.getState().overlayState.imageLightbox.source).toBe("comments");
    });

    it("saves channel settings and updates the current channel", async () => {
        seedApprovedViewer(store);
        store.dispatch({ type: "channel-settings/open" });
        store.dispatch({
            type: "channel-settings/set-field",
            payload: {
                draftName: "新的频道名",
                draftLogo: "new-logo",
                draftBackground: "new-background"
            }
        });
        dataService.updateChannel.mockResolvedValue({
            name: "新的频道名",
            logoUrl: "new-logo",
            backgroundUrl: "new-background"
        });

        await actions.saveChannelSettings();

        expect(dataService.updateChannel).toHaveBeenCalledWith({
            name: "新的频道名",
            logoUrl: "new-logo",
            backgroundUrl: "new-background"
        });
        expect(store.getState().overlayState.channelSettings.open).toBe(false);
    });

    it("toggles the account menu from the sidebar identity trigger", () => {
        expect(store.getState().uiState.accountMenuOpen).toBe(false);
        actions.toggleAccountMenu();
        expect(store.getState().uiState.accountMenuOpen).toBe(true);
        actions.toggleAccountMenu();
        expect(store.getState().uiState.accountMenuOpen).toBe(false);
    });

    it("opens the channel search dialog from the hero search entry", async () => {
        dataService.listPosts.mockResolvedValue([{ id: "post-1", authorName: "云栖", text: "test", comments: [] }]);

        await actions.requestSearchFocus();

        expect(store.getState().overlayState.searchDialog.open).toBe(true);
        expect(store.getState().overlayState.searchDialog.items).toHaveLength(1);
    });

    it("opens and closes the channel menu overlay", () => {
        actions.openChannelMenu({
            anchorX: 120,
            anchorY: 68,
            anchorSource: "channel-hero-menu"
        });

        expect(store.getState().overlayState.channelMenu.open).toBe(true);
        actions.closeChannelMenu();
        expect(store.getState().overlayState.channelMenu.open).toBe(false);
    });

    it("opens and switches the notification center overlay", () => {
        actions.openNotificationCenter("interaction", {
            anchorX: 132,
            anchorY: 72,
            anchorSource: "channel-hero-notifications"
        });

        expect(store.getState().overlayState.notificationCenter.open).toBe(true);
        actions.openNotificationCenter("admin");
        expect(store.getState().overlayState.notificationCenter.tab).toBe("admin");
        actions.closeNotificationCenter();
        expect(store.getState().overlayState.notificationCenter.open).toBe(false);
    });

    it("opens member list in manage mode for owners and loads the member directory", async () => {
        seedApprovedViewer(store);
        dataService.listChannelMembers.mockResolvedValue([
            { identityId: "identity-1", userId: "user-1", name: "管理员", avatar: "avatar", role: "owner" },
            { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member" }
        ]);

        await actions.openMemberList();

        const state = store.getState();
        expect(state.overlayState.memberList.open).toBe(true);
        expect(state.overlayState.memberList.mode).toBe("manage");
        expect(dataService.listChannelMembers).toHaveBeenCalledWith("channel-1");
        expect(state.membershipState.directoryItems).toHaveLength(2);
    });

    it("opens member list in manage mode when runtime role is stale but directory shows owner", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                ...store.getState().runtimeState,
                channel: approvedRuntime.channel,
                realIdentity: {
                    id: "identity-member",
                    name: "章鱼烧",
                    avatar: "avatar",
                    meta: "当前真实身份",
                    role: "member"
                },
                anonymousProfiles: approvedRuntime.anonymousProfiles,
                activeAliasKey: approvedRuntime.activeAliasKey
            }
        });
        dataService.listChannelMembers.mockResolvedValue([
            { identityId: "identity-owner", userId: "user-1", name: "Yuchao", avatar: "owner-avatar", role: "owner" },
            { identityId: "identity-member", userId: "user-1", name: "章鱼烧", avatar: "avatar", role: "member" },
            { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member" }
        ]);

        await actions.openMemberList();

        const state = store.getState();
        expect(state.overlayState.memberList.open).toBe(true);
        expect(state.overlayState.memberList.mode).toBe("manage");
    });

    it("resets pending removal state when member list closes", () => {
        store.dispatch({
            type: "member-list/open",
            payload: { mode: "manage" }
        });
        store.dispatch({
            type: "member-list/set-field",
            payload: {
                pendingRemoveIdentityId: "identity-2"
            }
        });

        actions.closeOverlay("member-list");

        const state = store.getState().overlayState.memberList;
        expect(state.open).toBe(false);
        expect(state.mode).toBe("view");
        expect(state.pendingRemoveIdentityId).toBe(null);
    });

    it("opens the registered users dialog only for the designated operator account", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "wyc1186164839@gmail.com" },
                isAnonymous: false
            }
        });
        dataService.listRegisteredUsers.mockResolvedValue([
            {
                userId: "user-1",
                email: "wyc1186164839@gmail.com",
                displayName: "Yuchao",
                avatarUrl: "avatar",
                createdAt: "2026-05-13T00:00:00.000Z",
                lastSignInAt: "2026-05-13T01:00:00.000Z"
            }
        ]);

        await actions.openRegisteredUsersDialog();

        const state = store.getState().overlayState.registeredUsers;
        expect(state.open).toBe(true);
        expect(state.items).toHaveLength(1);
        expect(dataService.listRegisteredUsers).toHaveBeenCalled();
    });

    it("blocks the registered users dialog for other accounts", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-2", email: "member@example.com" },
                isAnonymous: false
            }
        });

        await actions.openRegisteredUsersDialog();

        const state = store.getState().overlayState.registeredUsers;
        expect(state.open).toBe(false);
        expect(dataService.listRegisteredUsers).not.toHaveBeenCalled();
    });

    it("shows a migration hint when the registered users rpc permission chain is incomplete", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "wyc1186164839@gmail.com" },
                isAnonymous: false
            }
        });
        dataService.listRegisteredUsers.mockRejectedValue({
            code: "42501",
            message: "permission denied for function list_registered_users"
        });

        await actions.openRegisteredUsersDialog();

        const state = store.getState().overlayState.registeredUsers;
        expect(state.open).toBe(true);
        expect(state.error).toBe("已注册用户目录的数据库权限还没同步完成，请补上最新 migration。");
    });

    it("surfaces the raw operator error when the rpc still fails for another reason", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "wyc1186164839@gmail.com" },
                isAnonymous: false
            }
        });
        dataService.listRegisteredUsers.mockRejectedValue({
            message: "relation auth.users does not exist"
        });

        await actions.openRegisteredUsersDialog();

        const state = store.getState().overlayState.registeredUsers;
        expect(state.open).toBe(true);
        expect(state.error).toBe("已注册用户列表加载失败：relation auth.users does not exist");
    });
});
