import { describe, expect, it } from "vitest";
import { selectAuthGateVM } from "../blocks/auth-gate/selectors.js";
import { selectChannelMenuDialogVM } from "../blocks/channel-menu-dialog/selectors.js";
import { selectCommentDrawerVM } from "../blocks/comment-drawer/selectors.js";
import { selectJoinRequestPanelVM } from "../blocks/join-request-panel/selectors.js";
import { selectNotificationCenterVM } from "../blocks/notification-center/selectors.js";
import { createInitialState } from "../shared/state/store.js";

describe("channel view model selectors: comments/overlays", () => {
    it("sorts comments and disables sending for guests", () => {
        const state = createInitialState();
        state.authState.status = "guest";
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.sort = "latest";
        state.overlayState.comments.post = {
            id: "post-1",
            comments: [
                { id: "a", text: "早一点" },
                { id: "b", text: "晚一点" }
            ]
        };

        const vm = selectCommentDrawerVM(state);
        expect(vm.comments[0].id).toBe("b");
        expect(vm.canSend).toBe(false);
    });

    it("sorts hot comments by likes and exposes liked and reply state", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.sort = "hot";
        state.overlayState.comments.likedCommentIds = ["b"];
        state.overlayState.comments.replyTarget = { id: "b", authorName: "北桥" };
        state.overlayState.comments.post = {
            id: "post-1",
            comments: [
                { id: "a", text: "第一条", likes: 1 },
                { id: "b", text: "第二条", likes: 3 }
            ]
        };

        const vm = selectCommentDrawerVM(state);
        expect(vm.comments[0].id).toBe("b");
        expect(vm.comments[0].isLiked).toBe(true);
        expect(vm.replyTarget.authorName).toBe("北桥");
    });

    it("renders reply comments as threaded items under their parent", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.sort = "latest";
        state.overlayState.comments.post = {
            id: "post-1",
            comments: [
                { id: "a", authorName: "海屿", text: "第一条", createdAt: "2026-04-20T10:00:00.000Z", likes: 0, parentCommentId: null },
                { id: "b", authorName: "章鱼烧", text: "回复内容", createdAt: "2026-04-20T11:00:00.000Z", likes: 0, parentCommentId: "a" },
                { id: "c", authorName: "北桥", text: "另一条根评论", createdAt: "2026-04-20T12:00:00.000Z", likes: 2, parentCommentId: null }
            ]
        };

        const vm = selectCommentDrawerVM(state);
        expect(vm.comments.map((comment) => comment.id)).toEqual(["c", "a", "b"]);
        expect(vm.comments[2].replyDepth).toBe(1);
    });

    it("keeps wish post author masked inside the comment drawer until admin reveal is enabled", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.post = {
            id: "post-1",
            board: "wish",
            authorName: "管理员",
            authorAvatar: "owner-avatar",
            authorUserId: "user-owner",
            role: "owner",
            isAnonymous: false,
            comments: []
        };

        let vm = selectCommentDrawerVM(state);
        expect(vm.post.authorName).not.toBe("管理员");

        state.uiState.adminRevealAnonymous = true;
        vm = selectCommentDrawerVM(state);
        expect(vm.post.showAdminReveal).toBe(true);
        expect(vm.post.adminRevealIdentity.name).toBe("管理员");
    });

    it("exposes comment drawer source and focus target", () => {
        const state = createInitialState();
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.openSource = "comments";
        state.overlayState.comments.initialFocusTarget = "comment-input";
        state.overlayState.comments.post = { id: "post-1", comments: [] };

        const vm = selectCommentDrawerVM(state);
        expect(vm.openSource).toBe("comments");
        expect(vm.initialFocusTarget).toBe("comment-input");
    });

    it("turns deleted post drawer into read-only mode", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1" };
        state.membershipState.status = "approved";
        state.overlayState.comments.open = true;
        state.overlayState.comments.status = "ready";
        state.overlayState.comments.post = {
            id: "post-1",
            authorUserId: "user-2",
            text: "该帖子已删除",
            isDeleted: true,
            deletedLabel: "该帖子已删除",
            comments: []
        };

        const vm = selectCommentDrawerVM(state);
        expect(vm.canInteract).toBe(false);
        expect(vm.copyEnabled).toBe(false);
    });

    it("keeps auth gate closed until login is explicitly opened", () => {
        const state = createInitialState();
        state.authState.status = "upgrading_legacy_anonymous";

        const vm = selectAuthGateVM(state);
        expect(vm.open).toBe(false);
        expect(vm.mode).toBe("login");
    });

    it("builds join request vm for guest viewer", () => {
        const state = createInitialState();
        state.runtimeState.status = "preview";
        state.authState.status = "guest";
        state.membershipState.status = "guest";

        const vm = selectJoinRequestPanelVM(state);
        expect(vm.visible).toBe(true);
        expect(vm.primaryLabel).toBe("邮箱登录");
        expect(vm.canSubmit).toBe(false);
    });

    it("computes anchored floating panel styles from trigger coordinates", () => {
        const state = createInitialState();
        state.overlayState.notificationCenter.open = true;
        state.overlayState.notificationCenter.anchorX = 900;
        state.overlayState.notificationCenter.anchorY = 72;
        state.overlayState.channelMenu.open = true;
        state.overlayState.channelMenu.anchorX = 120;
        state.overlayState.channelMenu.anchorY = 68;

        expect(selectNotificationCenterVM(state).panelStyle).toContain("left:");
        expect(selectChannelMenuDialogVM(state).panelStyle).toContain("left:");
    });

    it("only exposes the registered users entry to the designated operator account", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = {
            id: "user-1",
            email: "wyc1186164839@gmail.com"
        };

        expect(selectChannelMenuDialogVM(state).canViewRegisteredUsers).toBe(true);

        state.authState.user.email = "member@example.com";
        expect(selectChannelMenuDialogVM(state).canViewRegisteredUsers).toBe(false);
    });
});
