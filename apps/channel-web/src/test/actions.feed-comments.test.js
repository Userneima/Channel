import { beforeEach, describe, expect, it } from "vitest";
import { createActionsHarness, seedApprovedViewer } from "../../test-support/actions-fixture.js";

describe("channel feature actions: feed/comments", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        ({ store, dataService, actions } = createActionsHarness());
    });

    it("hydrates feed from local cache before network refresh completes", async () => {
        let resolveBootstrap;
        let resolvePosts;
        const bootstrapPromise = new Promise((resolve) => {
            resolveBootstrap = resolve;
        });
        const postsPromise = new Promise((resolve) => {
            resolvePosts = resolve;
        });

        dataService.getCachedChannelBootstrap.mockResolvedValue({
            channel: {
                id: "channel-1",
                slug: "channel",
                name: "频道",
                previewVisibility: "public",
                joinPolicy: "approval_required"
            },
            auth: {
                user: { id: "user-1", email: "owner@example.com" },
                isAnonymous: false
            },
            membership: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                role: "owner"
            },
            memberRuntime: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-1", name: "管理员", avatar: "avatar", role: "owner" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }]
            }
        });
        dataService.getCachedPosts.mockReturnValue([{ id: "cached-post", comments: [] }]);
        dataService.listPosts.mockReturnValue(postsPromise);
        dataService.loadChannelBootstrap.mockReturnValue(bootstrapPromise);

        const initPromise = actions.initializeChannelRuntime();
        await Promise.resolve();
        await Promise.resolve();

        expect(store.getState().feedState.items[0]?.id).toBe("cached-post");

        resolveBootstrap({
            channel: {
                id: "channel-1",
                slug: "channel",
                name: "频道",
                previewVisibility: "public",
                joinPolicy: "approval_required"
            },
            auth: {
                user: { id: "user-1", email: "owner@example.com" },
                isAnonymous: false
            },
            membership: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                role: "owner"
            },
            memberRuntime: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-1", name: "管理员", avatar: "avatar", role: "owner" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }]
            }
        });
        resolvePosts([{ id: "fresh-post", comments: [] }]);
        await initPromise;

        expect(store.getState().feedState.items[0]?.id).toBe("fresh-post");
    });

    it("shows cached post content in comments drawer before network refresh completes", async () => {
        seedApprovedViewer(store);
        let resolvePost;
        const postPromise = new Promise((resolve) => {
            resolvePost = resolve;
        });

        dataService.getCachedPost.mockReturnValue({
            id: "post-1",
            body: "cached body",
            comments: []
        });
        dataService.getPost.mockReturnValue(postPromise);

        actions.openComments("post-1");
        await Promise.resolve();
        await Promise.resolve();

        expect(store.getState().overlayState.comments.post?.body).toBe("cached body");

        resolvePost({
            id: "post-1",
            body: "fresh body",
            comments: []
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(store.getState().overlayState.comments.post?.body).toBe("fresh body");
    });

    it("submits reply comments with parent comment id", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "comments/open",
            payload: { postId: "post-1", source: "comments" }
        });
        store.dispatch({
            type: "comments/set-field",
            payload: {
                status: "ready",
                draftText: "接着这条说",
                replyTarget: {
                    id: "comment-1",
                    authorName: "海屿",
                    text: "原评论"
                }
            }
        });
        dataService.publishComment.mockResolvedValue({ id: "comment-2" });
        dataService.listPosts.mockResolvedValue([{ id: "post-1", comments: [] }]);
        dataService.getPost.mockResolvedValue({ id: "post-1", comments: [] });

        await actions.submitComment();

        expect(dataService.publishComment).toHaveBeenCalledWith(expect.objectContaining({
            postId: "post-1",
            parentCommentId: "comment-1"
        }));
        expect(store.getState().overlayState.comments.replyTarget).toBe(null);
    });

    it("likes a post once for the current session and updates the count", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "feed/load-success",
            payload: {
                items: [{ id: "post-1", likes: 3, comments: [] }]
            }
        });
        dataService.likePost.mockResolvedValue(4);

        await actions.likePost("post-1");
        await actions.likePost("post-1");

        expect(dataService.likePost).toHaveBeenCalledTimes(1);
        expect(store.getState().feedState.items[0].likes).toBe(4);
    });

    it("likes a comment once for the current session and updates the count", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "comments/open",
            payload: { postId: "post-1", source: "comments" }
        });
        store.dispatch({
            type: "comments/load-success",
            payload: {
                post: {
                    id: "post-1",
                    comments: [{ id: "comment-1", likes: 2 }]
                }
            }
        });
        dataService.likeComment.mockResolvedValue(3);

        await actions.likeComment("comment-1");
        await actions.likeComment("comment-1");

        expect(dataService.likeComment).toHaveBeenCalledTimes(1);
        expect(store.getState().overlayState.comments.post.comments[0].likes).toBe(3);
    });

    it("opens delete confirmation for posts and replaces the post after delete", async () => {
        seedApprovedViewer(store);
        store.dispatch({
            type: "feed/load-success",
            payload: {
                items: [{
                    id: "post-1",
                    authorName: "章鱼烧",
                    authorUserId: "user-1",
                    text: "原始帖子",
                    comments: [],
                    likes: 2,
                    shares: 1
                }]
            }
        });
        dataService.deletePost.mockResolvedValue({
            id: "post-1",
            authorName: "章鱼烧",
            authorUserId: "user-1",
            text: "该帖子已删除",
            isDeleted: true,
            deletedLabel: "该帖子已删除",
            comments: [],
            likes: 0,
            shares: 0
        });

        actions.requestDeletePost("post-1");
        await actions.confirmDeletePost("post-1");

        expect(dataService.deletePost).toHaveBeenCalledWith("post-1");
        expect(store.getState().feedState.items[0].isDeleted).toBe(true);
    });

    it("stores in-channel search query without reloading the feed", () => {
        actions.setFeedSearchQuery("苹果");

        expect(store.getState().feedState.searchQuery).toBe("苹果");
        expect(dataService.listPosts).not.toHaveBeenCalled();
    });
});
