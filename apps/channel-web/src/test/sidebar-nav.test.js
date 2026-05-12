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
    resetChannelRoundProgress: vi.fn()
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
});
