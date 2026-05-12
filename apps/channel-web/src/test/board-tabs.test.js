import { describe, expect, it, vi } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountBoardTabsBlock } from "../blocks/board-tabs/index.js";

describe("board tabs block", () => {
    it("opens the filter menu from the icon trigger and applies a filter", () => {
        document.body.innerHTML = "";
        const root = document.createElement("div");
        document.body.appendChild(root);

        const store = createStore();
        const actions = {
            setFeedFilter: vi.fn(),
            setActiveBoard: vi.fn(),
            syncTopRegion: vi.fn()
        };

        const block = mountBoardTabsBlock({ root, store, actions });
        block.render();

        const trigger = root.querySelector("[data-board-tabs-action='toggle-filters']");
        expect(trigger).toBeTruthy();
        expect(root.querySelector(".board-tabs__filter-menu")).toBeNull();

        trigger.click();
        expect(root.querySelector(".board-tabs__filter-menu")).toBeTruthy();
        expect(root.textContent).toContain("热门");
        expect(root.textContent).toContain("新发表");
        expect(root.textContent).toContain("新回复");

        root.querySelector("[data-filter='new-post']").click();
        expect(actions.setFeedFilter).toHaveBeenCalledWith("new-post");
        expect(root.querySelector(".board-tabs__filter-menu")).toBeNull();
    });

    it("keeps future-stage tabs clickable so the user can see why they are blocked", () => {
        document.body.innerHTML = "";
        const root = document.createElement("div");
        document.body.appendChild(root);

        const store = createStore();
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道", currentRoundStage: "wish" },
                realIdentity: { id: "identity-1", name: "成员", avatar: "avatar", meta: "当前真实身份", role: "member" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1" },
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

        const actions = {
            setFeedFilter: vi.fn(),
            setActiveBoard: vi.fn(),
            syncTopRegion: vi.fn()
        };

        const block = mountBoardTabsBlock({ root, store, actions });
        block.render();

        const guessButton = root.querySelector("[data-board='guess']");
        expect(guessButton?.getAttribute("aria-disabled")).toBe("true");

        guessButton?.click();
        expect(actions.setActiveBoard).toHaveBeenCalledWith("guess");
    });
});
