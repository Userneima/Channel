import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActionsHarness, seedApprovedViewer } from "../../test-support/actions-fixture.js";

describe("channel feature actions: composer/round", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        ({ store, dataService, actions } = createActionsHarness());
    });

    it("opens auth gate instead of posting for guests", async () => {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "guest",
                user: null,
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "guest draft"
            }
        });

        await actions.submitPost();

        expect(store.getState().overlayState.authGate.open).toBe(true);
        expect(dataService.publishPost).not.toHaveBeenCalled();
    });

    it("submits audio clips as post media", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "guess", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "guess" }
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                mentionTarget: {
                    name: "海屿",
                    avatar: "haiyu-avatar"
                },
                audioDraft: {
                    id: 1,
                    kind: "audio",
                    name: "语音 1",
                    url: "blob:voice-draft",
                    mimeType: "audio/webm"
                }
            }
        });
        dataService.publishPost.mockResolvedValue({
            id: "post-audio-1",
            board: "guess",
            comments: []
        });
        dataService.saveGuessSelection.mockResolvedValue({
            name: "海屿",
            avatar: "haiyu-avatar",
            selectedAt: "2026-04-21T12:00:00.000Z"
        });
        dataService.listPosts.mockResolvedValue([]);

        const fetchMock = vi.fn().mockResolvedValue({
            blob: async () => new Blob(["voice"], { type: "audio/webm" })
        });
        vi.stubGlobal("fetch", fetchMock);

        try {
            await actions.submitPost();
        } finally {
            vi.unstubAllGlobals();
        }

        expect(dataService.publishPost).toHaveBeenCalledWith(expect.objectContaining({
            body: "@海屿",
            media: [expect.objectContaining({ kind: "audio" })]
        }));
        expect(store.getState().composerState.audioDraft).toBe(null);
    });

    it("submits anonymous posts with alias author payload", async () => {
        seedApprovedViewer(store);
        store.dispatch({ type: "composer/toggle-anonymous" });
        store.dispatch({
            type: "composer/set-field",
            payload: { draftText: "我觉得匿名内容" }
        });
        dataService.publishPost.mockResolvedValue({ id: "post-1", board: "none" });
        dataService.listPosts.mockResolvedValue([{ id: "post-1", comments: [] }]);

        await actions.submitPost();

        expect(dataService.publishPost).toHaveBeenCalledWith(expect.objectContaining({
            body: "我觉得匿名内容",
            author: { type: "alias_session", key: "slot-baiyu" }
        }));
        expect(dataService.createAliasProfile).toHaveBeenCalledTimes(1);
        expect(store.getState().composerState.expanded).toBe(false);
    });

    it("uses the AI rewrite preview as the final anonymous text when the toggle is enabled", async () => {
        seedApprovedViewer(store);
        store.dispatch({ type: "composer/toggle-anonymous" });
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
        dataService.publishPost.mockResolvedValue({ id: "post-ai-1", board: "none" });
        dataService.listPosts.mockResolvedValue([{ id: "post-ai-1", comments: [] }]);

        await actions.submitPost();

        expect(dataService.publishPost).toHaveBeenCalledWith(expect.objectContaining({
            body: "更中性的看法是这边来试试",
            author: { type: "alias_session", key: "slot-baiyu" }
        }));
    });

    it("submits free chat posts into the all board without carrying a stale delivery target", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "delivery", forceAnonymous: true }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "all" }
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "这里单独闲聊",
                mentionTarget: {
                    name: "小灰灰",
                    avatar: "avatar-1"
                },
                anonymousMode: false
            }
        });
        dataService.publishPost.mockResolvedValue({ id: "chat-1", board: "all", comments: [] });
        dataService.listPosts.mockResolvedValue([{ id: "chat-1", board: "all", comments: [] }]);

        await actions.submitPost();

        expect(dataService.publishPost).toHaveBeenCalledWith(expect.objectContaining({
            body: "这里单独闲聊",
            boardSlug: "all",
            author: { type: "identity" }
        }));
        expect(dataService.saveGuessSelection).not.toHaveBeenCalled();
        expect(store.getState().roundState.progress.wishSubmitted).toBe(false);
        expect(store.getState().roundState.progress.deliverySubmitted).toBe(false);
        expect(store.getState().roundState.progress.guessSubmitted).toBe(false);
    });

    it("prepends selected mention target when submitting a post", async () => {
        seedApprovedViewer(store);
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
                    authorName: "小灰灰",
                    authorAvatar: "avatar-1",
                    previewText: "这条愿望我来完成"
                }
            }
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "这条愿望我来完成",
                mentionTarget: { name: "小灰灰", avatar: "avatar-1" }
            }
        });
        dataService.publishPost.mockResolvedValue({ id: "post-1", board: "none" });
        dataService.listPosts.mockResolvedValue([{ id: "post-1", comments: [] }]);

        await actions.submitPost();

        expect(dataService.publishPost).toHaveBeenCalledWith(expect.objectContaining({
            body: "@小灰灰\n这条愿望我来完成",
            boardSlug: "delivery"
        }));
        expect(store.getState().composerState.mentionTarget).toBe(null);
    });

    it("persists guess selection after submitting a guess post", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "guess", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "guess" }
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                mentionTarget: {
                    name: "海屿",
                    avatar: "haiyu-avatar"
                }
            }
        });
        dataService.publishPost.mockResolvedValue({
            id: "guess-post-1",
            board: "guess",
            comments: []
        });
        dataService.saveGuessSelection.mockResolvedValue({
            name: "海屿",
            avatar: "haiyu-avatar",
            selectedAt: "2026-04-21T12:00:00.000Z"
        });
        dataService.listPosts.mockResolvedValue([]);

        await actions.submitPost();

        expect(dataService.saveGuessSelection).toHaveBeenCalledWith({
            name: "海屿",
            avatar: "haiyu-avatar"
        });
        expect(store.getState().roundState.guessSelection?.name).toBe("海屿");
    });

    it("loads wish posts when switching into claim stage", async () => {
        seedApprovedViewer(store);
        dataService.listPosts.mockResolvedValue([{ id: "post-1", board: "wish", comments: [] }]);

        await actions.setActiveBoard("claim");

        expect(dataService.listPosts).toHaveBeenCalledWith("wish");
        expect(store.getState().feedState.activeBoard).toBe("claim");
    });

    it("locks a selected wish for the current round", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "round/set-stage",
            payload: { stage: "claim", forceAnonymous: false }
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "claim" }
        });
        store.dispatch({
            type: "feed/load-success",
            payload: {
                items: [{
                    id: "wish-1",
                    board: "wish",
                    authorName: "白榆",
                    authorAvatar: "alias-avatar",
                    authorUserId: "user-2",
                    text: "希望有人帮我把这周的知识整理成目录",
                    comments: []
                }]
            }
        });
        dataService.saveClaimSelection.mockResolvedValue({
            postId: "wish-1",
            authorName: "白榆",
            authorAvatar: "alias-avatar",
            previewText: "希望有人帮我把这周的知识整理成目录"
        });

        await actions.claimWish("wish-1");

        expect(dataService.saveClaimSelection).toHaveBeenCalledWith(expect.objectContaining({
            id: "wish-1"
        }));
        expect(store.getState().roundState.claimSelection?.postId).toBe("wish-1");
    });

    it("persists reveal pairs through channel storage", async () => {
        seedApprovedViewer(store);
        dataService.listPosts.mockResolvedValue([
            {
                id: "wish-1",
                board: "wish",
                authorName: "章鱼烧",
                text: "希望有人帮我把这周要发的内容收成一个可以直接执行的清单。",
                createdAt: "2026-04-21T08:00:00.000Z",
                isDeleted: false
            }
        ]);
        dataService.listChannelGuessSelections.mockResolvedValue([
            {
                memberName: "章鱼烧",
                guessedAngelName: "海屿",
                guessedAngelAvatar: "haiyu-avatar"
            }
        ]);
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                revealEditorOpen: true,
                draftRevealMember: {
                    name: "章鱼烧",
                    avatar: "avatar"
                },
                draftRevealAngel: {
                    name: "海屿",
                    avatar: "haiyu-avatar"
                }
            }
        });
        dataService.updateChannelRoundState.mockResolvedValue({
            currentRevealMap: {
                章鱼烧: {
                    member: { name: "章鱼烧", avatar: "avatar" },
                    angel: { name: "海屿", avatar: "haiyu-avatar" },
                    wishPostId: "wish-1",
                    wishPreview: "希望有人帮我把这周要发的内容收成一个可以直接执行的清单。",
                    guessedAngelName: "海屿",
                    guessedAngelAvatar: "haiyu-avatar"
                }
            }
        });

        await actions.saveRoundRevealPair();

        expect(dataService.updateChannelRoundState).toHaveBeenCalled();
        expect(store.getState().roundState.revealMap.章鱼烧.angel.name).toBe("海屿");
    });
});
