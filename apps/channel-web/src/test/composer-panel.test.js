import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountComposerPanelBlock } from "../blocks/composer-panel/index.js";
import { createAppActions } from "../features/app-actions.js";
import { createStore } from "../shared/state/store.js";

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
    createAliasProfile: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    likePost: vi.fn(),
    publishPost: vi.fn(),
    publishComment: vi.fn(),
    updateIdentity: vi.fn(),
    updateChannel: vi.fn(),
    listChannelGuessSelections: vi.fn(),
    listRoundMemberStatuses: vi.fn(),
    saveGuessSelection: vi.fn(),
    clearGuessSelection: vi.fn(),
    anonymizeAnonymousDraft: vi.fn(),
    updateChannelRoundState: vi.fn(),
    resetChannelRoundProgress: vi.fn()
});

describe("composer panel interactions", () => {
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
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-1", name: "章鱼烧", avatar: "avatar", meta: "当前真实身份", role: "member" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });

        root = document.createElement("div");
        document.body.appendChild(root);
        block = mountComposerPanelBlock({ root, store, actions });
    });

    it("hides the inline composer during guess stage", () => {
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "guess", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "guess" }
        });
        block.render();

        expect(root.querySelector(".composer-panel--hidden")).toBeTruthy();
        expect(root.querySelector("[data-composer-action='toggle-anonymous']")).toBeNull();
    });

    it("does not render the AI disclosure button during guess stage", () => {
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "guess", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "guess" }
        });
        block.render();
        expect(root.querySelector("[data-composer-action='toggle-ai-disclosure']")).toBeNull();
    });

    it("hides the inline composer while browsing the guess board even after the round has moved on", () => {
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "reveal", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "guess" }
        });
        block.render();

        expect(root.querySelector(".composer-panel--hidden")).toBeTruthy();
    });

    it("shows a direct login action for guests", () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "guest",
                user: null,
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "guest",
                joinRequest: null,
                reviewItems: []
            }
        });

        block.render();

        const loginButton = root.querySelector("[data-composer-action='open-auth-login']");
        expect(loginButton).toBeTruthy();
        expect(root.textContent).toContain("邮箱登录");
        expect(root.querySelector(".composer-panel__avatar")?.getAttribute("alt")).toBe("未登录");

        loginButton.click();

        expect(store.getState().overlayState.authGate.open).toBe(true);
        expect(store.getState().overlayState.authGate.mode).toBe("login");
    });

    it("locks the delivery target to the selected wish instead of exposing a mention picker", () => {
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "delivery", forceAnonymous: true }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "delivery" }
        });
        store.dispatch({
            type: "round/set-claim-selection",
            payload: {
                selection: {
                    postId: "wish-1",
                    authorName: "雯子",
                    authorAvatar: "alias-avatar",
                    previewText: "帮我看一下这个月的运势"
                }
            }
        });
        actions.expandComposer();
        block.render();

        const mentionToggle = root.querySelector("[data-composer-action='toggle-mention']");
        expect(mentionToggle).toBeNull();
        expect(root.textContent).toContain("To");
        expect(root.textContent).toContain("雯子");
        expect(root.querySelector("[data-composer-action='clear-mention']")).toBeNull();
    });

    it("shows the delivery target in the collapsed composer before expanding", () => {
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "delivery", forceAnonymous: true }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "delivery" }
        });
        store.dispatch({
            type: "round/set-claim-selection",
            payload: {
                selection: {
                    postId: "wish-1",
                    authorName: "雯子",
                    authorAvatar: "alias-avatar",
                    previewText: "帮我看一下这个月的运势"
                }
            }
        });
        block.render();

        const collapsedChip = root.querySelector(".composer-panel__mention-chip--collapsed");
        expect(collapsedChip).toBeTruthy();
        expect(collapsedChip?.textContent).toContain("To");
        expect(collapsedChip?.textContent).toContain("雯子");
    });

    it("renders reveal results in the main composer area", () => {
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "reveal" }
        });
        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    currentRoundStage: "reveal",
                    currentRevealMap: {
                        章鱼烧: {
                            member: { name: "章鱼烧", avatar: "avatar" },
                            angel: { name: "海屿", avatar: "haiyu-avatar" },
                            wishPreview: "希望有人帮我把这轮发散的想法整理成可执行清单。",
                            guessedAngelName: "白榆",
                            guessedAngelAvatar: "baiyu-avatar"
                        },
                        苹果: {
                            member: { name: "苹果", avatar: "apple-avatar" },
                            angel: { name: "白榆", avatar: "baiyu-avatar" },
                            wishPreview: "",
                            guessedAngelName: "",
                            guessedAngelAvatar: ""
                        }
                    }
                }
            }
        });

        block.render();

        expect(root.textContent).toContain("我的揭晓结果");
        expect(root.textContent).toContain("白榆");
        expect(root.textContent).toContain("海屿");
        expect(root.textContent).not.toContain("这位国王的愿望");
    });

    it("shows AI text preview controls in anonymous mode and removes the auto-rotate toggle", () => {
        store.dispatch({
            type: "composer/toggle-anonymous"
        });
        store.dispatch({
            type: "composer/expand"
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "我觉得我来试试",
                anonymousTextRewrite: true,
                anonymousPreviewStatus: "ready",
                anonymousPreviewText: "更中性的看法是这边来试试",
                anonymousPreviewSourceText: "我觉得我来试试"
            }
        });

        block.render();

        expect(root.textContent).toContain("AI 润色文本");
        expect(root.textContent).toContain("AI 润色预览");
        expect(root.textContent).toContain("更中性的看法是这边来试试");
        expect(root.textContent).not.toContain("发完自动换马甲");
    });
});
