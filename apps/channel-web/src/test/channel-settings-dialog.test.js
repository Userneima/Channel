import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountChannelSettingsDialogBlock } from "../blocks/channel-settings-dialog/index.js";
import { createAppActions } from "../features/app-actions.js";

const createMockDataService = () => ({
    getAuthState: vi.fn(),
    getChannelShell: vi.fn(),
    getCachedChannelBootstrap: vi.fn(),
    loadChannelBootstrap: vi.fn(),
    loadPublicChannelPreview: vi.fn(),
    loadMembershipState: vi.fn(),
    loadApprovedMemberRuntime: vi.fn(),
    listPendingJoinRequests: vi.fn(),
    loginWithPassword: vi.fn(),
    signOut: vi.fn(),
    upgradeLegacyAnonymousUser: vi.fn(),
    submitJoinRequest: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
    createChannel: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    publishPost: vi.fn(),
    publishComment: vi.fn(),
    updateIdentity: vi.fn(),
    updateChannel: vi.fn(),
    updateChannelRoundState: vi.fn(),
    listRoundMemberStatuses: vi.fn(),
    resetChannelRoundProgress: vi.fn()
});

describe("channel settings dialog input stability", () => {
    let store;
    let actions;
    let root;
    let block;

    beforeEach(() => {
        store = createStore();
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: {
                    id: "channel-1",
                    slug: "channel",
                    name: "频道",
                    logoUrl: "logo",
                    backgroundUrl: "background"
                },
                realIdentity: { id: "identity-1", name: "管理员", avatar: "avatar", meta: "当前真实身份", role: "owner" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });
        actions = createAppActions({
            store,
            dataService: createMockDataService()
        });
        root = document.createElement("div");
        document.body.appendChild(root);
        block = mountChannelSettingsDialogBlock({ root, store, actions });

        store.dispatch({ type: "channel-settings/open" });
        block.render();
    });

    it("keeps the same input node when the first character enables save", () => {
        const before = root.querySelector("[data-ref='channel-name-input']");
        expect(before).toBeTruthy();

        store.dispatch({
            type: "channel-settings/set-field",
            payload: {
                draftName: "新"
            }
        });
        block.render();

        const after = root.querySelector("[data-ref='channel-name-input']");
        expect(after).toBe(before);
    });
});
