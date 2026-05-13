import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActionsHarness, seedApprovedViewer } from "../../test-support/actions-fixture.js";

describe("channel feature actions: round management", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        ({ store, dataService, actions } = createActionsHarness());
        seedApprovedViewer(store);
    });

    it("surfaces migration guidance when saving the round theme fails on an outdated database", async () => {
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                draftTheme: "新的主题"
            }
        });
        dataService.updateChannelRoundState.mockRejectedValue(
            new Error("频道轮次字段还没同步到数据库，请先应用最新 migration。")
        );

        await actions.saveRoundTheme();

        expect(store.getState().overlayState.toast.message).toBe("频道轮次字段还没同步到数据库，请先应用最新 migration。");
    });

    it("surfaces migration guidance when assigning the round god fails on an outdated database", async () => {
        dataService.updateChannelRoundState.mockRejectedValue(
            new Error("频道轮次字段还没同步到数据库，请先应用最新 migration。")
        );

        await actions.assignRoundGod({
            name: "海屿",
            avatar: "haiyu-avatar"
        });

        expect(store.getState().overlayState.toast.message).toBe("频道轮次字段还没同步到数据库，请先应用最新 migration。");
    });

    it("archives the completed round and starts a clean next round", async () => {
        const completedAt = "2026-04-23T12:00:00.000Z";
        store.dispatch({
            type: "round/set-current-round",
            payload: {
                round: {
                    id: "round-old",
                    lifecycleStatus: "active",
                    currentStage: "reveal",
                    theme: "玄学测试",
                    deadlines: {},
                    revealMap: {}
                }
            }
        });
        store.dispatch({
            type: "round/set-claim-selection",
            payload: {
                selection: {
                    postId: "post-1",
                    authorName: "海屿",
                    authorAvatar: "haiyu-avatar"
                }
            }
        });
        store.dispatch({
            type: "round/set-member-statuses",
            payload: {
                items: [{
                    name: "章鱼烧",
                    wishSubmitted: true,
                    claimSelected: true,
                    deliverySubmitted: true,
                    guessSubmitted: true,
                    revealReady: true
                }]
            }
        });
        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    currentRoundTheme: "玄学测试",
                    currentRoundStartedAt: "2026-04-20T12:00:00.000Z",
                    currentRevealMap: {
                        章鱼烧: {
                            member: { name: "章鱼烧", avatar: "octopus-avatar" },
                            angel: { name: "海屿", avatar: "haiyu-avatar" },
                            wishPreview: "希望有人帮我整理玄学学习目录",
                            guessedAngelName: "海屿",
                            guessedAngelAvatar: "haiyu-avatar"
                        }
                    }
                }
            }
        });
        dataService.updateChannelRoundState.mockResolvedValue({
            ...store.getState().runtimeState.channel,
            currentRoundStage: "reveal",
            currentRoundStatus: "archived",
            currentRoundCompletedAt: completedAt
        });
        dataService.archiveCurrentRound.mockResolvedValue({
            ...store.getState().runtimeState.channel,
            currentRoundId: "round-next",
            currentRoundTheme: "",
            currentRoundStage: "wish",
            currentRoundStatus: "active",
            currentRoundCompletedAt: null,
            currentRevealMap: {}
        });
        dataService.loadCurrentRound.mockResolvedValue({
            id: "round-next",
            lifecycleStatus: "active",
            archiveMode: null,
            currentStage: "wish",
            theme: "",
            deadlines: {},
            godProfile: null,
            revealMap: {},
            completedAt: null
        });
        dataService.listArchivedRounds.mockResolvedValue([{
            id: "channel:2026-04-20T12:00:00.000Z",
            title: "玄学测试",
            theme: "玄学测试",
            summaryLine: "玄学测试 · 1 对揭晓 · 2026-04-23",
            stage: "reveal",
            status: "archived",
            startedAt: "2026-04-20T12:00:00.000Z",
            completedAt,
            godProfile: store.getState().roundState.godProfile,
            stats: {
                totalMembers: 1,
                wishDone: 1,
                claimDone: 1,
                deliveryDone: 1,
                guessDone: 1,
                revealDone: 1,
                pairCount: 1
            },
            revealPairs: [{
                member: { name: "章鱼烧", avatar: "octopus-avatar" },
                angel: { name: "海屿", avatar: "haiyu-avatar" },
                wishPreview: "希望有人帮我整理玄学学习目录",
                guessedAngelName: "海屿",
                guessedAngelAvatar: "haiyu-avatar"
            }],
            createdAt: completedAt,
            savedBy: {
                name: "管理员",
                avatar: "avatar"
            }
        }]);
        dataService.listPosts.mockResolvedValue([]);

        await actions.completeRoundCycle();

        expect(dataService.archiveCurrentRound).toHaveBeenCalledWith({
            mode: "normal"
        });
        expect(store.getState().roundState.archives).toHaveLength(1);
        expect(store.getState().roundState.currentRoundId).toBe("round-next");
        expect(store.getState().roundState.activeStage).toBe("wish");
        expect(store.getState().roundState.claimSelection).toBeNull();
        expect(store.getState().feedState.activeBoard).toBe("wish");
        expect(store.getState().overlayState.toast.message).toBe("本轮已归档，新一轮已开始。");
    });

    it("uses archive-and-switch semantics when explicitly starting a new round", async () => {
        dataService.archiveCurrentRound.mockResolvedValue({
            ...store.getState().runtimeState.channel,
            currentRoundId: "round-next",
            currentRoundTheme: "",
            currentRoundStage: "wish",
            currentRoundStatus: "active",
            currentRoundCompletedAt: null,
            currentRevealMap: {}
        });
        dataService.loadCurrentRound.mockResolvedValue({
            id: "round-next",
            lifecycleStatus: "active",
            archiveMode: null,
            currentStage: "wish",
            theme: "",
            deadlines: {},
            godProfile: null,
            revealMap: {},
            completedAt: null
        });
        dataService.listArchivedRounds.mockResolvedValue([]);
        dataService.listPosts.mockResolvedValue([]);

        await actions.startRoundCycle();

        expect(dataService.archiveCurrentRound).toHaveBeenCalledWith({ mode: "normal" });
        expect(store.getState().roundState.currentRoundId).toBe("round-next");
        expect(store.getState().feedState.activeBoard).toBe("wish");
        expect(store.getState().overlayState.toast.message).toBe("上一轮已归档，当前已切到新一轮。");
    });

    it("deletes the selected archived round and closes the detail dialog", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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
                    revealPairs: []
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
        dataService.deleteArchivedRound.mockResolvedValue(undefined);
        dataService.listArchivedRounds.mockResolvedValue([]);

        await actions.deleteArchivedRound();

        expect(dataService.deleteArchivedRound).toHaveBeenCalledWith("archive-1");
        expect(store.getState().overlayState.channelIntelligence.archiveDetailOpen).toBe(false);
        expect(store.getState().overlayState.channelIntelligence.selectedArchiveId).toBeNull();
        expect(store.getState().roundState.archives).toHaveLength(0);
        expect(store.getState().overlayState.toast.message).toBe("往期回合记录已删除。");

        confirmSpy.mockRestore();
    });

    it("exports the selected archived round as a backup file", async () => {
        const originalCreateObjectUrl = URL.createObjectURL;
        const originalRevokeObjectUrl = URL.revokeObjectURL;
        URL.createObjectURL = vi.fn(() => "blob:archive-backup");
        URL.revokeObjectURL = vi.fn();
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    id: "channel-1",
                    slug: "channel",
                    name: "频道"
                }
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-1"
            }
        });
        dataService.getArchivedRoundDetail.mockResolvedValue({
            id: "archive-1",
            title: "玄学测试",
            theme: "玄学测试",
            completedAt: "2026-04-23T12:00:00.000Z",
            stats: {
                totalMembers: 3,
                guessDone: 2,
                pairCount: 1
            },
            revealPairs: [],
            posts: []
        });

        await actions.exportArchivedRound();

        expect(dataService.getArchivedRoundDetail).toHaveBeenCalledWith("archive-1");
        expect(clickSpy).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:archive-backup");
        expect(store.getState().overlayState.toast.message).toBe("往期回合备份已导出。");

        clickSpy.mockRestore();
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
    });
});
