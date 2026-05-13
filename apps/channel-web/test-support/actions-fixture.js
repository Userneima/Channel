import { vi } from "vitest";
import { createAppActions } from "../src/features/app-actions.js";
import { createStore } from "../src/shared/state/store.js";

export const createMockDataService = () => ({
    getAuthState: vi.fn(),
    getChannelShell: vi.fn(),
    getCachedChannelBootstrap: vi.fn(),
    getCachedPosts: vi.fn(),
    getCachedPost: vi.fn(),
    loadChannelBootstrap: vi.fn(),
    loadPublicChannelPreview: vi.fn(),
    loadMembershipState: vi.fn(),
    loadApprovedMemberRuntime: vi.fn(),
    listPendingJoinRequests: vi.fn(),
    listChannelMembers: vi.fn(),
    listRegisteredUsers: vi.fn(),
    loginWithPassword: vi.fn(),
    registerWithPassword: vi.fn(),
    upgradeLegacyAnonymousUser: vi.fn(),
    signOut: vi.fn(),
    submitJoinRequest: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
    setChannelMemberRole: vi.fn(),
    removeChannelMember: vi.fn(),
    createChannel: vi.fn(),
    createAliasProfile: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    likePost: vi.fn(),
    likeComment: vi.fn(),
    deletePost: vi.fn(),
    deleteComment: vi.fn(),
    publishPost: vi.fn(),
    publishComment: vi.fn(),
    updateIdentity: vi.fn(),
    updateChannel: vi.fn(),
    updateChannelRoundState: vi.fn(),
    resetChannelRoundProgress: vi.fn(),
    loadCurrentRound: vi.fn(),
    listArchivedRounds: vi.fn(),
    getArchivedRoundDetail: vi.fn(),
    archiveCurrentRound: vi.fn(),
    restoreArchivedRound: vi.fn(),
    renameArchivedRound: vi.fn(),
    deleteArchivedRound: vi.fn(),
    listRoundArchives: vi.fn(),
    saveRoundArchive: vi.fn(),
    listRoundMemberStatuses: vi.fn(),
    listChannelGuessSelections: vi.fn(),
    saveClaimSelection: vi.fn(),
    clearClaimSelection: vi.fn(),
    saveGuessSelection: vi.fn(),
    clearGuessSelection: vi.fn(),
    anonymizeAnonymousDraft: vi.fn()
});

export const approvedRuntime = {
    channel: {
        id: "channel-1",
        slug: "channel",
        name: "频道",
        previewVisibility: "public",
        joinPolicy: "approval_required",
        currentRoundTheme: "旧主题",
        currentRoundStage: "wish",
        currentRoundStatus: "active",
        currentRoundDeadlines: {},
        currentRoundGodProfile: {
            name: "管理员",
            avatar: "avatar"
        }
    },
    realIdentity: { id: "identity-1", name: "管理员", avatar: "avatar", meta: "当前真实身份", role: "owner" },
    anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }]
};

export const seedApprovedViewer = (store) => {
    store.dispatch({
        type: "auth/set-state",
        payload: {
            status: "authenticated",
            user: { id: "user-1", email: "member@example.com" },
            isAnonymous: false
        }
    });
    store.dispatch({
        type: "membership/set-state",
        payload: {
            status: "approved",
            joinRequest: null,
            reviewItems: []
        }
    });
    store.dispatch({
        type: "runtime/member-ready",
        payload: approvedRuntime
    });
};

export const createActionsHarness = () => {
    window.history.replaceState({}, "", "/");
    const store = createStore();
    const dataService = createMockDataService();
    dataService.getChannelShell.mockReturnValue(approvedRuntime.channel);
    dataService.getCachedChannelBootstrap.mockResolvedValue(null);
    dataService.getCachedPosts.mockReturnValue([]);
    dataService.getCachedPost.mockReturnValue(null);
    dataService.loadCurrentRound.mockResolvedValue(null);
    dataService.listRoundMemberStatuses.mockResolvedValue([]);
    dataService.listArchivedRounds.mockResolvedValue([]);
    dataService.listRoundArchives.mockResolvedValue([]);
    dataService.listChannelMembers.mockResolvedValue([]);
    dataService.createAliasProfile.mockImplementation(async (activeAliasKey, nextProfile) => ({
        profiles: [{
            id: "alias-1",
            key: activeAliasKey,
            name: nextProfile.name,
            avatar: nextProfile.avatar
        }],
        activeAliasKey
    }));
    const actions = createAppActions({ store, dataService });

    return {
        store,
        dataService,
        actions
    };
};
