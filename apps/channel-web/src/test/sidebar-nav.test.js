import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountSidebarNavBlock } from "../blocks/sidebar-nav/index.js";
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
    resetChannelRoundProgress: vi.fn(),
    getArchivedRoundDetail: vi.fn(),
    loadCurrentRound: vi.fn(),
    listArchivedRounds: vi.fn(),
    archiveCurrentRound: vi.fn()
});

describe("sidebar nav account menu", () => {
    let store;
    let dataService;
    let actions;
    let root;
    let block;

    beforeEach(() => {
        document.body.innerHTML = "";
        store = createStore();
        dataService = createMockDataService();
        actions = createAppActions({
            store,
            dataService
        });

        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "member@example.com" },
                isAnonymous: false
            }
        });

        root = document.createElement("div");
        document.body.appendChild(root);
        block = mountSidebarNavBlock({ root, store, actions });
        block.render();
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("opens the account menu when clicking the identity footer", () => {
        const trigger = root.querySelector("[data-sidebar-action='toggle-account-menu']");
        expect(trigger).toBeTruthy();

        trigger.click();

        expect(store.getState().uiState.accountMenuOpen).toBe(true);
        block.render();
        expect(root.querySelector(".sidebar-nav__account-menu")).toBeTruthy();
    });

    it("shows a guest login trigger instead of a fake member identity", () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "guest",
                user: null,
                isAnonymous: false
            }
        });
        block.render();

        const loginTrigger = root.querySelector("[data-sidebar-action='login']");
        expect(loginTrigger).toBeTruthy();
        expect(root.textContent).toContain("未登录");
        expect(root.textContent).toContain("公开浏览模式");

        loginTrigger.click();

        expect(store.getState().overlayState.authGate.open).toBe(true);
        expect(store.getState().overlayState.authGate.mode).toBe("login");
    });

    it("renders homepage links in the brand and primary navigation", () => {
        const brandLink = root.querySelector(".sidebar-nav__brand-mark");
        const homeNavLink = root.querySelector(".sidebar-nav__link");
        const navLinks = root.querySelectorAll(".sidebar-nav__link");

        expect(brandLink?.getAttribute("href")).toBe("?");
        expect(homeNavLink?.getAttribute("href")).toBe("?");
        expect(homeNavLink?.textContent).toContain("返回主页");
        expect(navLinks).toHaveLength(1);
    });

    it("opens the search dialog from the sidebar search entry", async () => {
        dataService.listPosts.mockResolvedValue([{ id: "post-1", authorName: "云栖", text: "搜索结果", comments: [] }]);

        root.querySelector("[data-sidebar-action='search']")?.click();
        await Promise.resolve();

        expect(store.getState().overlayState.searchDialog.open).toBe(true);
        expect(dataService.listPosts).toHaveBeenCalledWith(null);
    });

    it("replaces the idle nav section with a real-channel CTA in demo mode", () => {
        store.dispatch({
            type: "runtime/preview-ready",
            payload: {
                channel: {
                    id: "demo-channel",
                    slug: "demo",
                    name: "品运一家人",
                    logoUrl: "demo-logo"
                }
            }
        });
        block.render();

        expect(root.textContent).toContain("准备正式参与？");
        expect(root.textContent).toContain("进入真实频道");
        expect(root.textContent).toContain("真实频道会使用正式账号和真实数据。");
        expect(root.textContent).not.toContain("试玩只是为了让你快速理解机制");
        expect(root.querySelector(".sidebar-nav__promo")).toBeTruthy();
    });

    it("renders round navigation and switches between current and archived rounds", async () => {
        dataService.getArchivedRoundDetail.mockResolvedValue({
            id: "archive-1",
            title: "2026.04.23 · 玄学测试",
            currentStage: "reveal",
            revealPairs: [],
            posts: []
        });
        dataService.listPosts.mockResolvedValue([]);

        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    id: "channel-1",
                    slug: "channel",
                    name: "品运一家人",
                    logoUrl: "channel-logo",
                    currentRoundId: "round-current",
                    currentRoundTheme: "解压",
                    currentRoundStartedAt: "2026-05-13T12:00:00.000Z"
                }
            }
        });
        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-1",
                    title: "玄学测试",
                    theme: "玄学测试",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    revealPairs: [],
                    stats: { pairCount: 0 }
                }]
            }
        });
        block.render();

        expect(root.textContent).toContain("游戏轮次");
        expect(root.textContent).toContain("2026.05.13 · 解压");
        expect(root.textContent).toContain("2026.04.23 · 玄学测试");

        root.querySelector("[data-sidebar-round-kind='archive']")?.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(store.getState().roundState.archiveViewerRoundId).toBe("archive-1");

        root.querySelector("[data-sidebar-round-kind='current']")?.click();
        await Promise.resolve();

        expect(store.getState().roundState.archiveViewerRoundId).toBeNull();
    });
});
