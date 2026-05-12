import { describe, expect, it } from "vitest";
import { selectChannelIntelligenceVM } from "../blocks/channel-intelligence/selectors.js";
import { createInitialState } from "../shared/state/store.js";

describe("channel view model selectors: channel intelligence", () => {
    it("does not expose reveal summary before the reveal stage", () => {
        const state = createInitialState();
        state.roundState.activeStage = "wish";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            name: "章鱼烧",
            avatar: "octopus-avatar"
        };
        state.roundState.revealMap = {
            章鱼烧: {
                member: { name: "章鱼烧", avatar: "octopus-avatar" },
                angel: { name: "海屿", avatar: "haiyu-avatar" }
            }
        };

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.showRevealSummary).toBe(false);
    });

    it("builds round task summary for channel intelligence", () => {
        const state = createInitialState();
        state.roundState.activeStage = "delivery";

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.currentStageLabel).toBe("交付");
        expect(vm.currentTaskStatus).toBe("待完成");
    });

    it("follows the selected board for task stage summary", () => {
        const state = createInitialState();
        state.roundState.activeStage = "delivery";
        state.feedState.activeBoard = "claim";

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.currentTaskStageLabel).toBe("选愿望");
        expect(vm.currentTaskStatus).toBe("待完成");
    });

    it("marks delivery stage as done when the current user already posted in delivery", () => {
        const state = createInitialState();
        state.roundState.activeStage = "delivery";
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1" };
        state.feedState.items = [
            {
                id: "delivery-1",
                board: "delivery",
                authorUserId: "user-1",
                authorName: "白榆",
                authorAvatar: "avatar",
                isDeleted: false,
                comments: []
            }
        ];

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.currentTaskStatus).toBe("已完成");
    });

    it("does not treat seeded imported wish posts as the current member's own wish", () => {
        const state = createInitialState();
        state.roundState.activeStage = "wish";
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-owner" };
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            id: "identity-current",
            name: "章鱼烧"
        };
        state.feedState.items = [
            {
                id: "wish-seeded-1",
                board: "wish",
                aliasKey: "wish-wenzi",
                authorUserId: "user-owner",
                authorName: "雯子",
                authorAvatar: "seed-avatar",
                isAnonymous: true,
                isDeleted: false,
                adminRevealIdentity: {
                    id: "identity-owner",
                    name: "Yuchao",
                    avatar: "owner-avatar",
                    role: "owner"
                },
                comments: []
            }
        ];

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.currentTaskStatus).toBe("待完成");
    });

    it("builds reveal result and reveal pairs for channel intelligence", () => {
        const state = createInitialState();
        state.roundState.activeStage = "reveal";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            name: "章鱼烧",
            avatar: "octopus-avatar",
            role: "owner"
        };
        state.roundState.guessSelection = {
            name: "海屿",
            avatar: "haiyu-avatar"
        };
        state.roundState.revealMap = {
            章鱼烧: {
                member: {
                    name: "章鱼烧",
                    avatar: "octopus-avatar"
                },
                angel: {
                    name: "海屿",
                    avatar: "haiyu-avatar"
                }
            }
        };

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.currentTaskStatus).toBe("已完成");
        expect(vm.revealPairs).toHaveLength(1);
        expect(vm.revealResult?.actualName).toBe("海屿");
    });

    it("includes synced channel members in the god picker", () => {
        const state = createInitialState();
        state.membershipState.status = "approved";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            id: "identity-1",
            name: "章鱼烧",
            avatar: "octopus-avatar",
            role: "owner"
        };
        state.roundState.memberStatuses = [
            { identityId: "identity-1", name: "章鱼烧", avatar: "octopus-avatar" },
            { identityId: "identity-2", name: "测试账号", avatar: "test-avatar" }
        ];

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.godOptions.some((member) => member.name === "测试账号")).toBe(true);
    });

    it("selects the active archived round for the detail dialog", () => {
        const state = createInitialState();
        state.roundState.archives = [{
            id: "archive-1",
            title: "玄学测试",
            theme: "玄学测试",
            completedAt: "2026-04-23T12:00:00.000Z",
            godProfile: { name: "海屿", avatar: "haiyu-avatar" },
            stats: {
                totalMembers: 3,
                pairCount: 1
            },
            revealPairs: [{
                member: { name: "章鱼烧", avatar: "octopus-avatar" },
                angel: { name: "海屿", avatar: "haiyu-avatar" },
                wishPreview: "希望有人帮我整理玄学学习目录",
                guessedAngelName: "海屿"
            }]
        }];
        state.overlayState.channelIntelligence.selectedArchiveId = "archive-1";

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.archives).toHaveLength(1);
        expect(vm.selectedArchive?.id).toBe("archive-1");
        expect(vm.archiveDialogArchive?.id).toBe("archive-1");
        expect(vm.selectedArchive?.metaLine).toContain("1 对揭晓");
    });

    it("does not auto-select an archived round before the user opens it", () => {
        const state = createInitialState();
        state.roundState.archives = [{
            id: "archive-1",
            title: "玄学测试",
            completedAt: "2026-04-23T12:00:00.000Z",
            stats: { pairCount: 1 }
        }];

        const vm = selectChannelIntelligenceVM(state);
        expect(vm.selectedArchive).toBeNull();
        expect(vm.archiveDialogArchive).toBeNull();
        expect(vm.archives[0].isSelected).toBe(false);
    });
});
