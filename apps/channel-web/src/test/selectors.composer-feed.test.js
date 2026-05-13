import { describe, expect, it } from "vitest";
import { selectComposerPanelVM } from "../blocks/composer-panel/selectors.js";
import { selectFeedListVM } from "../blocks/feed-list/selectors.js";
import { createInitialState } from "../shared/state/store.js";

describe("channel view model selectors: composer/feed", () => {
    it("builds anonymous composer vm for approved members", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.feedState.activeBoard = "wish";
        state.composerState.draftText = "我觉得匿名内容";
        state.composerState.images = [{ id: 1, name: "cover.png", url: "blob:test" }];
        state.composerState.anonymousMode = true;
        state.composerState.anonymousTextRewrite = true;
        state.composerState.anonymousPreviewStatus = "ready";
        state.composerState.anonymousPreviewText = "更中性的看法是匿名内容";
        state.composerState.anonymousPreviewSourceText = "我觉得匿名内容";
        state.composerState.aiImageReshape = true;

        const vm = selectComposerPanelVM(state);

        expect(vm.canCompose).toBe(true);
        expect(vm.submitLabel).toBe("发布愿望");
        expect(vm.images).toHaveLength(1);
        expect(vm.anonymousTextRewrite).toBe(true);
        expect(vm.anonymousPreviewDisplayText).toBe("更中性的看法是匿名内容");
    });

    it("requires mention target during delivery stage", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.roundState.activeStage = "delivery";
        state.feedState.activeBoard = "delivery";
        state.composerState.draftText = "我已经准备好了";

        const vm = selectComposerPanelVM(state);

        expect(vm.stageInfo.label).toBe("交付");
        expect(vm.anonymousLocked).toBe(true);
        expect(vm.canSubmit).toBe(false);
    });

    it("allows audio-only drafts to submit and summarizes them correctly", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.roundState.activeStage = "guess";
        state.feedState.activeBoard = "guess";
        state.composerState.mentionTarget = {
            name: "健",
            avatar: "alias-avatar"
        };
        state.composerState.audioDraft = {
            id: 1,
            kind: "audio",
            name: "语音 1",
            url: "blob:voice"
        };

        const vm = selectComposerPanelVM(state);

        expect(vm.canSubmit).toBe(true);
        expect(vm.collapsedSummary).toBe("已录 1 条语音");
    });

    it("maps guest viewer into composer gate vm", () => {
        const state = createInitialState();
        state.authState.status = "guest";
        state.membershipState.status = "guest";

        const vm = selectComposerPanelVM(state);

        expect(vm.canCompose).toBe(false);
        expect(vm.gate.primaryAction).toBe("open-auth-login");
    });

    it("shows a direct join action instead of a syncing state for authenticated viewers without membership", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1", email: "member@example.com" };
        state.membershipState.status = "guest";
        state.runtimeState.channel = {
            id: "channel-1",
            slug: "channel",
            name: "频道",
            joinPolicy: "open"
        };

        const vm = selectComposerPanelVM(state);

        expect(vm.canCompose).toBe(false);
        expect(vm.gate.accessMode).toBe("join");
        expect(vm.gate.primaryAction).toBe("submit-join-request");
        expect(vm.gate.primaryLabel).toBe("重新进入频道");
    });

    it("keeps the syncing hint only during runtime hydration", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1", email: "member@example.com" };
        state.membershipState.status = "unknown";
        state.runtimeState.phase = "hydrating";

        const vm = selectComposerPanelVM(state);

        expect(vm.canCompose).toBe(false);
        expect(vm.gate.accessMode).toBe("syncing");
    });

    it("falls back to a rejoin action after hydration if membership never resolved", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1", email: "member@example.com" };
        state.membershipState.status = "unknown";
        state.runtimeState.phase = "ready";
        state.runtimeState.channel = {
            id: "channel-1",
            slug: "channel",
            name: "频道",
            joinPolicy: "open"
        };

        const vm = selectComposerPanelVM(state);

        expect(vm.canCompose).toBe(false);
        expect(vm.gate.accessMode).toBe("join");
        expect(vm.gate.primaryLabel).toBe("重新进入频道");
    });

    it("maps feed state into empty and ready states", () => {
        const emptyState = createInitialState();
        emptyState.feedState.status = "empty";
        const emptyVm = selectFeedListVM(emptyState);
        expect(emptyVm.status).toBe("empty");
        expect(emptyVm.stageHeader.title).toBe("闲聊板块");

        const readyState = createInitialState();
        readyState.feedState.status = "ready";
        readyState.feedState.activeBoard = "claim";
        readyState.roundState.activeStage = "claim";
        readyState.feedState.items = [{ id: "1", comments: [] }];
        const readyVm = selectFeedListVM(readyState);
        expect(readyVm.items).toHaveLength(1);
        expect(readyVm.stageHeader.title).toBe("选愿望阶段");
    });

    it("shows reveal results whenever the reveal board is active", () => {
        const state = createInitialState();
        state.roundState.activeStage = "wish";
        state.feedState.activeBoard = "reveal";
        state.roundState.revealMap = {
            章鱼烧: {
                member: { name: "章鱼烧", avatar: "octopus-avatar" },
                angel: { name: "海屿", avatar: "haiyu-avatar" },
                wishPreview: "希望有人帮我整理本周重点",
                guessedAngelName: "白榆",
                guessedAngelAvatar: "baiyu-avatar"
            }
        };

        const vm = selectFeedListVM(state);
        expect(vm.mode).toBe("reveal-results");
        expect(vm.revealPairs).toHaveLength(1);
    });

    it("marks liked posts in feed vm", () => {
        const state = createInitialState();
        state.feedState.status = "ready";
        state.feedState.items = [{ id: "1", authorName: "云栖", text: "test", comments: [], likes: 3 }];
        state.feedState.likedPostIds = ["1"];

        const vm = selectFeedListVM(state);
        expect(vm.items[0].isLiked).toBe(true);
    });

    it("exposes claim actions when browsing the claim board", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-1" };
        state.membershipState.status = "approved";
        state.roundState.activeStage = "claim";
        state.feedState.activeBoard = "claim";
        state.feedState.status = "ready";
        state.feedState.items = [{
            id: "wish-1",
            board: "wish",
            authorName: "白榆",
            authorAvatar: "alias-avatar",
            authorUserId: "user-2",
            text: "希望有人帮我整理目录",
            comments: []
        }];

        const vm = selectFeedListVM(state);
        expect(vm.items[0].canClaimWish).toBe(true);
        expect(vm.items[0].claimActionLabel).toBe("选这个愿望");
    });

    it("builds free chat composer vm for the all board without inheriting stale mention targets", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.feedState.activeBoard = "all";
        state.roundState.activeStage = "delivery";
        state.composerState.mentionTarget = {
            name: "雯子",
            avatar: "alias-avatar"
        };
        state.composerState.draftText = "这里单独聊";

        const vm = selectComposerPanelVM(state);

        expect(vm.stageInfo.label).toBe("闲聊");
        expect(vm.submitLabel).toBe("发布闲聊");
        expect(vm.mentionTarget).toBe(null);
        expect(vm.anonymousLocked).toBe(false);
    });

    it("limits guess candidates to members who submitted a wish", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.roundState.activeStage = "guess";
        state.feedState.activeBoard = "guess";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            id: "identity-1",
            name: "章鱼烧",
            avatar: "octopus-avatar"
        };
        state.roundState.memberStatuses = [
            { identityId: "identity-1", name: "章鱼烧", avatar: "octopus-avatar", wishSubmitted: true },
            { identityId: "identity-2", name: "测试账号", avatar: "test-avatar", wishSubmitted: true },
            { identityId: "identity-3", name: "CodexRPC", avatar: "rpc-avatar", wishSubmitted: false }
        ];

        const feedVm = selectFeedListVM(state);
        const composerVm = selectComposerPanelVM(state);

        expect(feedVm.candidates.some((member) => member.name === "测试账号")).toBe(true);
        expect(feedVm.candidates.some((member) => member.name === "章鱼烧")).toBe(false);
        expect(feedVm.candidates.some((member) => member.name === "CodexRPC")).toBe(false);
        expect(composerVm.mentionMembers.some((member) => member.name === "测试账号")).toBe(true);
        expect(composerVm.mentionMembers.some((member) => member.name === "章鱼烧")).toBe(false);
        expect(composerVm.mentionMembers.some((member) => member.name === "CodexRPC")).toBe(false);
    });

    it("renders reveal results in the composer panel", () => {
        const state = createInitialState();
        state.roundState.activeStage = "reveal";
        state.feedState.activeBoard = "reveal";
        state.authState.status = "authenticated";
        state.membershipState.status = "approved";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            name: "章鱼烧",
            avatar: "octopus-avatar"
        };
        state.roundState.revealMap = {
            章鱼烧: {
                member: { name: "章鱼烧", avatar: "octopus-avatar" },
                angel: { name: "海屿", avatar: "haiyu-avatar" },
                wishPreview: "希望有人帮我把本周输出整理成一个清楚的执行清单。",
                guessedAngelName: "白榆",
                guessedAngelAvatar: "baiyu-avatar"
            }
        };

        const vm = selectComposerPanelVM(state);

        expect(vm.revealResult?.guessedName).toBe("白榆");
        expect(vm.revealResult?.actualName).toBe("海屿");
        expect(vm.revealPairs).toHaveLength(1);
    });

    it("exposes proxy wish controls to the current god during wish stage", () => {
        const state = createInitialState();
        state.authState.status = "authenticated";
        state.authState.user = { id: "user-god" };
        state.membershipState.status = "approved";
        state.roundState.activeStage = "wish";
        state.feedState.activeBoard = "wish";
        state.runtimeState.realIdentity = {
            ...state.runtimeState.realIdentity,
            id: "identity-god",
            name: "章鱼烧",
            avatar: "octopus-avatar",
            role: "member"
        };
        state.roundState.godProfile = {
            userId: "user-god",
            name: "章鱼烧",
            avatar: "octopus-avatar"
        };
        state.roundState.memberStatuses = [
            { identityId: "identity-god", userId: "user-god", name: "章鱼烧", avatar: "octopus-avatar", wishSubmitted: true },
            { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", wishSubmitted: false }
        ];

        const vm = selectComposerPanelVM(state);

        expect(vm.canProxyWish).toBe(true);
        expect(vm.proxyWishMembers).toEqual([{
            identityId: "identity-2",
            userId: "user-2",
            name: "测试账号",
            avatar: "test-avatar"
        }]);
    });
});
