import { describe, expect, it, vi } from "vitest";
import { mountChannelIntelligenceBlock } from "../blocks/channel-intelligence/index.js";
import { createStore } from "../shared/state/store.js";

const createActions = () => ({
    openOverlay: vi.fn(),
    closeOverlay: vi.fn(),
    toggleRoundGodPicker: vi.fn(),
    assignRoundGod: vi.fn(),
    toggleRoundThemeEditor: vi.fn(),
    cancelRoundThemeEditing: vi.fn(),
    setRoundThemeDraft: vi.fn(),
    saveRoundTheme: vi.fn(),
    toggleRoundDeadlineEditor: vi.fn(),
    cancelRoundDeadlineEditing: vi.fn(),
    setRoundDeadlineDraft: vi.fn(),
    saveRoundDeadlines: vi.fn(),
    renameCurrentRound: vi.fn(),
    toggleRoundRevealEditor: vi.fn(),
    generateRoundRevealResults: vi.fn(),
    toggleRoundRevealMemberPicker: vi.fn(),
    toggleRoundRevealAngelPicker: vi.fn(),
    chooseRoundRevealMember: vi.fn(),
    chooseRoundRevealAngel: vi.fn(),
    saveRoundRevealPair: vi.fn(),
    selectRoundArchive: vi.fn(),
    closeArchiveDetail: vi.fn(),
    viewSelectedArchiveInBoard: vi.fn(),
    restoreArchivedRound: vi.fn(),
    renameArchivedRound: vi.fn(),
    exportArchivedRound: vi.fn(),
    deleteArchivedRound: vi.fn(),
    exitArchiveViewer: vi.fn()
});

describe("channel intelligence block", () => {
    it("preserves theme input focus across rerenders", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "round-management/set-field",
            payload: {
                themeEditorOpen: true,
                draftTheme: "A"
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        const themeInput = root.querySelector("[data-channel-intelligence-ref='theme-input']");
        themeInput.focus();
        themeInput.value = "AI";
        themeInput.setSelectionRange(2, 2);

        store.dispatch({
            type: "round-management/set-field",
            payload: { draftTheme: "AI" }
        });
        block.render();

        const nextThemeInput = root.querySelector("[data-channel-intelligence-ref='theme-input']");
        expect(document.activeElement).toBe(nextThemeInput);
        expect(nextThemeInput.value).toBe("AI");
        expect(nextThemeInput.selectionStart).toBe(2);
        expect(nextThemeInput.selectionEnd).toBe(2);

        root.remove();
        dialogRoot.remove();
    });

    it("renders the richer round panel content in the sidebar", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("当前回合");
        expect(root.textContent).toContain("改轮次名");
        expect(root.textContent).not.toContain("国王与天使");
        expect(root.textContent).toContain("本周上帝");
        expect(root.textContent).toContain("指定上帝");
        expect(root.textContent).toContain("当前阶段");
        expect(root.textContent).toContain("我的待办");
        expect(root.textContent).not.toContain("进入回合管理");

        root.remove();
        dialogRoot.remove();
    });

    it("wires the current round rename action", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "runtime/update-identity",
            payload: {
                identity: {
                    role: "owner"
                }
            }
        });
        store.dispatch({
            type: "round/set-current-round",
            payload: {
                round: {
                    id: "round-1",
                    lifecycleStatus: "active",
                    title: "2026.05.13 · 解压",
                    defaultTitle: "2026.05.13 · 解压",
                    theme: "解压",
                    currentStage: "wish",
                    deadlines: {},
                    revealMap: {}
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        root.querySelector("[data-channel-intelligence-action='rename-current-round']")?.click();
        expect(actions.renameCurrentRound).toHaveBeenCalledTimes(1);

        root.remove();
        dialogRoot.remove();
    });

    it("shows reveal summary inline when reveal results exist", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    currentRoundStage: "reveal",
                    currentRevealMap: {
                        章鱼烧: {
                            member: { name: "章鱼烧", avatar: "octopus-avatar" },
                            angel: { name: "海屿", avatar: "haiyu-avatar" },
                            guessedAngelName: "海屿"
                        }
                    }
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("揭晓结果");
        expect(root.textContent).toContain("已生成 1 对揭晓结果");

        root.remove();
        dialogRoot.remove();
    });

    it("renders archived rounds and lets the user switch the selected archive", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-1",
                    title: "玄学测试",
                    theme: "玄学测试",
                    summaryLine: "玄学测试 · 1 对揭晓 · 2026-04-23",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    godProfile: { name: "海屿", avatar: "haiyu-avatar" },
                    stats: {
                        totalMembers: 3,
                        guessDone: 3,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }]
                }]
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-1"
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("往期回合");
        expect(root.textContent).toContain("玄学测试");
        expect(root.textContent).toContain("1 对揭晓");
        expect(root.textContent).not.toContain("2026.04.23 · 玄学测试");
        expect(root.textContent).not.toContain("希望有人帮我整理玄学学习目录");

        root.querySelector("[data-channel-intelligence-archive='archive-1']").click();
        expect(actions.selectRoundArchive).toHaveBeenCalledWith("archive-1");

        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                archiveDetailOpen: true
            }
        });
        block.render();

        expect(dialogRoot.querySelector("[data-channel-intelligence-dialog='archive-detail']")).not.toBeNull();
        expect(dialogRoot.textContent).toContain("希望有人帮我整理玄学学习目录");
        expect(dialogRoot.textContent).toContain("删除记录");
        expect(dialogRoot.textContent).toContain("导出备份");

        root.remove();
        dialogRoot.remove();
    });

    it("uses the same primary archive title style as the left round navigation", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-2",
                    title: "2026.04.23 · 解压",
                    defaultTitle: "2026.04.23 · 解压",
                    theme: "解压",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: { pairCount: 0 },
                    revealPairs: []
                }]
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("解压");
        expect(root.textContent).not.toContain("2026.04.23 · 解压");

        root.remove();
        dialogRoot.remove();
    });

    it("opens the wish deadline editor when clicking the deadline action", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "runtime/update-identity",
            payload: {
                identity: {
                    role: "owner"
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        root.querySelector("[data-channel-intelligence-action='toggle-deadline-editor']")?.click();
        expect(actions.toggleRoundDeadlineEditor).toHaveBeenCalledTimes(1);

        store.dispatch({
            type: "round-management/set-field",
            payload: {
                deadlineEditorOpen: true,
                draftDeadlines: {
                    wish: {
                        deadlineAt: "2026-05-13T14:00:00.000Z"
                    }
                }
            }
        });
        block.render();

        expect(root.querySelector("[data-channel-intelligence-ref='wish-deadline-input']")).toBeTruthy();

        root.remove();
        dialogRoot.remove();
    });

    it("wires archive detail actions through the dialog root", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createActions();

        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-1",
                    title: "玄学测试",
                    theme: "玄学测试",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: {
                        totalMembers: 3,
                        guessDone: 2,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }]
                }]
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-1",
                archiveDetailOpen: true
            }
        });
        store.dispatch({
            type: "round/set-archive-viewer",
            payload: {
                roundId: null,
                detail: {
                    id: "archive-1",
                    title: "玄学测试",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: {
                        totalMembers: 3,
                        guessDone: 2,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }],
                    posts: []
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        dialogRoot.querySelector("[data-channel-intelligence-action='delete-archive']").click();
        expect(actions.deleteArchivedRound).toHaveBeenCalled();
        dialogRoot.querySelector("[data-channel-intelligence-action='export-archive']").click();
        expect(actions.exportArchivedRound).toHaveBeenCalled();

        root.remove();
        dialogRoot.remove();
    });
});
