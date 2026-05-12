import { describe, expect, it, vi } from "vitest";
import { createFeedActions } from "../features/feed/index.js";
import { createStore } from "../shared/state/store.js";

describe("feed actions", () => {
    it("applies hot, new-post and new-reply filters with stable post data sorting", () => {
        const store = createStore();
        const actions = createFeedActions({
            store,
            dataService: {},
            showToast: vi.fn()
        });

        store.dispatch({
            type: "feed/load-success",
            payload: {
                items: [
                    {
                        id: "post-new",
                        createdAt: "2026-04-22T09:00:00.000Z",
                        likes: 1,
                        views: 4,
                        comments: []
                    },
                    {
                        id: "post-hot",
                        createdAt: "2026-04-20T09:00:00.000Z",
                        likes: 9,
                        views: 120,
                        comments: [
                            { id: "comment-hot-1", createdAt: "2026-04-20T10:00:00.000Z", isDeleted: false },
                            { id: "comment-hot-2", createdAt: "2026-04-21T08:00:00.000Z", isDeleted: false }
                        ]
                    },
                    {
                        id: "post-replied",
                        createdAt: "2026-04-21T09:00:00.000Z",
                        likes: 2,
                        views: 18,
                        comments: [
                            { id: "comment-new", createdAt: "2026-04-22T11:30:00.000Z", isDeleted: false }
                        ]
                    }
                ]
            }
        });

        actions.setFeedFilter("hot");
        expect(store.getState().feedState.items.map((item) => item.id)).toEqual([
            "post-hot",
            "post-replied",
            "post-new"
        ]);

        actions.setFeedFilter("new-post");
        expect(store.getState().feedState.items.map((item) => item.id)).toEqual([
            "post-new",
            "post-replied",
            "post-hot"
        ]);

        actions.setFeedFilter("new-reply");
        expect(store.getState().feedState.items.map((item) => item.id)).toEqual([
            "post-replied",
            "post-hot",
            "post-new"
        ]);
    });
});
