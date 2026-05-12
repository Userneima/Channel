import { beforeEach, describe, expect, it } from "vitest";
import { approvedRuntime, createActionsHarness, seedApprovedViewer } from "../../test-support/actions-fixture.js";

describe("channel feature actions: runtime/auth/membership", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        ({ store, dataService, actions } = createActionsHarness());
    });

    it("initializes public preview, auth state and approved member runtime", async () => {
        dataService.loadChannelBootstrap.mockResolvedValue({
            channel: approvedRuntime.channel,
            auth: {
                user: { id: "user-1", email: "owner@example.com" },
                isAnonymous: false
            },
            membership: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                role: "owner"
            },
            memberRuntime: approvedRuntime
        });
        dataService.listPosts.mockResolvedValue([{ id: "post-1", comments: [] }]);

        await actions.initializeChannelRuntime();

        const state = store.getState();
        expect(state.runtimeState.status).toBe("ready");
        expect(state.authState.status).toBe("authenticated");
        expect(state.membershipState.status).toBe("approved");
        expect(state.feedState.items).toHaveLength(1);
    });

    it("logs in with password and refreshes approved runtime", async () => {
        store.dispatch({
            type: "auth/set-field",
            payload: { email: "member@example.com", password: "secret123" }
        });
        dataService.loginWithPassword.mockResolvedValue({
            user: { id: "user-1", email: "member@example.com" },
            isAnonymous: false
        });
        dataService.loadChannelBootstrap.mockResolvedValue({
            channel: approvedRuntime.channel,
            auth: {
                user: { id: "user-1", email: "member@example.com" },
                isAnonymous: false
            },
            membership: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                role: "owner"
            },
            memberRuntime: approvedRuntime
        });

        await actions.loginWithPassword();

        expect(dataService.loginWithPassword).toHaveBeenCalledWith("member@example.com", "secret123");
        expect(store.getState().authState.status).toBe("authenticated");
    });

    it("keeps create-channel draft after successful registration", async () => {
        window.history.replaceState({}, "", "/?view=create-channel");
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode: "register" }
        });
        store.dispatch({
            type: "auth/set-field",
            payload: {
                displayName: "海屿",
                email: "member@example.com",
                password: "secret123"
            }
        });
        store.dispatch({
            type: "channel-create/set-field",
            payload: {
                name: "新频道",
                description: "保留中的草稿"
            }
        });
        dataService.registerWithPassword.mockResolvedValue({
            user: { id: "user-1", email: "member@example.com" },
            isAnonymous: false
        });
        dataService.getAuthState.mockResolvedValue({
            user: { id: "user-1", email: "member@example.com" },
            isAnonymous: false
        });

        await actions.submitAuthFlow();

        const state = store.getState();
        expect(state.authState.status).toBe("authenticated");
        expect(state.channelCreateState.name).toBe("新频道");
        expect(dataService.loadChannelBootstrap).not.toHaveBeenCalled();
    });

    it("shows an explicit error when registration returns no session", async () => {
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode: "register" }
        });
        store.dispatch({
            type: "auth/set-field",
            payload: {
                displayName: "海屿",
                email: "member@example.com",
                password: "secret123"
            }
        });
        const error = new Error("Supabase email confirmation is still enabled.");
        error.code = "auth_email_confirmation_required";
        dataService.registerWithPassword.mockRejectedValue(error);

        await actions.submitAuthFlow();

        const state = store.getState();
        expect(state.authState.status).toBe("guest");
        expect(state.authState.error).toContain("还没有关闭邮箱确认");
    });

    it("keeps the viewer in preview state after submitting an approval-required join request", async () => {
        store.dispatch({
            type: "runtime/preview-ready",
            payload: { channel: approvedRuntime.channel }
        });
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-2", email: "guest@example.com" },
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "guest",
                draftMessage: "我想加入讨论。"
            }
        });
        dataService.submitJoinRequest.mockResolvedValue({
            id: "request-2",
            channelId: "channel-1",
            userId: "user-2",
            status: "pending",
            message: "我想加入讨论。"
        });
        dataService.loadChannelBootstrap.mockResolvedValue({
            channel: approvedRuntime.channel,
            auth: {
                user: { id: "user-2", email: "guest@example.com" },
                isAnonymous: false
            },
            membership: {
                status: "pending",
                joinRequest: {
                    id: "request-2",
                    channelId: "channel-1",
                    userId: "user-2",
                    status: "pending",
                    message: "我想加入讨论。"
                },
                reviewItems: [],
                role: null
            },
            memberRuntime: null
        });

        await actions.submitJoinRequest();

        const state = store.getState();
        expect(state.membershipState.status).toBe("pending");
        expect(state.runtimeState.status).toBe("preview");
    });

    it("signs out and returns the page to public preview state", async () => {
        store.dispatch({
            type: "runtime/member-ready",
            payload: approvedRuntime
        });
        store.dispatch({
            type: "feed/load-success",
            payload: { items: [{ id: "post-1", comments: [] }] }
        });
        dataService.signOut.mockResolvedValue({
            user: null,
            isAnonymous: false
        });
        dataService.loadChannelBootstrap.mockResolvedValue({
            channel: approvedRuntime.channel,
            auth: {
                user: null,
                isAnonymous: false
            },
            membership: {
                status: "guest",
                joinRequest: null,
                reviewItems: [],
                role: null
            },
            memberRuntime: null
        });
        dataService.listPosts.mockResolvedValue([{ id: "post-1", comments: [] }]);

        await actions.logout();

        const state = store.getState();
        expect(dataService.signOut).toHaveBeenCalled();
        expect(state.authState.status).toBe("guest");
        expect(state.membershipState.status).toBe("guest");
        expect(state.runtimeState.status).toBe("preview");
    });

    it("creates channel and redirects into the new channel as owner", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "owner@example.com" },
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "channel-create/set-field",
            payload: {
                name: "新频道",
                description: "新频道简介"
            }
        });
        dataService.createChannel.mockResolvedValue({
            channel: { id: "channel-2", slug: "new-channel", name: "新频道", previewVisibility: "public", joinPolicy: "approval_required" },
            realIdentity: { id: "identity-2", name: "owner", avatar: "avatar", meta: "当前真实身份", role: "owner" },
            anonymousProfiles: [{ id: "alias-2", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
            activeAliasKey: "slot-baiyu"
        });

        await actions.submitCreateChannel();

        expect(dataService.createChannel).toHaveBeenCalledWith({
            name: "新频道",
            description: "新频道简介"
        });
        expect(store.getState().runtimeState.channel?.slug).toBe("new-channel");
        expect(store.getState().runtimeState.realIdentity.role).toBe("owner");
    });

    it("promotes a member to admin and refreshes directory plus round status", async () => {
        seedApprovedViewer(store);
        dataService.setChannelMemberRole.mockResolvedValue({
            identityId: "identity-2",
            userId: "user-2",
            name: "测试账号",
            avatar: "avatar-2",
            role: "admin"
        });
        dataService.listChannelMembers.mockResolvedValue([
            { identityId: "identity-1", userId: "user-1", name: "管理员", avatar: "avatar", role: "owner" },
            { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "avatar-2", role: "admin" }
        ]);
        dataService.loadMembershipState.mockResolvedValue({
            status: "approved",
            joinRequest: null,
            reviewItems: [],
            role: "owner"
        });
        dataService.listRoundMemberStatuses.mockResolvedValue([
            { identityId: "identity-1", name: "管理员", avatar: "avatar", role: "owner" },
            { identityId: "identity-2", name: "测试账号", avatar: "avatar-2", role: "admin" }
        ]);

        await actions.promoteMemberToAdmin("identity-2");

        expect(dataService.setChannelMemberRole).toHaveBeenCalledWith("identity-2", "admin");
        expect(dataService.listChannelMembers).toHaveBeenCalledWith("channel-1");
        expect(store.getState().membershipState.directoryItems[1].role).toBe("admin");
        expect(store.getState().roundState.memberStatuses[1].role).toBe("admin");
    });

    it("removes a member and refreshes directory plus round status", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "member-list/set-field",
            payload: {
                pendingRemoveIdentityId: "identity-2"
            }
        });
        dataService.removeChannelMember.mockResolvedValue({
            identityId: "identity-2",
            userId: "user-2",
            name: "测试账号",
            avatar: "avatar-2",
            role: "member"
        });
        dataService.listChannelMembers.mockResolvedValue([
            { identityId: "identity-1", userId: "user-1", name: "管理员", avatar: "avatar", role: "owner" }
        ]);
        dataService.loadMembershipState.mockResolvedValue({
            status: "approved",
            joinRequest: null,
            reviewItems: [],
            role: "owner"
        });
        dataService.listRoundMemberStatuses.mockResolvedValue([
            { identityId: "identity-1", name: "管理员", avatar: "avatar", role: "owner" }
        ]);

        await actions.confirmRemoveMember("identity-2");

        expect(dataService.removeChannelMember).toHaveBeenCalledWith("identity-2");
        expect(store.getState().overlayState.memberList.pendingRemoveIdentityId).toBe(null);
        expect(store.getState().membershipState.directoryItems).toHaveLength(1);
        expect(store.getState().roundState.memberStatuses).toHaveLength(1);
    });
});
