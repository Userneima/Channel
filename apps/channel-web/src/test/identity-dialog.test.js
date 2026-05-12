import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountIdentityDialogBlock } from "../blocks/identity-dialog/index.js";
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

describe("identity dialog input stability", () => {
    let store;
    let actions;
    let root;
    let block;

    beforeEach(() => {
        store = createStore();
        actions = createAppActions({
            store,
            dataService: createMockDataService()
        });
        root = document.createElement("div");
        document.body.appendChild(root);
        block = mountIdentityDialogBlock({ root, store, actions });

        store.dispatch({ type: "identity/open" });
        block.render();
    });

    it("keeps the same input node when the first character enables save", () => {
        const before = root.querySelector("[data-ref='identity-name-input']");
        expect(before).toBeTruthy();

        store.dispatch({
            type: "identity/set-field",
            payload: {
                draftName: "阿"
            }
        });
        block.render();

        const after = root.querySelector("[data-ref='identity-name-input']");
        expect(after).toBe(before);
    });
});
